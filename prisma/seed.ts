import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_EXCHANGE, DEMO_INSTRUMENTS } from "../src/lib/market/demo-instruments";
import { createDemoProvider } from "../src/lib/market/demo-provider";
import { Decimal, calculateBrokerageFee, applySlippage } from "../src/lib/money";
import { osloDateTimeToUtc } from "../src/lib/accounting/oslo-time";

const prisma = new PrismaClient();

const STARTING_CAPITAL = new Decimal(1_000_000);
const DEMO_PASSWORD = "Demo1234!";
const DEMO_EMAIL = "demo@aksjeanalyse.no";
const DEMO_SEED = "aksjeanalyse-demo";

function nearestWeekday(date: Date): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDay();
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

async function seedTrade(params: {
  accountId: string;
  instrumentId: string;
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  at: Date;
  provider: ReturnType<typeof createDemoProvider>;
  idempotencyKey: string;
}) {
  const { accountId, instrumentId, ticker, side, quantity, at, provider, idempotencyKey } = params;
  const observation = provider.getLatestObservation(ticker, at);
  if (!observation) throw new Error(`Ingen prisdata for ${ticker} på ${at.toISOString()}`);

  const rawPrice = new Decimal(observation.price);
  const fillPrice = applySlippage(rawPrice, side);
  const tradeValue = fillPrice.mul(quantity);
  const fee = calculateBrokerageFee(tradeValue);

  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

  if (side === "BUY") {
    const totalCost = tradeValue.add(fee);
    const newBalance = account.cashBalance.sub(totalCost);
    const order = await prisma.order.create({
      data: {
        accountId,
        instrumentId,
        side,
        quantity,
        status: "FILLED",
        idempotencyKey,
        requestedAt: at,
        filledAt: at,
        fillPrice,
        fillPriceObservedAt: observation.observedAt,
        feeAmount: fee,
        totalAmount: totalCost,
      },
    });
    const existing = await prisma.position.findUnique({ where: { accountId_instrumentId: { accountId, instrumentId } } });
    const costPerShare = totalCost.div(quantity);
    if (existing) {
      const totalQty = existing.quantity + quantity;
      const newAvgCost = existing.avgCost.mul(existing.quantity).add(costPerShare.mul(quantity)).div(totalQty);
      await prisma.position.update({ where: { id: existing.id }, data: { quantity: totalQty, avgCost: newAvgCost } });
    } else {
      await prisma.position.create({ data: { accountId, instrumentId, quantity, avgCost: costPerShare } });
    }
    await prisma.account.update({ where: { id: accountId }, data: { cashBalance: newBalance } });
    await prisma.cashLedgerEntry.create({
      data: { accountId, orderId: order.id, type: "TRADE_BUY", amount: totalCost.neg(), balanceAfter: newBalance, createdAt: at },
    });
  } else {
    const position = await prisma.position.findUniqueOrThrow({ where: { accountId_instrumentId: { accountId, instrumentId } } });
    const proceeds = tradeValue.sub(fee);
    const newBalance = account.cashBalance.add(proceeds);
    const order = await prisma.order.create({
      data: {
        accountId,
        instrumentId,
        side,
        quantity,
        status: "FILLED",
        idempotencyKey,
        requestedAt: at,
        filledAt: at,
        fillPrice,
        fillPriceObservedAt: observation.observedAt,
        feeAmount: fee,
        totalAmount: proceeds,
      },
    });
    const remaining = position.quantity - quantity;
    if (remaining <= 0) await prisma.position.delete({ where: { id: position.id } });
    else await prisma.position.update({ where: { id: position.id }, data: { quantity: remaining } });
    await prisma.account.update({ where: { id: accountId }, data: { cashBalance: newBalance } });
    await prisma.cashLedgerEntry.create({
      data: { accountId, orderId: order.id, type: "TRADE_SELL", amount: proceeds, balanceAfter: newBalance, createdAt: at },
    });
  }
}

