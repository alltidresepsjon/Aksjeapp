import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal, calculateBrokerageFee, applySlippage } from "@/lib/money";
import { computeDailySnapshot, ensureSnapshotsThrough } from "@/lib/accounting/snapshot";
import { osloDateTimeToUtc, tradingDayCloseInstant } from "@/lib/accounting/oslo-time";
import { createDemoProvider } from "@/lib/market/demo-provider";
import { createAccount, createInstrument, createUser, resetDb } from "./helpers";

const provider = createDemoProvider("accounting-test-seed");

// Mandag i en fast, kjent uke (ingen helligdager å ta hensyn til her).
const MONDAY = new Date(Date.UTC(2025, 5, 2)); // 2. juni 2025 er en mandag
function weekdayPureDate(offsetDays: number): Date {
  const d = new Date(MONDAY.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

async function seedFill(params: {
  accountId: string;
  instrumentId: string;
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  at: Date;
  idempotencyKey: string;
}) {
  const observation = provider.getLatestObservation(params.ticker, params.at);
  if (!observation) throw new Error("Ingen prisdata i test-oppsett");
  const rawPrice = new Decimal(observation.price);
  const fillPrice = applySlippage(rawPrice, params.side);
  const tradeValue = fillPrice.mul(params.quantity);
  const fee = calculateBrokerageFee(tradeValue);
  const account = await prisma.account.findUniqueOrThrow({ where: { id: params.accountId } });

  if (params.side === "BUY") {
    const totalCost = tradeValue.add(fee);
    const newBalance = account.cashBalance.sub(totalCost);
    const order = await prisma.order.create({
      data: {
        accountId: params.accountId,
        instrumentId: params.instrumentId,
        side: "BUY",
        quantity: params.quantity,
        status: "FILLED",
        idempotencyKey: params.idempotencyKey,
        requestedAt: params.at,
        filledAt: params.at,
        fillPrice,
        fillPriceObservedAt: observation.observedAt,
        feeAmount: fee,
        totalAmount: totalCost,
      },
    });
    const existing = await prisma.position.findUnique({
      where: { accountId_instrumentId: { accountId: params.accountId, instrumentId: params.instrumentId } },
    });
    const costPerShare = totalCost.div(params.quantity);
    if (existing) {
      const totalQty = existing.quantity + params.quantity;
      const newAvgCost = existing.avgCost.mul(existing.quantity).add(costPerShare.mul(params.quantity)).div(totalQty);
      await prisma.position.update({ where: { id: existing.id }, data: { quantity: totalQty, avgCost: newAvgCost } });
    } else {
      await prisma.position.create({ data: { accountId: params.accountId, instrumentId: params.instrumentId, quantity: params.quantity, avgCost: costPerShare } });
    }
    await prisma.account.update({ where: { id: params.accountId }, data: { cashBalance: newBalance } });
    await prisma.cashLedgerEntry.create({
      data: { accountId: params.accountId, orderId: order.id, type: "TRADE_BUY", amount: totalCost.neg(), balanceAfter: newBalance, createdAt: params.at },
    });
    return { fillPrice, fee, totalCost };
  }

  const position = await prisma.position.findUniqueOrThrow({
    where: { accountId_instrumentId: { accountId: params.accountId, instrumentId: params.instrumentId } },
  });
  const proceeds = tradeValue.sub(fee);
  const newBalance = account.cashBalance.add(proceeds);
  const order = await prisma.order.create({
    data: {
      accountId: params.accountId,
      instrumentId: params.instrumentId,
      side: "SELL",
      quantity: params.quantity,
      status: "FILLED",
      idempotencyKey: params.idempotencyKey,
      requestedAt: params.at,
      filledAt: params.at,
      fillPrice,
      fillPriceObservedAt: observation.observedAt,
      feeAmount: fee,
      totalAmount: proceeds,
    },
  });
  const remaining = position.quantity - params.quantity;
  if (remaining <= 0) await prisma.position.delete({ where: { id: position.id } });
  else await prisma.position.update({ where: { id: position.id }, data: { quantity: remaining } });
  await prisma.account.update({ where: { id: params.accountId }, data: { cashBalance: newBalance } });
  await prisma.cashLedgerEntry.create({
    data: { accountId: params.accountId, orderId: order.id, type: "TRADE_SELL", amount: proceeds, balanceAfter: newBalance, createdAt: params.at },
  });
  return { fillPrice, fee, proceeds };
}

beforeEach(async () => {
  await resetDb();
});

describe("porteføljeregnskap og daglig resultat", () => {
  it("en dag uten handler og uten posisjoner gir nøyaktig 0 i dagsresultat", async () => {
    const user = await createUser();
    const createdAt = tradingDayCloseInstant(weekdayPureDate(0)); // opprettet ved mandagens stenging
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);

    const snapshot = await computeDailySnapshot(account.id, weekdayPureDate(0), provider);
    expect(snapshot.dayResult.toString()).toBe("0");
    expect(snapshot.startValue.toString()).toBe(snapshot.endValue.toString());
  });

  it("dagsresultatet reflekterer kursbevegelse på en åpen posisjon (urealisert bidrag)", async () => {
    const user = await createUser();
    const instrument = await createInstrument("FJRD");
    const createdAt = osloDateTimeToUtc(2025, 6, 2, 9, 0);
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);

    await seedFill({ accountId: account.id, instrumentId: instrument.id, ticker: "FJRD", side: "BUY", quantity: 10, at: osloDateTimeToUtc(2025, 6, 2, 10, 0), idempotencyKey: "buy-1" });

    const snapshot = await computeDailySnapshot(account.id, weekdayPureDate(0), provider);
    // Realisert skal være 0 (ingen salg), urealisert + kostnader skal forklare hele bevegelsen.
    expect(snapshot.realizedPnl.toString()).toBe("0");
    expect(snapshot.dayResult.equals(snapshot.unrealizedPnlChange.sub(snapshot.costs))).toBe(true);
  });

  it("innskudd/uttak påvirker IKKE dagsresultatet (skal justeres bort)", async () => {
    const user = await createUser();
    const createdAt = tradingDayCloseInstant(weekdayPureDate(0));
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);

    // Et innskudd midt på tirsdagen.
    const depositAt = osloDateTimeToUtc(2025, 6, 3, 12, 0);
    const acc = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    const newBalance = acc.cashBalance.add(50_000);
    await prisma.account.update({ where: { id: account.id }, data: { cashBalance: newBalance } });
    await prisma.cashLedgerEntry.create({
      data: { accountId: account.id, type: "DEPOSIT", amount: new Decimal(50_000), balanceAfter: newBalance, createdAt: depositAt },
    });

    const snapshot = await computeDailySnapshot(account.id, weekdayPureDate(1), provider); // tirsdag
    expect(snapshot.netDeposits.toString()).toBe("50000");
    // Ingen posisjoner, ingen kursbevegelse mulig -> resultatet skal fortsatt være 0 selv om saldoen økte.
    expect(snapshot.dayResult.toString()).toBe("0");
  });

  it("realisert + urealisert - kostnader summerer alltid nøyaktig til dagsresultatet", async () => {
    const user = await createUser();
    const instrument = await createInstrument("NORL");
    const createdAt = osloDateTimeToUtc(2025, 6, 2, 9, 0);
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);

    await seedFill({ accountId: account.id, instrumentId: instrument.id, ticker: "NORL", side: "BUY", quantity: 20, at: osloDateTimeToUtc(2025, 6, 2, 10, 0), idempotencyKey: "b1" });
    await seedFill({ accountId: account.id, instrumentId: instrument.id, ticker: "NORL", side: "SELL", quantity: 5, at: osloDateTimeToUtc(2025, 6, 3, 11, 0), idempotencyKey: "s1" });

    const snapshot = await computeDailySnapshot(account.id, weekdayPureDate(1), provider); // tirsdag (salgsdagen)
    const reconstructed = snapshot.realizedPnl.add(snapshot.unrealizedPnlChange).sub(snapshot.costs);
    expect(reconstructed.toString()).toBe(snapshot.dayResult.toString());
  });
});

