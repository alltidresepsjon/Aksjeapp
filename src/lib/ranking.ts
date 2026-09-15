import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { getMarketDataProvider } from "@/lib/market";
import type { MarketDataProvider } from "@/lib/market/types";
import { valuateHoldings } from "@/lib/valuation";

export interface LeaderboardEntry {
  accountId: string;
  userId: string;
  displayName: string;
  cashBalance: InstanceType<typeof Decimal>;
  holdingsValue: InstanceType<typeof Decimal>;
  totalValue: InstanceType<typeof Decimal>;
  startingCash: InstanceType<typeof Decimal>;
  returnPercent: InstanceType<typeof Decimal>;
  // Én eller flere beholdninger manglet en prisobservasjon på
  // verdsettelsestidspunktet — totalverdien/avkastningen er da et
  // MINIMUMSANSLAG (manglende poster telles ikke som 0, men er heller ikke
  // medregnet), og raden skal markeres tydelig i UI, ikke behandles som en
  // eksakt, sammenlignbar verdi.
  hasMissingPrices: boolean;
  rank: number;
}

export interface LeaderboardResult {
  asOf: Date;
  entries: LeaderboardEntry[];
}

/**
 * Beregner resultatlisten for en sesong. Alle deltakere verdsettes mot
 * NØYAKTIG samme tidspunkt (`asOf`), hentet fra
 * MarketDataProvider.getValuationTimestamp, slik at ingen sammenlignes mot
 * en annen (nyere/eldre) kurs enn de andre.
 */
export async function computeLeaderboard(
  seasonId: string,
  options: { at?: Date; provider?: MarketDataProvider } = {}
): Promise<LeaderboardResult> {
  const provider = options.provider ?? getMarketDataProvider();
  const asOf = provider.getValuationTimestamp(options.at ?? new Date());

  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const accounts = await prisma.account.findMany({
    where: { seasonId },
    include: { user: true, holdings: { include: { stock: true } } },
  });

  const unranked = accounts.map((account) => {
    const { value: holdingsValue, hasMissingPrices } = valuateHoldings(
      account.holdings,
      provider,
      asOf
    );

    const totalValue = account.cashBalance.add(holdingsValue);
    const returnPercent = totalValue.sub(season.startingCash).div(season.startingCash).mul(100);

    return {
      accountId: account.id,
      userId: account.userId,
      displayName: account.user.displayName,
      cashBalance: account.cashBalance,
      holdingsValue,
      totalValue,
      startingCash: season.startingCash,
      returnPercent,
      hasMissingPrices,
    };
  });

  unranked.sort((a, b) => b.returnPercent.comparedTo(a.returnPercent));

  return {
    asOf,
    entries: unranked.map((entry, index) => ({ ...entry, rank: index + 1 })),
  };
}