async function main() {
  console.log("Seeder DEMO-instrumenter (syntetiske data)…");
  for (const spec of DEMO_INSTRUMENTS) {
    await prisma.instrument.upsert({
      where: { ticker_exchange: { ticker: spec.ticker, exchange: DEMO_EXCHANGE } },
      update: { name: spec.name, sector: spec.sector },
      create: { ticker: spec.ticker, name: spec.name, exchange: DEMO_EXCHANGE, currency: "NOK", sector: spec.sector },
    });
  }

  console.log("Oppretter demobruker…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, passwordHash, displayName: "Demo Demobrukersen" },
  });

  // Sett kontoens opprettelse 30 dager tilbake slik at resultatkalenderen
  // har noe å vise ved første innlogging.
  const now = new Date();
  const accountCreatedAt = new Date(now.getTime() - 30 * 24 * 3600_000);

  let demoAccount = await prisma.account.findUnique({ where: { userId_mode: { userId: user.id, mode: "DEMO" } } });
  const alreadySeeded = !!demoAccount;
  if (!demoAccount) {
    demoAccount = await prisma.account.create({
      data: {
        userId: user.id,
        mode: "DEMO",
        baseCurrency: "NOK",
        startingCapital: STARTING_CAPITAL,
        cashBalance: STARTING_CAPITAL,
        createdAt: accountCreatedAt,
      },
    });
    await prisma.cashLedgerEntry.create({
      data: { accountId: demoAccount.id, type: "DEPOSIT", amount: STARTING_CAPITAL, balanceAfter: STARTING_CAPITAL, createdAt: accountCreatedAt },
    });
  }

  const paperAccount = await prisma.account.findUnique({ where: { userId_mode: { userId: user.id, mode: "PAPER" } } });
  if (!paperAccount) {
    await prisma.account.create({
      data: { userId: user.id, mode: "PAPER", baseCurrency: "NOK", startingCapital: STARTING_CAPITAL, cashBalance: STARTING_CAPITAL },
    });
  }

  if (!alreadySeeded) {
    console.log("Legger inn noen demohandler i DEMO-kontoen…");
    const provider = createDemoProvider(DEMO_SEED);
    const fjrd = await prisma.instrument.findUniqueOrThrow({ where: { ticker_exchange: { ticker: "FJRD", exchange: DEMO_EXCHANGE } } });
    const norl = await prisma.instrument.findUniqueOrThrow({ where: { ticker_exchange: { ticker: "NORL", exchange: DEMO_EXCHANGE } } });
    const brek = await prisma.instrument.findUniqueOrThrow({ where: { ticker_exchange: { ticker: "BREK", exchange: DEMO_EXCHANGE } } });

    const tradeDay = (offsetDays: number) => {
      const d = nearestWeekday(new Date(accountCreatedAt.getTime() + offsetDays * 24 * 3600_000));
      return osloDateTimeToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 11, 0);
    };

    await seedTrade({ accountId: demoAccount.id, instrumentId: fjrd.id, ticker: "FJRD", side: "BUY", quantity: 50, at: tradeDay(3), provider, idempotencyKey: "seed-1" });
    await seedTrade({ accountId: demoAccount.id, instrumentId: norl.id, ticker: "NORL", side: "BUY", quantity: 30, at: tradeDay(10), provider, idempotencyKey: "seed-2" });
    await seedTrade({ accountId: demoAccount.id, instrumentId: fjrd.id, ticker: "FJRD", side: "SELL", quantity: 20, at: tradeDay(18), provider, idempotencyKey: "seed-3" });
    await seedTrade({ accountId: demoAccount.id, instrumentId: brek.id, ticker: "BREK", side: "BUY", quantity: 100, at: tradeDay(25), provider, idempotencyKey: "seed-4" });
  }

  console.log("\nDemodata klar.");
  console.log(`Logg inn som ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("Husk: legg denne e-postadressen i ALLOWED_EMAILS for å kunne logge inn.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
