// Grensesnittet all markedsdata går gjennom — en "ekte" PAPER-leverandør
// skal kunne implementere dette uten at regnskapsmotor eller UI endres.
//
// Sentralt skille: `observedAt` er MARKEDSDATATIDSPUNKTET (når kursen
// faktisk gjaldt), `receivedAt` er tidspunktet appen mottok observasjonen.
export interface PriceObservation {
  ticker: string;
  // Desimaltall som streng — parses til Decimal av kalleren, holder float
  // helt unna pengeveier.
  price: string;
  observedAt: Date;
  receivedAt: Date;
  source: string;
}

export interface BenchmarkPoint {
  key: string;
  value: string;
  observedAt: Date;
  receivedAt: Date;
  source: string;
}

export interface InstrumentSpec {
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  sector?: string;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly mode: "demo" | "paper";
  // Menneskelesbar etikett vist i UI, f.eks. "DEMO (syntetiske data)".
  readonly label: string;

  listInstruments(): readonly InstrumentSpec[];

  isMarketOpen(at: Date): boolean;
  nextMarketOpen(at: Date): Date;

  // Siste kjente observasjon tilgjengelig på tidspunkt `at`. Null hvis
  // ingen finnes ennå (systemet skal da avstå, ikke gjette).
  getLatestObservation(ticker: string, at: Date): PriceObservation | null;

  // Den FØRSTE gyldige observasjonen med observedAt STRIKT ETTER `after` —
  // brukt til å fylle simulerte ordre uten å bruke en kjent gammel kurs.
  getNextObservationAfter(
    ticker: string,
    after: Date
  ): { observation: PriceObservation; availableAt: Date };

  getLatestBenchmark(at: Date): BenchmarkPoint | null;
}
