import { env } from "@/lib/env";
import { DEMO_BENCHMARK_KEY, DEMO_EXCHANGE, DEMO_INSTRUMENTS, type DemoInstrumentSpec } from "./demo-instruments";
import { hashKey, hashToGaussian, hashToUnitFloat } from "./prng";
import type { BenchmarkPoint, InstrumentSpec, MarketDataProvider, PriceObservation } from "./types";

// Fast referansepunkt for prisformelen (IKKE Unix-epoke — det ville gitt
// urealistisk store akkumulerte drift-faktorer siden 1970).
const APP_EPOCH_MS = Date.parse("2025-01-01T00:00:00Z");
const MS_PER_DAY = 24 * 3600_000;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

// Demo-tick hvert 5. sekund med 500ms simulert innhentingsforsinkelse.
// NB: dette er en implementasjonsdetalj i den syntetiske generatoren, ikke
// en påstand om ekte markedsdatafrekvens — den bestemmer kun hvor raskt en
// simulert ordre fylles (må holdes godt under ordreutførelsens maksimale
// ventetid, se DEFAULT_MAX_WAIT_MS i place-order.ts). Selve regnskapet er
// uansett dagsbasert (se docs/beregningsmetoder.md), uavhengig av dette.
const TICK_INTERVAL_MS = 5_000;
const LATENCY_MS = 500;
const MARKET_OPEN_HOUR = 9;
const MARKET_CLOSE_HOUR = 16.5; // 16:30

function tickIndexForTime(t: number): number {
  return Math.floor((t - APP_EPOCH_MS) / TICK_INTERVAL_MS);
}
function observedAtForTickIndex(idx: number): Date {
  return new Date(APP_EPOCH_MS + idx * TICK_INTERVAL_MS);
}

function priceForTick(spec: DemoInstrumentSpec, seed: string, idx: number): number {
  const elapsedMs = idx * TICK_INTERVAL_MS;
  const elapsedYears = elapsedMs / MS_PER_YEAR;
  const driftFactor = Math.exp(spec.annualDrift * elapsedYears);

  const phaseSeed = hashKey(seed, spec.ticker, "phase");
  const phase1 = hashToUnitFloat(phaseSeed) * 2 * Math.PI;
  const phase2 = hashToUnitFloat(phaseSeed ^ 0x1234) * 2 * Math.PI;
  const period1Days = 3 + hashToUnitFloat(phaseSeed ^ 0x777) * 5;
  const period2Days = 20 + hashToUnitFloat(phaseSeed ^ 0x999) * 40;

  const osc =
    0.5 * Math.sin((2 * Math.PI * elapsedMs) / (period1Days * MS_PER_DAY) + phase1) +
    0.3 * Math.sin((2 * Math.PI * elapsedMs) / (period2Days * MS_PER_DAY) + phase2);

  const noise = hashToGaussian(hashKey(seed, spec.ticker, idx)) * spec.annualVolatility * 0.02;
  const wiggle = osc * spec.annualVolatility + noise;

  return Math.max(spec.basePrice * driftFactor * (1 + wiggle), 0.1);
}

function benchmarkForTick(seed: string, idx: number): number {
  // Referanseindeksen er gjennomsnittet av alle demo-instrumentene, normert
  // til å starte på 100 — enkel, forståelig, og alltid konsistent med
  // instrumentene den skal sammenlignes med.
  const avg =
    DEMO_INSTRUMENTS.reduce((sum, spec) => sum + priceForTick(spec, seed, idx) / spec.basePrice, 0) /
    DEMO_INSTRUMENTS.length;
  return avg * 100;
}

function localOsloParts(date: Date): { hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hour, minute, weekday: weekdayMap[weekdayStr] ?? 1 };
}

function isMarketOpenAt(at: Date): boolean {
  const { hour, minute, weekday } = localOsloParts(at);
  if (weekday === 0 || weekday === 6) return false;
  const fractionalHour = hour + minute / 60;
  return fractionalHour >= MARKET_OPEN_HOUR && fractionalHour < MARKET_CLOSE_HOUR;
}

export function createDemoProvider(seed: string = env.DEMO_MARKET_SEED): MarketDataProvider {
  const specByTicker = new Map(DEMO_INSTRUMENTS.map((s) => [s.ticker, s]));

  function observationForTicker(ticker: string, idx: number): PriceObservation {
    const spec = specByTicker.get(ticker);
    if (!spec) throw new Error(`Ukjent demo-ticker: ${ticker}`);
    const observedAt = observedAtForTickIndex(idx);
    const receivedAt = new Date(observedAt.getTime() + LATENCY_MS);
    const price = priceForTick(spec, seed, idx);
    return { ticker, price: price.toFixed(2), observedAt, receivedAt, source: "demo-syntetisk" };
  }

  function benchmarkForIdx(idx: number): BenchmarkPoint {
    const observedAt = observedAtForTickIndex(idx);
    const receivedAt = new Date(observedAt.getTime() + LATENCY_MS);
    return {
      key: DEMO_BENCHMARK_KEY,
      value: benchmarkForTick(seed, idx).toFixed(4),
      observedAt,
      receivedAt,
      source: "demo-syntetisk",
    };
  }

  return {
    id: "demo",
    mode: "demo",
    label: "DEMO (syntetiske data)",

    listInstruments(): readonly InstrumentSpec[] {
      return DEMO_INSTRUMENTS.map((s) => ({
        ticker: s.ticker,
        name: s.name,
        exchange: DEMO_EXCHANGE,
        currency: "NOK",
        sector: s.sector,
      }));
    },

    isMarketOpen: isMarketOpenAt,

    nextMarketOpen(at: Date): Date {
      const probe = new Date(at.getTime());
      probe.setUTCMinutes(0, 0, 0);
      for (let i = 0; i < 24 * 10; i++) {
        if (probe.getTime() >= at.getTime() && isMarketOpenAt(probe)) return probe;
        probe.setUTCHours(probe.getUTCHours() + 1);
      }
      return probe;
    },

    getLatestObservation(ticker, at) {
      if (!specByTicker.has(ticker)) return null;
      const idx = tickIndexForTime(at.getTime() - LATENCY_MS);
      if (idx < 0) return null;
      return observationForTicker(ticker, idx);
    },

    getNextObservationAfter(ticker, after) {
      if (!specByTicker.has(ticker)) throw new Error(`Ukjent demo-ticker: ${ticker}`);
      const idx = tickIndexForTime(after.getTime()) + 1;
      const observation = observationForTicker(ticker, idx);
      return { observation, availableAt: observation.receivedAt };
    },

    getLatestBenchmark(at) {
      const idx = tickIndexForTime(at.getTime() - LATENCY_MS);
      if (idx < 0) return null;
      return benchmarkForIdx(idx);
    },
  };
}
