// Fiktive selskaper for demodataen. Navn og tickere er oppdiktet — dette er
// IKKE ekte børsnoterte selskaper eller ekte kursdata. Se docs/marketdata.md
// for hva som kreves for å koble til en ekte, lisensiert markedsdatakilde.
export interface SeedStock {
  ticker: string;
  name: string;
  sector: string;
  basePrice: number; // NOK
  // Årlig drift (f.eks. 0.08 = ca. +8 %/år) og volatilitet brukt av MockProvider.
  annualDrift: number;
  annualVolatility: number;
}

export const SEED_STOCKS: SeedStock[] = [
  { ticker: "FJRD", name: "Fjord Sjømat ASA", sector: "Sjømat", basePrice: 184.5, annualDrift: 0.06, annualVolatility: 0.28 },
  { ticker: "NORL", name: "Nordlys Energi", sector: "Energi", basePrice: 342.0, annualDrift: 0.04, annualVolatility: 0.32 },
  { ticker: "BREK", name: "Bre Teknologi", sector: "Teknologi", basePrice: 96.2, annualDrift: 0.15, annualVolatility: 0.45 },
  { ticker: "VIDD", name: "Vidde Vindkraft", sector: "Fornybar energi", basePrice: 58.7, annualDrift: 0.05, annualVolatility: 0.38 },
  { ticker: "SALT", name: "Saltstein Gruve", sector: "Bergverk", basePrice: 221.3, annualDrift: 0.02, annualVolatility: 0.4 },
  { ticker: "TIND", name: "Tind Bank", sector: "Finans", basePrice: 128.9, annualDrift: 0.03, annualVolatility: 0.2 },
  { ticker: "SKJR", name: "Skjærgård Reiseliv", sector: "Reiseliv", basePrice: 44.1, annualDrift: 0.07, annualVolatility: 0.5 },
  { ticker: "ELVA", name: "Elva Logistikk", sector: "Logistikk", basePrice: 76.4, annualDrift: 0.03, annualVolatility: 0.3 },
  { ticker: "FOSS", name: "Foss Kraft", sector: "Energi", basePrice: 410.8, annualDrift: 0.05, annualVolatility: 0.25 },
  { ticker: "GRAN", name: "Gran Skog", sector: "Skogbruk", basePrice: 152.0, annualDrift: 0.02, annualVolatility: 0.22 },
  { ticker: "LYNG", name: "Lyng Helse", sector: "Helse", basePrice: 267.5, annualDrift: 0.09, annualVolatility: 0.3 },
  { ticker: "ISBJ", name: "Isbjørn Data", sector: "Teknologi", basePrice: 63.9, annualDrift: 0.18, annualVolatility: 0.55 },
  { ticker: "HAVN", name: "Havn Shipping", sector: "Shipping", basePrice: 198.6, annualDrift: 0.01, annualVolatility: 0.35 },
  { ticker: "RYFYL", name: "Ryfylke Laks", sector: "Sjømat", basePrice: 312.4, annualDrift: 0.07, annualVolatility: 0.33 },
  { ticker: "MYRA", name: "Myra Biotech", sector: "Bioteknologi", basePrice: 21.7, annualDrift: 0.2, annualVolatility: 0.7 },
  { ticker: "STAV", name: "Stavtre Bygg", sector: "Bygg og anlegg", basePrice: 89.3, annualDrift: 0.03, annualVolatility: 0.3 },
  { ticker: "KVAL", name: "Kval Forsikring", sector: "Finans", basePrice: 175.2, annualDrift: 0.04, annualVolatility: 0.18 },
  { ticker: "BLAA", name: "Blåbær Mat", sector: "Dagligvare", basePrice: 54.6, annualDrift: 0.03, annualVolatility: 0.2 },
  { ticker: "RUNE", name: "Rune Spill", sector: "Underholdning", basePrice: 38.9, annualDrift: 0.12, annualVolatility: 0.6 },
  { ticker: "SOLA", name: "Sola Solkraft", sector: "Fornybar energi", basePrice: 47.3, annualDrift: 0.1, annualVolatility: 0.42 },
  { ticker: "TROLL", name: "Troll Gass", sector: "Energi", basePrice: 289.9, annualDrift: 0.02, annualVolatility: 0.3 },
  { ticker: "VEKST", name: "Vekst Kapital", sector: "Finans", basePrice: 143.7, annualDrift: 0.06, annualVolatility: 0.25 },
  { ticker: "NORD", name: "Nordkyst Flyfrakt", sector: "Transport", basePrice: 68.5, annualDrift: 0.02, annualVolatility: 0.28 },
  { ticker: "FONN", name: "Fonn Farmasi", sector: "Helse", basePrice: 233.1, annualDrift: 0.08, annualVolatility: 0.27 },
  { ticker: "KYST", name: "Kystvind Marine", sector: "Fornybar energi", basePrice: 31.4, annualDrift: 0.09, annualVolatility: 0.48 },
];
