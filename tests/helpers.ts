import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";

// Fast, deterministisk "nå"-tidspunkt for tester: en onsdag (ingen helg),
// klokken 12 UTC (godt innenfor markedets åpningstider i Europe/Oslo både
// sommer- og vintertid), slik at tester aldri avhenger av hvilken ukedag
// eller time de faktisk kjøres.
function nextWeekday(date: Date, targetUtcDay: number): Date {
  const d = new Date(date.getTime());
  const diff = (targetUtcDay - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}
export const FIXED_NOW = nextWeekday(new Date("2025-06-01T12:00:00Z"), 3); // 3 = onsdag

let userCounter = 0;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "cash_ledger_entries","orders","positions","price_observations","benchmark_observations","daily_snapshots","system_events","system_settings","instruments","accounts","users" RESTART IDENTITY CASCADE;`
  );
  userCounter = 0;
}

export async function createUser(overrides: { displayName?: string } = {}) {
  userCounter += 1;
  return prisma.user.create({
    data: {
      email: `test-user-${userCounter}@example.test`,
      passwordHash: "not-used-in-tests",
      displayName: overrides.displayName ?? `Testbruker ${userCounter}`,
    },
  });
}

export async function createInstrument(ticker: string, overrides: { name?: string; exchange?: string } = {}) {
  const exchange = overrides.exchange ?? "DEMO";
  return prisma.instrument.upsert({
    where: { ticker_exchange: { ticker, exchange } },
    update: {},
    create: { ticker, name: overrides.name ?? ticker, exchange, currency: "NOK" },
  });
}

export async function createAccount(
  userId: string,
  mode: "DEMO" | "PAPER" | "LIVE_READONLY" = "DEMO",
  cash: number | string = 100_000,
  createdAt?: Date
) {
  const cashBalance = new Decimal(cash);
  const account = await prisma.account.create({
    data: {
      userId,
      mode,
      baseCurrency: "NOK",
      startingCapital: cashBalance,
      cashBalance,
      ...(createdAt ? { createdAt } : {}),
    },
  });
  await prisma.cashLedgerEntry.create({
    data: {
      accountId: account.id,
      type: "DEPOSIT",
      amount: cashBalance,
      balanceAfter: cashBalance,
      createdAt: createdAt ?? account.createdAt,
    },
  });
  return account;
}
