import { prisma } from "@/lib/prisma";
import { Decimal } from "@/lib/money";
import type { MarketDataProvider } from "@/lib/market/types";

export interface ReconstructedPosition {
  instrumentId: string;
  ticker: string;
  quantity: number;
  avgCost: InstanceType<typeof Decimal>;
}

/**
 * Rekonstruerer posisjonene på en konto på et vilkårlig historisk
 * tidspunkt, ved å spille av alle FYLTE ordre frem til og med `at`. Dette
 * gir et korrekt punkt-i-tid-øyeblikksbilde uten en egen hendelseslogg for
 * posisjoner — `Position`-tabellen holder kun gjeldende tilstand (brukt
 * under selve handelen), mens historikk alltid utledes fra `Order`.
 */
export async function reconstructPositionsAt(
  accountId: string,
  at: Date
): Promise<Map<string, ReconstructedPosition>> {
  const fills = await prisma.order.findMany({
    where: { accountId, status: "FILLED", filledAt: { lte: at } },
    orderBy: { filledAt: "asc" },
    include: { instrument: true },
  });

  const positions = new Map<string, ReconstructedPosition>();
  for (const fill of fills) {
    const existing = positions.get(fill.instrumentId);
    const fillPrice = fill.fillPrice as InstanceType<typeof Decimal>;
    const feeAmount = fill.feeAmount as InstanceType<typeof Decimal>;

    if (fill.side === "BUY") {
      const totalCost = fillPrice.mul(fill.quantity).add(feeAmount);
      const costPerShare = totalCost.div(fill.quantity);
      if (existing) {
        const totalQty = existing.quantity + fill.quantity;
        const newAvgCost = existing.avgCost
          .mul(existing.quantity)
          .add(costPerShare.mul(fill.quantity))
          .div(totalQty);
        positions.set(fill.instrumentId, { ...existing, quantity: totalQty, avgCost: newAvgCost });
      } else {
        positions.set(fill.instrumentId, {
          instrumentId: fill.instrumentId,
          ticker: fill.instrument.ticker,
          quantity: fill.quantity,
          avgCost: costPerShare,
        });
      }
    } else {
      if (!existing) continue; // skal ikke skje (validert ved utførelse), men vær defensiv
      const remaining = existing.quantity - fill.quantity;
      if (remaining <= 0) {
        positions.delete(fill.instrumentId);
      } else {
        positions.set(fill.instrumentId, { ...existing, quantity: remaining });
      }
    }
  }
  return positions;
}

/** Kontantsaldo på et vilkårlig historisk tidspunkt, lest fra ledger. */
export async function cashBalanceAt(accountId: string, at: Date): Promise<InstanceType<typeof Decimal>> {
  const entry = await prisma.cashLedgerEntry.findFirst({
    where: { accountId, createdAt: { lte: at } },
    orderBy: { createdAt: "desc" },
  });
  return entry ? entry.balanceAfter : new Decimal(0);
}

export interface ValuationResult {
  value: InstanceType<typeof Decimal>;
  positions: Map<string, ReconstructedPosition>;
  hasMissingPrices: boolean;
}

/**
 * Full porteføljeverdi (kontanter + markedsverdi av posisjoner) på et
 * historisk tidspunkt. Manglende prisdata for en posisjon FLAGGES
 * (`hasMissingPrices`) og holdes utenfor summen — verdsettes ALDRI til 0.
 */
export async function valuePortfolioAt(
  accountId: string,
  at: Date,
  provider: MarketDataProvider
): Promise<ValuationResult> {
  const [cash, positions] = await Promise.all([
    cashBalanceAt(accountId, at),
    reconstructPositionsAt(accountId, at),
  ]);

  let positionsValue = new Decimal(0);
  let hasMissingPrices = false;
  for (const position of positions.values()) {
    const observation = provider.getLatestObservation(position.ticker, at);
    if (!observation) {
      hasMissingPrices = true;
      continue;
    }
    positionsValue = positionsValue.add(new Decimal(observation.price).mul(position.quantity));
  }

  return { value: cash.add(positionsValue), positions, hasMissingPrices };
}
