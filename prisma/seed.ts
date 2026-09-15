import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEED_STOCKS } from "../src/lib/market/seed-stocks";
import { createMockProvider } from "../src/lib/market/mock-provider";
import { Decimal, calculateBrokerageFee } from "../src/lib/money";

const prisma = new PrismaClient();

const STARTING_CASH = new Decimal(100_000);
const DEMO_PASSWORD = "Demo1234!";

async function main() {
  console.log("Seeder aksjer (demodata)…");
  for (const stock of SEED_STOCKS) {
    await prisma.stock.upsert({
      where: { ticker: stock.ticker },
      update: { name: stock.name, currency: "NOK" },
      create: { ticker: stock.ticker, name: stock.name, currency: "NOK" },
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  console.log("Oppretter demobrukere…");
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@borsliga.no" },
    update: {},
    create: { email: "demo@borsliga.no", passwordHash, displayName: "Demo Demobrukersen" },
  });
  const kari = await prisma.user.upsert({
    where: { email: "kari@borsliga.no" },
    update: {},
    create: { email: "kari@borsliga.no", passwordHash, displayName: "Kari Nordmann" },
  });
  const ola = await prisma.user.upsert({
    where: { email: "ola@borsliga.no" },
    update: {},
    create: { email: "ola@borsliga.no", passwordHash, displayName: "Ola Hansen" },
  });

  console.log("Oppretter øvingskontoer med et par demohandler…");
  const provider = createMockProvider();
  const now = new Date();

  for (const user of [demoUser, kari, ola]) {
    const existing = await prisma.account.findFirst({ where: { userId: user.id, seasonId: null } });
    if (existing) continue;

    const account = await prisma.account.create({
      data: { userId: user.id, seasonId: null, cashBalance: STARTING_CASH },
    });
    await prisma.cashLedgerEntry.create({
      data: {
        accountId: account.id,
        type: "INITIAL_DEPOSIT",
        amount: STARTING_CASH,
        balanceAfter: STARTING_CASH,
      },
    });
  }

  // Gi demobrukeren to fylte kjøpsordre i øvingsporteføljen, slik at
  // portefølje- og ordrehistorikksidene ikke er tomme ved første innlogging.
  const demoAccount = await prisma.account.findFirstOrThrow({
    where: { userId: demoUser.id, seasonId: null },
  });
  const alreadyHasOrders = await prisma.order.findFirst({ where: { accountId: demoAccount.id } });
  if (!alreadyHasOrders) {
    let cash = STARTING_CASH;
    for (const ticker of ["FJRD", "BREK"]) {
      const observation = provider.getLatestObservation(ticker, now) ?? provider.getNextObservationAfter(ticker, now).observation;
      const stock = await prisma.stock.findUniqueOrThrow({ where: { ticker } });
      const quantity = 20;
      const fillPrice = new Decimal(observation.price);
      const tradeValue = fillPrice.mul(quantity);
      const fee = calculateBrokerageFee(tradeValue);
      const totalCost = tradeValue.add(fee);
      cash = cash.sub(totalCost);

      const order = await prisma.order.create({
        data: {
          accountId: demoAccount.id,
          stockId: stock.id,
          side: "BUY",
          quantity,
          status: "FILLED",
          idempotencyKey: `seed-${ticker}`,
          requestedAt: now,
          filledAt: now,
          fillPrice,
          fillPriceObservedAt: observation.observedAt,
          feeAmount: fee,
          totalAmount: totalCost,
        },
      });
      await prisma.holding.create({
        data: { accountId: demoAccount.id, stockId: stock.id, quantity, avgCost: totalCost.div(quantity) },
      });
      await prisma.cashLedgerEntry.create({
        data: {
          accountId: demoAccount.id,
          orderId: order.id,
          type: "TRADE_BUY",
          amount: totalCost.neg(),
          balanceAfter: cash,
        },
      });
    }
    await prisma.account.update({ where: { id: demoAccount.id }, data: { cashBalance: cash } });
  }

  console.log("Oppretter demoliga med aktiv sesong…");
  const seasonStartsAt = new Date(now.getTime() - 3 * 24 * 3600_000);
  const seasonEndsAt = new Date(seasonStartsAt.getTime() + 28 * 24 * 3600_000);
  const registrationDeadline = new Date(seasonStartsAt.getTime() - 24 * 3600_000);

  const league = await prisma.league.upsert({
    where: { inviteCode: "DEMO2026" },
    update: {},
    create: { name: "Demoligaen", inviteCode: "DEMO2026", ownerId: demoUser.id },
  });
  const season = await prisma.season.upsert({
    where: { leagueId_seasonNumber: { leagueId: league.id, seasonNumber: 1 } },
    update: {},
    create: {
      leagueId: league.id,
      seasonNumber: 1,
      startsAt: seasonStartsAt,
      endsAt: seasonEndsAt,
      registrationDeadline,
      startingCash: STARTING_CASH,
    },
  });

  for (const user of [demoUser, kari, ola]) {
    await prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
      update: {},
      create: { userId: user.id, leagueId: league.id },
    });
    const existingAccount = await prisma.account.findUnique({
      where: { userId_seasonId: { userId: user.id, seasonId: season.id } },
    });
    if (!existingAccount) {
      const account = await prisma.account.create({
        data: { userId: user.id, seasonId: season.id, cashBalance: STARTING_CASH },
      });
      await prisma.cashLedgerEntry.create({
        data: {
          accountId: account.id,
          type: "INITIAL_DEPOSIT",
          amount: STARTING_CASH,
          balanceAfter: STARTING_CASH,
        },
      });
    }
  }

  // Gi Kari og Ola litt ulike beholdninger i demoligaen, slik at
  // resultatlisten viser en reell rangering fra start.
  const seedHoldings: Record<string, { ticker: string; quantity: number }[]> = {
    [kari.id]: [
      { ticker: "MYRA", quantity: 300 },
      { ticker: "ISBJ", quantity: 80 },
    ],
    [ola.id]: [
      { ticker: "TIND", quantity: 150 },
      { ticker: "KVAL", quantity: 100 },
    ],
  };
  for (const [userId, positions] of Object.entries(seedHoldings)) {
    const account = await prisma.account.findUniqueOrThrow({
      where: { userId_seasonId: { userId, seasonId: season.id } },
    });
    const hasHoldings = await prisma.holding.findFirst({ where: { accountId: account.id } });
    if (hasHoldings) continue;

    let cash = STARTING_CASH;
    for (const position of positions) {
      const observation =
        provider.getLatestObservation(position.ticker, seasonStartsAt) ??
        provider.getNextObservationAfter(position.ticker, seasonStartsAt).observation;
      const stock = await prisma.stock.findUniqueOrThrow({ where: { ticker: position.ticker } });
      const fillPrice = new Decimal(observation.price);
      const tradeValue = fillPrice.mul(position.quantity);
      const fee = calculateBrokerageFee(tradeValue);
      const totalCost = tradeValue.add(fee);
      cash = cash.sub(totalCost);

      const order = await prisma.order.create({
        data: {
          accountId: account.id,
          stockId: stock.id,
          side: "BUY",
          quantity: position.quantity,
          status: "FILLED",
          idempotencyKey: `seed-league-${position.ticker}`,
          requestedAt: seasonStartsAt,
          filledAt: seasonStartsAt,
          fillPrice,
          fillPriceObservedAt: observation.observedAt,
          feeAmount: fee,
          totalAmount: totalCost,
        },
      });
      await prisma.holding.create({
        data: {
          accountId: account.id,
          stockId: stock.id,
          quantity: position.quantity,
          avgCost: totalCost.div(position.quantity),
        },
      });
      await prisma.cashLedgerEntry.create({
        data: {
          accountId: account.id,
          orderId: order.id,
          type: "TRADE_BUY",
          amount: totalCost.neg(),
          balanceAfter: cash,
        },
      });
    }
    await prisma.account.update({ where: { id: account.id }, data: { cashBalance: cash } });
  }

  console.log("");
  console.log("Demodata klar.");
  console.log(`Logg inn som demo@borsliga.no / ${DEMO_PASSWORD}`);
  console.log(`Demoliga-invitasjonskode: DEMO2026`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
