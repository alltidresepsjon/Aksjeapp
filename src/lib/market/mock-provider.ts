import { env } from "@/lib/env";
import { SEED_STOCKS, type SeedStock } from "./seed-stocks";
import { hashKey, hashToGaussian, hashToUnitFloat } from "./prng";
import type { MarketDataProvider, PriceObservation } from "./types";

// Fast referansepunkt for prisformelen (IKKE Unix-epoke — det ville gitt
// urealistisk store akkumulerte drift-faktorer siden 1970). All "tid siden
// start" i formlene under regnes herfra.
const APP_EPOCH_MS = Date.parse("2025-01-01T00:00:00Z");
const MS_PER_DAY = 24 * 3600 * 1000;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

function tickIndexForTime(t: number, intervalMs: number): number {
  return Math.floor((t - APP_EPOCH_MS) / intervalMs);
}

function observedAtForTickIndex(idx: number, intervalMs: number): Date {
  return new Date(APP_EPOCH_MS + idx * intervalMs);
}

// Deterministisk, O(1) pris for en gitt aksje på en gitt tick-indeks. Ren
// funksjon av (seed, ticker, idx) — ingen iterasjon over historikk, ingen
// skjult tilstand. Kombinerer en jevn eksponentiell drift, to sinusledd
// (kort/lang periode) og avgrenset per-tick støy.
function priceForTick(stock: SeedStock, seed: string, idx: number, intervalMs: number): number {
  const elapsedMs = idx * intervalMs;
  const elapsedYears = elapsedMs / MS_PER_YEAR;
  const driftFactor = Math.exp(stock.annualDrift * elapsedYears);

  const phaseSeed = hashKey(seed, stock.ticker, "phase");
  const phase1 = hashToUnitFloat(phaseSeed) * 2 * Math.PI;
  const phase2 = hashToUnitFloat(phaseSeed ^ 0x1234) * 2 * Math.PI;
  const period1Days = 3 + hashToUnitFloat(phaseSeed ^ 0x777) * 5; // 3–8 dager
  const period2Days = 20 + hashToUnitFloat(phaseSeed ^ 0x999) * 40; // 20–60 dager

  const osc =
    0.5 * Math.sin((2 * Math.PI * elapsedMs) / (period1Days * MS_PER_DAY) + phase1) +
    0.3 * Math.sin((2 * Math.PI * elapsedMs) / (period2Days * MS_PER_DAY) + phase2);

  const noise = hashToGaussian(hashKey(seed, stock.ticker, idx)) * stock.annualVolatility * 0.02;
  const wiggle = osc * stock.annualVolatility + noise;

  const price = stock.basePrice * driftFactor * (1 + wiggle);
  return Math.max(price, 0.1);
}

function localOsloParts(date: Date): { hour: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const hourRaw = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { hour: hourRaw % 24, weekday: weekdayMap[weekdayStr] ?? 1 };
}

export interface MockProviderConfig {
  seed: string;
  tickIntervalMs: number;
  latencyMs: number;
  openHour: number;
  closeHour: number;
}

export function createMockProvider(config: MockProviderConfig = {
  seed: env.MOCK_MARKET_SEED,
  tickIntervalMs: env.MOCK_MARKET_TICK_INTERVAL_MS,
  latencyMs: env.MOCK_MARKET_LATENCY_MS,
  openHour: env.MARKET_OPEN_HOUR,
  closeHour: env.MARKET_CLOSE_HOUR,
}): MarketDataProvider {
  const { seed, tickIntervalMs, latencyMs, openHour, closeHour } = config;
  const stockByTicker = new Map(SEED_STOCKS.map((s) => [s.ticker, s]));

  function isMarketOpen(at: Date): boolean {
    const { hour, weekday } = localOsloParts(at);
    if (weekday === 0 || weekday === 6) return false;
    return hour >= openHour && hour < closeHour;
  }

  function nextMarketOpen(at: Date): Date {
    // Enkel iterativ fremoversøk, time for time (Oslo og UTC har alltid
    // heltalls timeoffset, så UTC-time-grensa er alltid også Oslo-time-grensa).
    // MVP-forenkling — maks 10 dagers søk er mer enn nok.
    const probe = new Date(at.getTime());
    probe.setUTCMinutes(0, 0, 0);
    for (let i = 0; i < 24 * 10; i++) {
      if (probe.getTime() >= at.getTime() && isMarketOpen(probe)) {
        return probe;
      }
      probe.setUTCHours(probe.getUTCHours() + 1);
    }
    return probe;
  }

  function observationForTicker(ticker: string, idx: number): PriceObservation {
    const stock = stockByTicker.get(ticker);
    if (!stock) throw new Error(`Ukjent ticker: ${ticker}`);
    const observedAt = observedAtForTickIndex(idx, tickIntervalMs);
    const receivedAt = new Date(observedAt.getTime() + latencyMs);
    const price = priceForTick(stock, seed, idx, tickIntervalMs);
    return {
      ticker,
      price: price.toFixed(2),
      observedAt,
      receivedAt,
    };
  }

  return {
    id: "mock",
    isDemo: true,
    label: "Demodata (simulert)",

    listTickers() {
      return SEED_STOCKS.map((s) => s.ticker);
    },

    isMarketOpen,
    nextMarketOpen,

    getLatestObservation(ticker, at) {
      if (!stockByTicker.has(ticker)) return null;
      const idx = tickIndexForTime(at.getTime() - latencyMs, tickIntervalMs);
      if (idx < 0) return null;
      return observationForTicker(ticker, idx);
    },

    getNextObservationAfter(ticker, after) {
      if (!stockByTicker.has(ticker)) {
        throw new Error(`Ukjent ticker: ${ticker}`);
      }
      const idx = tickIndexForTime(after.getTime(), tickIntervalMs) + 1;
      const observation = observationForTicker(ticker, idx);
      return { observation, availableAt: observation.receivedAt };
    },

    getValuationTimestamp(at) {
      const idx = tickIndexForTime(at.getTime() - latencyMs, tickIntervalMs);
      return observedAtForTickIndex(Math.max(idx, 0), tickIntervalMs);
    },
  };
}
