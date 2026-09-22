import { createDemoProvider } from "./demo-provider";
import type { MarketDataProvider } from "./types";
import type { AccountMode } from "@prisma/client";

export type { MarketDataProvider, PriceObservation, BenchmarkPoint, InstrumentSpec } from "./types";
export { DEMO_INSTRUMENTS, DEMO_EXCHANGE, DEMO_BENCHMARK_KEY } from "./demo-instruments";

let demoCached: MarketDataProvider | undefined;

/**
 * Eneste sted i appen som velger konkret MarketDataProvider — valget følger
 * KONTOENS modus (DEMO/PAPER/LIVE_READONLY), ikke en global app-innstilling,
 * siden en bruker kan ha begge kontotyper samtidig med ulik datakilde.
 *
 * En ekte PAPER-leverandør kobles inn her når den faktisk er implementert
 * og testet — se docs/dataleverandorer.md. Faller ALDRI stille tilbake til
 * DEMO; feiler heller tydelig, slik at en manglende integrasjon aldri
 * fremstår som fungerende.
 */
export function getProviderForMode(mode: AccountMode): MarketDataProvider {
  if (mode === "DEMO") {
    if (!demoCached) demoCached = createDemoProvider();
    return demoCached;
  }
  if (mode === "PAPER") {
    throw new Error(
      "Ingen ekte markedsdataleverandør er koblet til ennå for PAPER-kontoer. " +
        "Se docs/dataleverandorer.md for hva som må avklares først."
    );
  }
  throw new Error("LIVE_READONLY støttes ikke i denne versjonen.");
}