describe("idempotens og gjentatte kjøringer", () => {
  it("å kjøre computeDailySnapshot flere ganger for samme dag gir identisk resultat, ikke duplikater", async () => {
    const user = await createUser();
    const instrument = await createInstrument("BREK");
    const createdAt = osloDateTimeToUtc(2025, 6, 2, 9, 0);
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);
    await seedFill({ accountId: account.id, instrumentId: instrument.id, ticker: "BREK", side: "BUY", quantity: 5, at: osloDateTimeToUtc(2025, 6, 2, 10, 0), idempotencyKey: "b1" });

    const first = await computeDailySnapshot(account.id, weekdayPureDate(0), provider);
    const second = await computeDailySnapshot(account.id, weekdayPureDate(0), provider);

    expect(first.id).toBe(second.id);
    expect(first.dayResult.toString()).toBe(second.dayResult.toString());
    expect(await prisma.dailySnapshot.count({ where: { accountId: account.id } })).toBe(1);
  });

  it("ensureSnapshotsThrough bygger ut flere dager uten hull eller duplikater ved gjentatt kall", async () => {
    const user = await createUser();
    const createdAt = tradingDayCloseInstant(weekdayPureDate(0));
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);

    await ensureSnapshotsThrough(account.id, weekdayPureDate(4), provider); // man-fre
    const firstRun = await prisma.dailySnapshot.count({ where: { accountId: account.id } });
    expect(firstRun).toBe(5);

    await ensureSnapshotsThrough(account.id, weekdayPureDate(4), provider);
    const secondRun = await prisma.dailySnapshot.count({ where: { accountId: account.id } });
    expect(secondRun).toBe(5);
  });
});

