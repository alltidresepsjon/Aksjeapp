import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { env } from "@/lib/env";
import { getMarketDataProvider } from "@/lib/market";
import { valuateHoldings } from "@/lib/valuation";
import { getSeasonStatus } from "@/lib/leagues";
import { ForbiddenError, NotFoundError } from "@/lib/trading/errors";

const PRACTICE_BASELINE = new Decimal(env.STARTING_CASH_NOK);

export async function listUserAccounts(userId: string) {
  const provider = getMarketDataProvider();
  const now = new Date();
  const asOf = provider.getValuationTimestamp(now);

  const accounts = await prisma.account.findMany({
    where: { userId },
    include: {
      holdings: { include: { stock: true } },
      season: { include: { league: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return accounts.map((account) => {
    const { value: holdingsValue, hasMissingPrices } = valuateHoldings(
      account.holdings,
      provider,
      asOf
    );
    const totalValue = account.cashBalance.add(holdingsValue);
    const startingCash = account.season?.startingCash ?? PRACTICE_BASELINE;
    const returnPercent = totalValue.sub(startingCash).div(startingCash).mul(100);

    return {
      account,
      isPractice: account.seasonId === null,
      league: account.season?.league ?? null,
      season: account.season ?? null,
      seasonStatus: account.season ? getSeasonStatus(account.season, now) : null,
      holdingsValue,
      totalValue,
      startingCash,
      returnPercent,
      hasMissingPrices,
      asOf,
    };
  });
}

export async function getAccountDetail(accountId: string, userId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      holdings: { include: { stock: true }, orderBy: { updatedAt: "desc" } },
      season: { include: { league: true } },
      orders: {
        include: { stock: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!account) throw new NotFoundError("Fant ikke kontoen.");
  if (account.userId !== userId) throw new ForbiddenError();

  const provider = getMarketDataProvider();
  const now = new Date();
  const asOf = provider.getValuationTimestamp(now);

  const holdingsWithValue = account.holdings.map((holding) => {
    const observation = provider.getLatestObservation(holding.stock.ticker, asOf);
    const price = observation ? new Decimal(observation.price) : null;
    const marketValue = price ? price.mul(holding.quantity) : null;
    const costBasis = holding.avgCost.mul(holding.quantity);
    const gain = marketValue ? marketValue.sub(costBasis) : null;
    const gainPercent = gain && !costBasis.isZero() ? gain.div(costBasis).mul(100) : null;
    return { holding, price, marketValue, costBasis, gain, gainPercent };
  });

  const { value: holdingsValue, hasMissingPrices } = valuateHoldings(
    account.holdings,
    provider,
    asOf
  );
  const totalValue = account.cashBalance.add(holdingsValue);
  const startingCash = account.season?.startingCash ?? PRACTICE_BASELINE;
  const returnPercent = totalValue.sub(startingCash).div(startingCash).mul(100);

  return {
    account,
    holdingsWithValue,
    holdingsValue,
    totalValue,
    startingCash,
    returnPercent,
    hasMissingPrices,
    asOf,
    seasonStatus: account.season ? getSeasonStatus(account.season, now) : null,
  };
}
