import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { placeOrder, cancelOrder } from "@/lib/trading";
import { ForbiddenError, IdempotencyConflictError } from "@/lib/errors";
import { createDemoProvider } from "@/lib/market/demo-provider";
import { FIXED_NOW, createAccount, createInstrument, createUser, resetDb } from "./helpers";

function toSaturday(base: Date): Date {
  const d = new Date(base.getTime());
  const diff = (6 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

const provider = createDemoProvider("trading-test-seed");

beforeEach(async () => {
  await resetDb();
});

describe("kjøp og salg", () => {
  it("fyller et kjøp, trekker kontanter inkl. kurtasje/slippage, og oppretter en posisjon", async () => {
    const user = await createUser();
    await createInstrument("FJRD");
    const account = await createAccount(user.id, "DEMO", 100_000);

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "FJRD", side: "BUY", quantity: 10, idempotencyKey: "k1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("FILLED");
    expect(order.fillPrice).not.toBeNull();

    const updatedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    const expectedTotal = order.totalAmount as Decimal;
    expect(updatedAccount.cashBalance.toString()).toBe(new Decimal(100_000).sub(expectedTotal).toString());

    const position = await prisma.position.findFirst({ where: { accountId: account.id } });
    expect(position?.quantity).toBe(10);

    const ledgerSum = (await prisma.cashLedgerEntry.findMany({ where: { accountId: account.id } })).reduce(
      (sum, entry) => sum.add(entry.amount),
      new Decimal(0)
    );
    expect(ledgerSum.toString()).toBe(updatedAccount.cashBalance.toString());
  });

  it("fyller et salg og øker kontantsaldoen", async () => {
    const user = await createUser();
    const instrument = await createInstrument("NORL");
    const account = await createAccount(user.id, "DEMO", 100_000);
    await prisma.position.create({ data: { accountId: account.id, instrumentId: instrument.id, quantity: 20, avgCost: new Decimal(50) } });

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "NORL", side: "SELL", quantity: 5, idempotencyKey: "s1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("FILLED");
    const position = await prisma.position.findFirst({ where: { accountId: account.id } });
    expect(position?.quantity).toBe(15);
  });

  it("sletter posisjonen når hele beholdningen selges", async () => {
    const user = await createUser();
    const instrument = await createInstrument("BREK");
    const account = await createAccount(user.id, "DEMO", 100_000);
    await prisma.position.create({ data: { accountId: account.id, instrumentId: instrument.id, quantity: 3, avgCost: new Decimal(10) } });

    await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "BREK", side: "SELL", quantity: 3, idempotencyKey: "sa1" },
      { provider, now: () => FIXED_NOW }
    );

    const position = await prisma.position.findFirst({ where: { accountId: account.id } });
    expect(position).toBeNull();
  });
});

describe("manglende dekning", () => {
  it("avviser kjøp uten tilstrekkelig dekning uten å endre saldo eller posisjon", async () => {
    const user = await createUser();
    await createInstrument("TIND");
    const account = await createAccount(user.id, "DEMO", 1);

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "TIND", side: "BUY", quantity: 100, idempotencyKey: "poor1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toMatch(/dekning/i);
    const acc2 = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(acc2.cashBalance.toString()).toBe("1");
    const position = await prisma.position.findFirst({ where: { accountId: account.id } });
    expect(position).toBeNull();
  });

  it("avviser salg av flere aksjer enn man eier", async () => {
    const user = await createUser();
    const instrument = await createInstrument("HAVN");
    const account = await createAccount(user.id, "DEMO", 100_000);
    await prisma.position.create({ data: { accountId: account.id, instrumentId: instrument.id, quantity: 2, avgCost: new Decimal(10) } });

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "HAVN", side: "SELL", quantity: 5, idempotencyKey: "few1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toMatch(/aksjer/i);
    const position = await prisma.position.findFirst({ where: { accountId: account.id } });
    expect(position?.quantity).toBe(2);
  });
});

