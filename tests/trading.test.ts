import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { placeOrder, cancelOrder, ForbiddenError, SeasonNotActiveError } from "@/lib/trading";
import { getMarketDataProvider } from "@/lib/market";
import { createLeague } from "@/lib/leagues";
import { FIXED_NOW, createPracticeAccount, createStock, createUser, resetDb } from "./helpers";

function toSaturday(base: Date): Date {
  const d = new Date(base.getTime());
  const diff = (6 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

beforeEach(async () => {
  await resetDb();
});

describe("kjøp og salg", () => {
  it("fyller et kjøp, trekker kontanter inkl. kurtasje, og oppretter en beholdning", async () => {
    const user = await createUser();
    const stock = await createStock("FJRD");
    const account = await createPracticeAccount(user.id, 100_000);
    const provider = getMarketDataProvider();

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "FJRD", side: "BUY", quantity: 10, idempotencyKey: "k1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("FILLED");
    expect(order.fillPrice).not.toBeNull();
    expect(order.feeAmount).not.toBeNull();

    const updatedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    const expectedTotal = order.totalAmount as Decimal;
    expect(updatedAccount.cashBalance.toString()).toBe(new Decimal(100_000).sub(expectedTotal).toString());

    const holding = await prisma.holding.findUniqueOrThrow({
      where: { accountId_stockId: { accountId: account.id, stockId: stock.id } },
    });
    expect(holding.quantity).toBe(10);

    const ledgerSum = (await prisma.cashLedgerEntry.findMany({ where: { accountId: account.id } })).reduce(
      (sum, entry) => sum.add(entry.amount),
      new Decimal(0)
    );
    // Ingen penger skal oppstå eller forsvinne: sum av bevegelser == saldo.
    expect(ledgerSum.toString()).toBe(updatedAccount.cashBalance.toString());
  });

  it("fyller et salg og øker kontantsaldoen", async () => {
    const user = await createUser();
    const stock = await createStock("NORL");
    const account = await createPracticeAccount(user.id, 100_000);
    await prisma.holding.create({
      data: { accountId: account.id, stockId: stock.id, quantity: 20, avgCost: new Decimal(50) },
    });
    const provider = getMarketDataProvider();

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "NORL", side: "SELL", quantity: 5, idempotencyKey: "s1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("FILLED");
    const holding = await prisma.holding.findUniqueOrThrow({
      where: { accountId_stockId: { accountId: account.id, stockId: stock.id } },
    });
    expect(holding.quantity).toBe(15);

    const updatedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(updatedAccount.cashBalance.greaterThan(100_000)).toBe(true);
  });

  it("sletter beholdningsraden når hele posisjonen selges", async () => {
    const user = await createUser();
    const stock = await createStock("BREK");
    const account = await createPracticeAccount(user.id, 100_000);
    await prisma.holding.create({
      data: { accountId: account.id, stockId: stock.id, quantity: 3, avgCost: new Decimal(10) },
    });

    await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "BREK", side: "SELL", quantity: 3, idempotencyKey: "sa1" },
      { provider: getMarketDataProvider(), now: () => FIXED_NOW }
    );

    const holding = await prisma.holding.findUnique({
      where: { accountId_stockId: { accountId: account.id, stockId: stock.id } },
    });
    expect(holding).toBeNull();
  });
});

describe("manglende dekning", () => {
  it("avviser kjøp uten tilstrekkelig dekning uten å endre saldo eller beholdning", async () => {
    const user = await createUser();
    await createStock("VIDD");
    const account = await createPracticeAccount(user.id, 1); // 1 krone — ikke nok til noe kjøp

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "VIDD", side: "BUY", quantity: 100, idempotencyKey: "poor1" },
      { provider: getMarketDataProvider(), now: () => FIXED_NOW }
    );

    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toMatch(/dekning/i);

    const account2 = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(account2.cashBalance.equals(new Decimal(1))).toBe(true);
    const holding = await prisma.holding.findUnique({
      where: { accountId_stockId: { accountId: account.id, stockId: (await prisma.stock.findUniqueOrThrow({ where: { ticker: "VIDD" } })).id } },
    });
    expect(holding).toBeNull();
  });

  it("avviser salg av flere aksjer enn man eier", async () => {
    const user = await createUser();
    const stock = await createStock("SALT");
    const account = await createPracticeAccount(user.id, 100_000);
    await prisma.holding.create({
      data: { accountId: account.id, stockId: stock.id, quantity: 2, avgCost: new Decimal(10) },
    });

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "SALT", side: "SELL", quantity: 5, idempotencyKey: "few1" },
      { provider: getMarketDataProvider(), now: () => FIXED_NOW }
    );

    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toMatch(/aksjer/i);
    const holding = await prisma.holding.findUniqueOrThrow({
      where: { accountId_stockId: { accountId: account.id, stockId: stock.id } },
    });
    expect(holding.quantity).toBe(2); // uendret
  });
});

