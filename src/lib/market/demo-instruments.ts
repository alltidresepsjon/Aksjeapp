// Fiktive selskaper for DEMO-modus. Navn og tickere er oppdiktet — dette er
// IKKE ekte børsnoterte selskaper eller ekte kursdata. Se
// docs/dataleverandorer.md for hva som kreves for ekte data i PAPER-modus.
export interface DemoInstrumentSpec {
  ticker: string;
  name: string;
  sector: string;
  basePrice: number;
  annualDrift: number;
  annualVolatility: number;
}

export const DEMO_EXCHANGE = "DEMO";
export const DEMO_BENCHMARK_KEY = "DEMO_INDEX";

export const DEMO_INSTRUMENTS: DemoInstrumentSpec[] = [
  { ticker: "FJRD", name: "Fjord Sjømat ASA", sector: "Sjømat", basePrice: 184.5, annualDrift: 0.06, annualVolatility: 0.28 },
  { ticker: "NORL", name: "Nordlys Energi", sector: "Energi", basePrice: 342.0, annualDrift: 0.04, annualVolatility: 0.32 },
  { ticker: "BREK", name: "Bre Teknologi", sector: "Teknologi", basePrice: 96.2, annualDrift: 0.15, annualVolatility: 0.45 },
  { ticker: "TIND", name: "Tind Bank", sector: "Finans", basePrice: 128.9, annualDrift: 0.03, annualVolatility: 0.2 },
  { ticker: "FOSS", name: "Foss Kraft", sector: "Energi", basePrice: 410.8, annualDrift: 0.05, annualVolatility: 0.25 },
  { ticker: "LYNG", name: "Lyng Helse", sector: "Helse", basePrice: 267.5, annualDrift: 0.09, annualVolatility: 0.3 },
  { ticker: "HAVN", name: "Havn Shipping", sector: "Shipping", basePrice: 198.6, annualDrift: 0.01, annualVolatility: 0.35 },
  { ticker: "RYFYL", name: "Ryfylke Laks", sector: "Sjømat", basePrice: 312.4, annualDrift: 0.07, annualVolatility: 0.33 },
  { ticker: "KVAL", name: "Kval Forsikring", sector: "Finans", basePrice: 175.2, annualDrift: 0.04, annualVolatility: 0.18 },
  { ticker: "SOLA", name: "Sola Solkraft", sector: "Fornybar energi", basePrice: 47.3, annualDrift: 0.1, annualVolatility: 0.42 },
  { ticker: "VEKST", name: "Vekst Kapital", sector: "Finans", basePrice: 143.7, annualDrift: 0.06, annualVolatility: 0.25 },
  { ticker: "FONN", name: "Fonn Farmasi", sector: "Helse", basePrice: 233.1, annualDrift: 0.08, annualVolatility: 0.27 },
];