describe("samtidige ordre", () => {
  it("lar bare ett av to samtidige salg som til sammen overstiger beholdningen gå gjennom", async () => {
    const user = await createUser();
    const instrument = await createInstrument("FOSS");
    const account = await createAccount(user.id, "DEMO", 100_000);
    await prisma.position.create({ data: { accountId: account.id, instrumentId: instrument.id, quantity: 100, avgCost: new Decimal(10) } });

    const [a, b] = await Promise.all([
      placeOrder({ accountId: account.id, userId: user.id, ticker: "FOSS", side: "SELL", quantity: 60, idempotencyKey: "race-a" }, { provider, now: () => FIXED_NOW }),
      placeOrder({ accountId: account.id, userId: user.id, ticker: "FOSS", side: "SELL", quantity: 60, idempotencyKey: "race-b" }, { provider, now: () => FIXED_NOW }),
    ]);

    expect([a.status, b.status].sort()).toEqual(["FILLED", "REJECTED"]);
    const position = await prisma.position.findFirst({ where: { accountId: account.id } });
    expect(position?.quantity).toBe(40);
  });

  it("lar bare ett av to samtidige kjøp som til sammen overstiger dekningen gå gjennom", async () => {
    await createInstrument("LYNG");
    const observation = provider.getNextObservationAfter("LYNG", FIXED_NOW).observation;
    const tradeValue = new Decimal(observation.price).mul(100);
    const feeEstimate = tradeValue.mul(0.001).add(39);
    const totalCostEstimate = tradeValue.add(feeEstimate);

    const buyer = await createUser();
    const account = await createAccount(buyer.id, "DEMO", totalCostEstimate.mul(1.5).toNumber());

    const [a, b] = await Promise.all([
      placeOrder({ accountId: account.id, userId: buyer.id, ticker: "LYNG", side: "BUY", quantity: 100, idempotencyKey: "buy-race-a" }, { provider, now: () => FIXED_NOW }),
      placeOrder({ accountId: account.id, userId: buyer.id, ticker: "LYNG", side: "BUY", quantity: 100, idempotencyKey: "buy-race-b" }, { provider, now: () => FIXED_NOW }),
    ]);

    expect([a.status, b.status].sort()).toEqual(["FILLED", "REJECTED"]);
    const finalAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    expect(finalAccount.cashBalance.greaterThanOrEqualTo(0)).toBe(true);
  });
});