describe("samtidige ordre", () => {
  it("lar bare ett av to samtidige salg som til sammen overstiger beholdningen gå gjennom", async () => {
    const user = await createUser();
    const stock = await createStock("TIND");
    const account = await createPracticeAccount(user.id, 100_000);
    await prisma.holding.create({
      data: { accountId: account.id, stockId: stock.id, quantity: 100, avgCost: new Decimal(10) },
    });
    const provider = getMarketDataProvider();

    const [orderA, orderB] = await Promise.all([
      placeOrder(
        { accountId: account.id, userId: user.id, ticker: "TIND", side: "SELL", quantity: 60, idempotencyKey: "race-a" },
        { provider, now: () => FIXED_NOW }
      ),
      placeOrder(
        { accountId: account.id, userId: user.id, ticker: "TIND", side: "SELL", quantity: 60, idempotencyKey: "race-b" },
        { provider, now: () => FIXED_NOW }
      ),
    ]);

    const statuses = [orderA.status, orderB.status].sort();
    expect(statuses).toEqual(["FILLED", "REJECTED"]);

    const holding = await prisma.holding.findUniqueOrThrow({
      where: { accountId_stockId: { accountId: account.id, stockId: stock.id } },
    });
    expect(holding.quantity).toBe(40); // 100 - 60, aldri negativ
  });

  it("lar bare ett av to samtidige kjøp som til sammen overstiger dekningen gå gjennom", async () => {
    await createStock("SKJR");
    const provider = getMarketDataProvider();

    // Bruk selve prisformelen (samme som placeOrder benytter) til å regne ut
    // nøyaktig kostnad for én ordre på 100 stk, uten å måtte plassere en
    // "prøveordre" først.
    const observation = provider.getNextObservationAfter("SKJR", FIXED_NOW).observation;
    const tradeValue = new Decimal(observation.price).mul(100);
    const feeEstimate = tradeValue.mul(0.001).add(39); // samme formel som calculateBrokerageFee
    const totalCostEstimate = tradeValue.add(feeEstimate);

    const buyer = await createUser();
    // Nok til akkurat ÉN av de to ordrene, ikke begge.
    const account = await createPracticeAccount(buyer.id, totalCostEstimate.mul(1.5).toNumber());

    const [orderA, orderB] = await Promise.all([
      placeOrder(
        { accountId: account.id, userId: buyer.id, ticker: "SKJR", side: "BUY", quantity: 100, idempotencyKey: "buy-race-a" },
        { provider, now: () => FIXED_NOW }
      ),
      placeOrder(
        { accountId: account.id, userId: buyer.id, ticker: "SKJR", side: "BUY", quantity: 100, idempotencyKey: "buy-race-b" },
        { provider, now: () => FIXED_NOW }
      ),
    ]);

    const statuses = [orderA.status, orderB.status].sort();
    expect(statuses).toEqual(["FILLED", "REJECTED"]);

    const finalAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(finalAccount.cashBalance.greaterThanOrEqualTo(0)).toBe(true);
  });
});

describe("duplikatforespørsler (idempotens)", () => {
  it("returnerer samme ordre ved gjentatt kall med samme idempotensnøkkel (sekvensielt)", async () => {
    const user = await createUser();
    await createStock("ELVA");
    const account = await createPracticeAccount(user.id, 100_000);
    const provider = getMarketDataProvider();

    const first = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "ELVA", side: "BUY", quantity: 4, idempotencyKey: "same-key" },
      { provider, now: () => FIXED_NOW }
    );
    const second = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "ELVA", side: "BUY", quantity: 4, idempotencyKey: "same-key" },
      { provider, now: () => FIXED_NOW }
    );

    expect(second.id).toBe(first.id);
    const allOrders = await prisma.order.findMany({ where: { accountId: account.id } });
    expect(allOrders).toHaveLength(1);

    const account2 = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    // Trukket kun én gang, ikke to.
    const expectedBalance = new Decimal(100_000).sub(first.totalAmount as Decimal);
    expect(account2.cashBalance.toString()).toBe(expectedBalance.toString());
  });

  it("returnerer samme ordre ved samtidige kall med samme idempotensnøkkel", async () => {
    const user = await createUser();
    await createStock("FOSS");
    const account = await createPracticeAccount(user.id, 100_000);
    const provider = getMarketDataProvider();

    const [a, b] = await Promise.all([
      placeOrder(
        { accountId: account.id, userId: user.id, ticker: "FOSS", side: "BUY", quantity: 2, idempotencyKey: "concurrent-key" },
        { provider, now: () => FIXED_NOW }
      ),
      placeOrder(
        { accountId: account.id, userId: user.id, ticker: "FOSS", side: "BUY", quantity: 2, idempotencyKey: "concurrent-key" },
        { provider, now: () => FIXED_NOW }
      ),
    ]);

    expect(a.id).toBe(b.id);
    const allOrders = await prisma.order.findMany({ where: { accountId: account.id } });
    expect(allOrders).toHaveLength(1);
  });

  it("kaster en tydelig feil hvis nøkkelen gjenbrukes for en annen ordre", async () => {
    const user = await createUser();
    await createStock("GRAN");
    await createStock("LYNG");
    const account = await createPracticeAccount(user.id, 100_000);
    const provider = getMarketDataProvider();

    await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "GRAN", side: "BUY", quantity: 1, idempotencyKey: "reused" },
      { provider, now: () => FIXED_NOW }
    );

    await expect(
      placeOrder(
        { accountId: account.id, userId: user.id, ticker: "LYNG", side: "BUY", quantity: 1, idempotencyKey: "reused" },
        { provider, now: () => FIXED_NOW }
      )
    ).rejects.toThrow(/idempotensnøkkel/i);
  });
});

