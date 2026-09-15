import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";

// Fast, deterministisk "nå"-tidspunkt for tester: en onsdag (ingen helg),
// slik at MockProvider.isMarketOpen ikke avhenger av hvilken ukedag testene
// faktisk kjøres på. MARKET_OPEN_HOUR/CLOSE_HOUR er satt til hele døgnet i
// vitest.config.ts, så bare ukedagen spiller noen rolle her.
function nextWeekday(date: Date, targetUtcDay: number): Date {
  const d = new Date(date.getTime());
  const diff = (targetUtcDay - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}
export const FIXED_NOW = nextWeekday(new Date("2025-01-01T10:00:00Z"), 3); // 3 = onsdag

let userCounter = 0;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "cash_ledger_entries","orders","holdings","price_ticks","stocks","accounts","seasons","league_memberships","leagues","users" RESTART IDENTITY CASCADE;`
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

export async function createStock(ticker: string, name = ticker) {
  return prisma.stock.upsert({
    where: { ticker },
    update: {},
    create: { ticker, name, currency: "NOK" },
  });
}

export async function createPracticeAccount(userId: string, cash: number | string = 100_000) {
  const cashBalance = new Decimal(cash);
  const account = await prisma.account.create({
    data: { userId, seasonId: null, cashBalance },
  });
  await prisma.cashLedgerEntry.create({
    data: {
      accountId: account.id,
      type: "INITIAL_DEPOSIT",
      amount: cashBalance,
      balanceAfter: cashBalance,
    },
  });
  return account;
}

export async function createSeasonAccount(
  userId: string,
  season: { id: string; startingCash: InstanceType<typeof Decimal> }
) {
  const account = await prisma.account.create({
    data: { userId, seasonId: season.id, cashBalance: season.startingCash },
  });
  await prisma.cashLedgerEntry.create({
    data: {
      accountId: account.id,
      type: "INITIAL_DEPOSIT",
      amount: season.startingCash,
      balanceAfter: season.startingCash,
    },
  });
  return account;
}
