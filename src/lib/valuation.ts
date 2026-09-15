import { Decimal } from "@/lib/money";
import type { MarketDataProvider } from "@/lib/market/types";

export interface HoldingLike {
  quantity: number;
  stock: { ticker: string };
}

export interface ValuationResult {
  value: InstanceType<typeof Decimal>;
  // Én eller flere beholdninger manglet en prisobservasjon på
  // tidspunktet — de er IKKE regnet som 0, men holdt utenfor summen, og
  // kallere MÅ vise dette tydelig fremfor å behandle verdien som eksakt.
  hasMissingPrices: boolean;
}

export function valuateHoldings(
  holdings: HoldingLike[],
  provider: MarketDataProvider,
  at: Date
): ValuationResult {
  let value = new Decimal(0);
  let hasMissingPrices = false;

  for (const holding of holdings) {
    const observation = provider.getLatestObservation(holding.stock.ticker, at);
    if (!observation) {
      hasMissingPrices = true;
      continue;
    }
    value = value.add(new Decimal(observation.price).mul(holding.quantity));
  }

  return { value, hasMissingPrices };
}