describe("tilgangskontroll", () => {
  it("nekter å plassere ordre på en konto som tilhører en annen bruker", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    await createStock("ISBJ");
    const account = await createPracticeAccount(owner.id, 100_000);

    await expect(
      placeOrder(
        { accountId: account.id, userId: intruder.id, ticker: "ISBJ", side: "BUY", quantity: 1, idempotencyKey: "intrude" },
        { provider: getMarketDataProvider(), now: () => FIXED_NOW }
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("nekter å kansellere en ordre som tilhører en annen bruker", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const account = await createPracticeAccount(owner.id, 100_000);
    const order = await prisma.order.create({
      data: {
        accountId: account.id,
        stockId: (await createStock("HAVN")).id,
        side: "BUY",
        quantity: 1,
        status: "PENDING",
        idempotencyKey: "pending-1",
      },
    });

    await expect(cancelOrder(order.id, intruder.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("nekter handel i en sesong som ikke er aktiv ennå", async () => {
    const owner = await createUser();
    // Merk: ekte Date.now() her (ikke FIXED_NOW) — createLeague validerer
    // sesongstart mot faktisk klokkeslett, uavhengig av now-parameteren vi
    // senere injiserer i placeOrder.
    const farFuture = new Date(Date.now() + 30 * 24 * 3600_000);
    const { league, season } = await createLeague({
      name: "Fremtidsligaen",
      ownerId: owner.id,
      seasonStartsAt: farFuture,
    });
    void league;
    await createStock("RYFYL");

    const account = await prisma.account.findUniqueOrThrow({
      where: { userId_seasonId: { userId: owner.id, seasonId: season.id } },
    });

    await expect(
      placeOrder(
        { accountId: account.id, userId: owner.id, ticker: "RYFYL", side: "BUY", quantity: 1, idempotencyKey: "early" },
        { provider: getMarketDataProvider(), now: () => FIXED_NOW }
      )
    ).rejects.toBeInstanceOf(SeasonNotActiveError);
  });

});

describe("forsinkede kurser", () => {
  it("fyller aldri til en kjent/gammel kurs — observasjonen er alltid etter mottakstidspunktet", async () => {
    const user = await createUser();
    await createStock("MYRA");
    const account = await createPracticeAccount(user.id, 100_000);
    const provider = getMarketDataProvider();

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "MYRA", side: "BUY", quantity: 1, idempotencyKey: "late1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("FILLED");
    expect(order.fillPriceObservedAt).not.toBeNull();
    expect((order.fillPriceObservedAt as Date).getTime()).toBeGreaterThan(FIXED_NOW.getTime());
  });

  it("utløper ordren dersom neste kursobservasjon ligger utenfor maksimal ventetid", async () => {
    const user = await createUser();
    await createStock("STAV");
    const account = await createPracticeAccount(user.id, 100_000);
    const provider = getMarketDataProvider();

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "STAV", side: "BUY", quantity: 1, idempotencyKey: "slow1" },
      { provider, now: () => FIXED_NOW, maxWaitMs: 1 } // maks 1ms — kan aldri rekke neste tick
    );

    expect(order.status).toBe("EXPIRED");
  });

  it("avviser handel når markedet er stengt (helg)", async () => {
    const user = await createUser();
    await createStock("KVAL");
    const account = await createPracticeAccount(user.id, 100_000);
    const saturday = toSaturday(FIXED_NOW);

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "KVAL", side: "BUY", quantity: 1, idempotencyKey: "wk1" },
      { provider: getMarketDataProvider(), now: () => saturday }
    );

    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toMatch(/stengt/i);
  });
});
