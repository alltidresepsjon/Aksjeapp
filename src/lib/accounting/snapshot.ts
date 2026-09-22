import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import { getProviderForMode } from "@/lib/market";
import type { MarketDataProvider } from "@/lib/market/types";
import { valuePortfolioAt } from "./reconstruct";
import { isWeekday, previousPureDate, tradingDayCloseInstant } from "./oslo-time";
import type { DailySnapshot } from "@prisma/client";

function lastWeekdayAtOrBefore(pureDate: Date): Date {
  const d = new Date(pureDate.getTime());
  while (!isWeekday(d)) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

interface TradeStats {
  realizedPnl: InstanceType<typeof Decimal>;
  costs: InstanceType<typeof Decimal>;
  tradeCount: number;
}

/**
 * Realisert resultat (BRUTTO, før kostnader — kostnader telles separat for
 * å unngå dobbelttelling) og totale kostnader for fylte ordre i vinduet
 * (fromExclusive, toInclusive]. Går gjennom HELE ordrehistorikken frem til
 * `toInclusive` for å kjenne riktig snittkost på salgstidspunktet, ikke
 * bare denne dagens ordre.
 */
async function computeDayTradeStats(
  accountId: string,
  fromExclusive: Date,
  toInclusive: Date
): Promise<TradeStats> {
  const fills = await prisma.order.findMany({
    where: { accountId, status: "FILLED", filledAt: { lte: toInclusive } },
    orderBy: { filledAt: "asc" },
  });

  const avgCostByInstrument = new Map<string, { quantity: number; avgCost: InstanceType<typeof Decimal> }>();
  let realizedPnl = new Decimal(0);
  let costs = new Decimal(0);
  let tradeCount = 0;

  for (const fill of fills) {
    const inWindow = fill.filledAt!.getTime() > fromExclusive.getTime() && fill.filledAt!.getTime() <= toInclusive.getTime();
    const fillPrice = fill.fillPrice as InstanceType<typeof Decimal>;
    const feeAmount = fill.feeAmount as InstanceType<typeof Decimal>;
    const existing = avgCostByInstrument.get(fill.instrumentId);

    if (fill.side === "BUY") {
      const totalCost = fillPrice.mul(fill.quantity).add(feeAmount);
      const costPerShare = totalCost.div(fill.quantity);
      if (existing) {
        const totalQty = existing.quantity + fill.quantity;
        const newAvgCost = existing.avgCost.mul(existing.quantity).add(costPerShare.mul(fill.quantity)).div(totalQty);
        avgCostByInstrument.set(fill.instrumentId, { quantity: totalQty, avgCost: newAvgCost });
      } else {
        avgCostByInstrument.set(fill.instrumentId, { quantity: fill.quantity, avgCost: costPerShare });
      }
    } else if (existing) {
      const grossPnl = fillPrice.sub(existing.avgCost).mul(fill.quantity);
      const remaining = existing.quantity - fill.quantity;
      if (remaining <= 0) avgCostByInstrument.delete(fill.instrumentId);
      else avgCostByInstrument.set(fill.instrumentId, { ...existing, quantity: remaining });

      if (inWindow) realizedPnl = realizedPnl.add(grossPnl);
    }

    if (inWindow) {
      costs = costs.add(feeAmount);
      tradeCount += 1;
    }
  }

  return { realizedPnl, costs, tradeCount };
}

/**
 * Beregner (og lagrer) ett dagssnapshot for én konto. Ren, idempotent
 * beregning — kan trygt kjøres på nytt for samme dag uten
 * dobbelttelling, og inneholder INGEN AI/språkmodell-logikk.
 *
 * Konvensjon for realisert/urealisert-splitten (dokumentert forenkling):
 * `dayResult` er ALLTID den autoritative verdien (endring i porteføljeverdi
 * justert for innskudd/uttak). `realizedPnl` beregnes brutto (før
 * kostnader) fra faktiske salg. `unrealizedPnlChange` er resten:
 * dayResult - realizedPnl + costs. Dette garanterer at komponentene alltid
 * summerer nøyaktig til dagsresultatet.
 */
export async function computeDailySnapshot(
  accountId: string,
  tradingDate: Date,
  providerOverride?: MarketDataProvider
): Promise<DailySnapshot> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  // Datakilden følger kontoens modus — se src/lib/market/index.ts.
  const provider = providerOverride ?? getProviderForMode(account.mode);

  const marketClosed = !isWeekday(tradingDate);
  const effectiveDate = marketClosed ? lastWeekdayAtOrBefore(tradingDate) : tradingDate;
  const closeInstant = tradingDayCloseInstant(effectiveDate);
  const prevTradingDay = marketClosed ? effectiveDate : lastWeekdayAtOrBefore(previousPureDate(effectiveDate));
  const prevCloseInstant = tradingDayCloseInstant(prevTradingDay);

  // Bootstrap for kontoens aller første dag: det finnes ingen "forrige
  // stengetid" før kontoen i det hele tatt eksisterte.
  const startInstant = prevCloseInstant.getTime() < account.createdAt.getTime() ? account.createdAt : prevCloseInstant;
  const endInstant = closeInstant.getTime() < account.createdAt.getTime() ? account.createdAt : closeInstant;

  const [startValuation, endValuation, netDepositsAgg, tradeStats] = await Promise.all([
    valuePortfolioAt(accountId, startInstant, provider),
    valuePortfolioAt(accountId, endInstant, provider),
    prisma.cashLedgerEntry.aggregate({
      where: {
        accountId,
        type: { in: ["DEPOSIT", "WITHDRAWAL"] },
        createdAt: { gt: startInstant, lte: endInstant },
      },
      _sum: { amount: true },
    }),
    computeDayTradeStats(accountId, startInstant, endInstant),
  ]);

  const netDeposits = netDepositsAgg._sum.amount ?? new Decimal(0);
  const dayResult = endValuation.value.sub(startValuation.value).sub(netDeposits);
  const unrealizedPnlChange = dayResult.sub(tradeStats.realizedPnl).add(tradeStats.costs);
  const dataIncomplete = startValuation.hasMissingPrices || endValuation.hasMissingPrices;

  const benchmarkStart = provider.getLatestBenchmark(startInstant);
  const benchmarkEnd = provider.getLatestBenchmark(endInstant);

  return prisma.dailySnapshot.upsert({
    where: { accountId_tradingDate: { accountId, tradingDate } },
    create: {
      accountId,
      tradingDate,
      startValue: startValuation.value,
      endValue: endValuation.value,
      netDeposits,
      realizedPnl: tradeStats.realizedPnl,
      unrealizedPnlChange,
      costs: tradeStats.costs,
      dayResult,
      tradeCount: tradeStats.tradeCount,
      marketClosed,
      dataIncomplete,
      benchmarkStartValue: benchmarkStart ? new Decimal(benchmarkStart.value) : null,
      benchmarkEndValue: benchmarkEnd ? new Decimal(benchmarkEnd.value) : null,
    },
    update: {
      startValue: startValuation.value,
      endValue: endValuation.value,
      netDeposits,
      realizedPnl: tradeStats.realizedPnl,
      unrealizedPnlChange,
      costs: tradeStats.costs,
      dayResult,
      tradeCount: tradeStats.tradeCount,
      marketClosed,
      dataIncomplete,
      benchmarkStartValue: benchmarkStart ? new Decimal(benchmarkStart.value) : null,
      benchmarkEndValue: benchmarkEnd ? new Decimal(benchmarkEnd.value) : null,
    },
  });
}

/**
 * Sikrer at det finnes (ferske) dagssnapshots for alle dager fra kontoens
 * opprettelse til og med `throughDate`. Trygt å kalle gjentatte ganger —
 * hver dag beregnes uavhengig og idempotent.
 */
export async function ensureSnapshotsThrough(
  accountId: string,
  throughDate: Date,
  providerOverride?: MarketDataProvider
): Promise<void> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  const provider = providerOverride ?? getProviderForMode(account.mode);
  const firstDate = new Date(
    Date.UTC(account.createdAt.getUTCFullYear(), account.createdAt.getUTCMonth(), account.createdAt.getUTCDate())
  );

  const cursor = new Date(firstDate.getTime());
  const dates: Date[] = [];
  while (cursor.getTime() <= throughDate.getTime()) {
    dates.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Sekvensielt, ikke parallelt — hver dag bygger konseptuelt videre på
  // forrige (selv om beregningen selv er uavhengig per dag), og vi unngår
  // å presse databasen med mange samtidige tunge spørringer.
  for (const date of dates) {
    await computeDailySnapshot(accountId, date, provider);
  }
}
