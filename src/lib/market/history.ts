import type { MarketDataProvider } from "./types";

export interface PricePoint {
  observedAt: Date;
  price: number;
}

// Provider-agnostisk historikk: sampler jevnt fordelte punkter i [from, to]
// via getLatestObservation — fungerer med enhver MarketDataProvider.
export function samplePriceHistory(
  provider: MarketDataProvider,
  ticker: string,
  from: Date,
  to: Date,
  points: number
): PricePoint[] {
  const stepMs = (to.getTime() - from.getTime()) / Math.max(points - 1, 1);
  const result: PricePoint[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < points; i++) {
    const t = new Date(from.getTime() + i * stepMs);
    const observation = provider.getLatestObservation(ticker, t);
    if (!observation) continue;
    const key = observation.observedAt.getTime();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ observedAt: observation.observedAt, price: Number(observation.price) });
  }
  return result;
}