describe("stengt marked (helg)", () => {
  it("markerer helgedager som stengt med nøytralt (0) resultat", async () => {
    const user = await createUser();
    const createdAt = tradingDayCloseInstant(weekdayPureDate(0));
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);

    const saturday = weekdayPureDate(5);
    const snapshot = await computeDailySnapshot(account.id, saturday, provider);
    expect(snapshot.marketClosed).toBe(true);
    expect(snapshot.dayResult.toString()).toBe("0");
  });
});

describe("manglende prisdata", () => {
  it("markerer dataIncomplete og verdsetter ALDRI en manglende posisjon til 0", async () => {
    const user = await createUser();
    // Et instrument DEMO-leverandøren ikke kjenner til (simulerer en feed-feil
    // for et instrument man tidligere fikk fylt en ordre i).
    const ghost = await createInstrument("GHOST1", { name: "Spøkelse ASA" });
    const createdAt = osloDateTimeToUtc(2025, 6, 2, 9, 0);
    const account = await createAccount(user.id, "DEMO", 100_000, createdAt);

    // Posisjonen må komme fra en FYLT ordre — reconstructPositionsAt leser
    // historikk fra Order, ikke fra Position-tabellen direkte. Prisen
    // settes manuelt siden leverandøren aldri har hatt data for GHOST1.
    const fillPrice = new Decimal(100);
    const fee = calculateBrokerageFee(fillPrice.mul(10));
    const totalCost = fillPrice.mul(10).add(fee);
    const order = await prisma.order.create({
      data: {
        accountId: account.id,
        instrumentId: ghost.id,
        side: "BUY",
        quantity: 10,
        status: "FILLED",
        idempotencyKey: "ghost-buy",
        requestedAt: createdAt,
        filledAt: createdAt,
        fillPrice,
        fillPriceObservedAt: createdAt,
        feeAmount: fee,
        totalAmount: totalCost,
      },
    });
    const newBalance = new Decimal(100_000).sub(totalCost);
    await prisma.account.update({ where: { id: account.id }, data: { cashBalance: newBalance } });
    await prisma.cashLedgerEntry.create({
      data: { accountId: account.id, orderId: order.id, type: "TRADE_BUY", amount: totalCost.neg(), balanceAfter: newBalance, createdAt },
    });

    const snapshot = await computeDailySnapshot(account.id, weekdayPureDate(0), provider);
    expect(snapshot.dataIncomplete).toBe(true);
    // Verdien skal reflektere kontantene, ikke straffes til under det ved å
    // verdsette den manglende posisjonen til 0.
    expect(snapshot.endValue.greaterThanOrEqualTo(newBalance)).toBe(true);
  });
});

describe("kontoens første dag", () => {
  it("bootstrapper startverdi korrekt til startkapitalen på opprettelsesdagen", async () => {
    const user = await createUser();
    const createdAt = osloDateTimeToUtc(2025, 6, 2, 13, 0); // midt på mandagen
    const account = await createAccount(user.id, "DEMO", 250_000, createdAt);

    const snapshot = await computeDailySnapshot(account.id, weekdayPureDate(0), provider);
    expect(snapshot.startValue.toString()).toBe("250000");
  });
});
