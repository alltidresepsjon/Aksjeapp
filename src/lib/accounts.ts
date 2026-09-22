import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import {
  ensureSnapshotsThrough,
  todayOsloPureDate,
  cumulativeValueSeries,
  maxDrawdownPercent,
  periodReturnPercent,
  sinceInceptionReturnPercent,
  reconstructPositionsAt,
} from "@/lib/accounting";
import { getProviderForMode } from "@/lib/market";

export async function getAccountSummary(accountId: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new NotFoundError("Fant ikke kontoen.");
  if (account.userId !== userId) throw new ForbiddenError();

  if (account.mode === "LIVE_READONLY") {
    return { account, supported: false as const };
  }

  let providerAvailable = true;
  try {
    getProviderForMode(account.mode);
  } catch {
    providerAvailable = false;
  }

  if (!providerAvailable) {
    // PAPER uten koblet leverandør ennå — ikke lat som om vi har tall.
    return { account, supported: false as const, dataSourceMissing: true as const };
  }

  const today = todayOsloPureDate();
  await ensureSnapshotsThrough(accountId, today);

  const snapshots = await prisma.dailySnapshot.findMany({
    where: { accountId },
    orderBy: { tradingDate: "asc" },
  });

  const series = cumulativeValueSeries(account.startingCapital, snapshots);
  const latest = series[series.length - 1];
  const totalValue = latest?.value ?? account.startingCapital;

  const provider = getProviderForMode(account.mode);
  const positions = await reconstructPositionsAt(accountId, new Date());
  let positionsValue = new Decimal(0);
  for (const p of positions.values()) {
    const obs = provider.getLatestObservation(p.ticker, new Date());
    if (obs) positionsValue = positionsValue.add(new Decimal(obs.price).mul(p.quantity));
  }

  return {
    account,
    supported: true as const,
    totalValue,
    cashBalance: account.cashBalance,
    positionsValue,
    positionCount: positions.size,
    sinceInceptionPercent: sinceInceptionReturnPercent(account.startingCapital, snapshots),
    lastDayPercent: periodReturnPercent(snapshots, 1),
    lastWeekPercent: periodReturnPercent(snapshots, 5),
    lastMonthPercent: periodReturnPercent(snapshots, 21),
    maxDrawdownPercent: maxDrawdownPercent(series),
    latestSnapshot: snapshots[snapshots.length - 1] ?? null,
    snapshotCount: snapshots.length,
  };
}

export async function listUserAccounts(userId: string) {
  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return Promise.all(accounts.map((a) => getAccountSummary(a.id, userId)));
}
