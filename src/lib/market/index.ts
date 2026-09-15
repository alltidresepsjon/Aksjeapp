import { env } from "@/lib/env";
import { createMockProvider } from "./mock-provider";
import type { MarketDataProvider } from "./types";

export type { MarketDataProvider, PriceObservation } from "./types";
export { SEED_STOCKS } from "./seed-stocks";

let cached: MarketDataProvider | undefined;

// Eneste sted i appen som velger konkret MarketDataProvider-implementasjon.
// For å koble til en ekte leverandør: implementer MarketDataProvider (se
// ./types.ts) og legg den til her bak en ny MARKET_DATA_PROVIDER-verdi.
// Se docs/marketdata.md for kravene til en slik leverandør.
export function getMarketDataProvider(): MarketDataProvider {
  if (!cached) {
    switch (env.MARKET_DATA_PROVIDER) {
      case "mock":
      default:
        cached = createMockProvider();
    }
  }
  return cached;
}