describe("duplikatforespørsler (idempotens)", () => {
  it("returnerer samme ordre ved gjentatt kall med samme idempotensnøkkel", async () => {
    const user = await createUser();
    await createInstrument("HAVN");
    const account = await createAccount(user.id, "DEMO", 100_000);

    const first = await placeOrder({ accountId: account.id, userId: user.id, ticker: "HAVN", side: "BUY", quantity: 4, idempotencyKey: "same-key" }, { provider, now: () => FIXED_NOW });
    const second = await placeOrder({ accountId: account.id, userId: user.id, ticker: "HAVN", side: "BUY", quantity: 4, idempotencyKey: "same-key" }, { provider, now: () => FIXED_NOW });

    expect(second.id).toBe(first.id);
    expect(await prisma.order.count({ where: { accountId: account.id } })).toBe(1);
  });

  it("returnerer samme ordre ved samtidige kall med samme idempotensnøkkel", async () => {
    const user = await createUser();
    await createInstrument("RYFYL");
    const account = await createAccount(user.id, "DEMO", 100_000);

    const [a, b] = await Promise.all([
      placeOrder({ accountId: account.id, userId: user.id, ticker: "RYFYL", side: "BUY", quantity: 2, idempotencyKey: "concurrent-key" }, { provider, now: () => FIXED_NOW }),
      placeOrder({ accountId: account.id, userId: user.id, ticker: "RYFYL", side: "BUY", quantity: 2, idempotencyKey: "concurrent-key" }, { provider, now: () => FIXED_NOW }),
    ]);

    expect(a.id).toBe(b.id);
    expect(await prisma.order.count({ where: { accountId: account.id } })).toBe(1);
  });

  it("kaster en tydelig feil hvis nøkkelen gjenbrukes for en annen ordre", async () => {
    const user = await createUser();
    await createInstrument("KVAL");
    await createInstrument("SOLA");
    const account = await createAccount(user.id, "DEMO", 100_000);

    await placeOrder({ accountId: account.id, userId: user.id, ticker: "KVAL", side: "BUY", quantity: 1, idempotencyKey: "reused" }, { provider, now: () => FIXED_NOW });

    await expect(
      placeOrder({ accountId: account.id, userId: user.id, ticker: "SOLA", side: "BUY", quantity: 1, idempotencyKey: "reused" }, { provider, now: () => FIXED_NOW })
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});

describe("tilgangskontroll", () => {
  it("nekter å plassere ordre på en konto som tilhører en annen bruker", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    await createInstrument("VEKST");
    const account = await createAccount(owner.id, "DEMO", 100_000);

    await expect(
      placeOrder({ accountId: account.id, userId: intruder.id, ticker: "VEKST", side: "BUY", quantity: 1, idempotencyKey: "intrude" }, { provider, now: () => FIXED_NOW })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("nekter å kansellere en ordre som tilhører en annen bruker", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const account = await createAccount(owner.id, "DEMO", 100_000);
    const instrument = await createInstrument("FONN");
    const order = await prisma.order.create({
      data: { accountId: account.id, instrumentId: instrument.id, side: "BUY", quantity: 1, status: "PENDING", idempotencyKey: "pending-1" },
    });

    await expect(cancelOrder(order.id, intruder.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("nekter handel på en LIVE_READONLY-konto", async () => {
    const user = await createUser();
    await createInstrument("RYFYL");
    const account = await createAccount(user.id, "LIVE_READONLY", 100_000);

    await expect(
      placeOrder({ accountId: account.id, userId: user.id, ticker: "RYFYL", side: "BUY", quantity: 1, idempotencyKey: "live1" }, { provider, now: () => FIXED_NOW })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("nekter handel på en PAPER-konto siden ingen ekte leverandør er koblet til ennå", async () => {
    const user = await createUser();
    await createInstrument("KVAL");
    const account = await createAccount(user.id, "PAPER", 100_000);

    // Ingen `provider`-override her — placeOrder skal selv forsøke å slå
    // opp PAPER-leverandøren og feile tydelig.
    await expect(
      placeOrder({ accountId: account.id, userId: user.id, ticker: "KVAL", side: "BUY", quantity: 1, idempotencyKey: "paper1" }, { now: () => FIXED_NOW })
    ).rejects.toThrow(/ingen ekte markedsdataleverandør/i);
  });
});

describe("forsinkede kurser / ingen fremtidsinformasjon", () => {
  it("fyller aldri til en kjent/gammel kurs — observasjonen er alltid etter mottakstidspunktet", async () => {
    const user = await createUser();
    await createInstrument("SOLA");
    const account = await createAccount(user.id, "DEMO", 100_000);

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "SOLA", side: "BUY", quantity: 1, idempotencyKey: "late1" },
      { provider, now: () => FIXED_NOW }
    );

    expect(order.status).toBe("FILLED");
    expect((order.fillPriceObservedAt as Date).getTime()).toBeGreaterThan(FIXED_NOW.getTime());
  });

  it("utløper ordren dersom neste kursobservasjon ligger utenfor maksimal ventetid", async () => {
    const user = await createUser();
    await createInstrument("VEKST");
    const account = await createAccount(user.id, "DEMO", 100_000);

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "VEKST", side: "BUY", quantity: 1, idempotencyKey: "slow1" },
      { provider, now: () => FIXED_NOW, maxWaitMs: 1 }
    );

    expect(order.status).toBe("EXPIRED");
  });

  it("avviser handel når markedet er stengt (helg)", async () => {
    const user = await createUser();
    await createInstrument("FONN");
    const account = await createAccount(user.id, "DEMO", 100_000);
    const saturday = toSaturday(FIXED_NOW);

    const order = await placeOrder(
      { accountId: account.id, userId: user.id, ticker: "FONN", side: "BUY", quantity: 1, idempotencyKey: "wk1" },
      { provider, now: () => saturday }
    );

    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toMatch(/stengt/i);
  });
});
