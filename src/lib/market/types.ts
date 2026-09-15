// Grensesnittet all markedsdata går gjennom. En "ekte" leverandør skal kunne
// implementere dette og byttes inn uten at handelsmotoren eller UI endres.
//
// Sentralt skille: `observedAt` er MARKEDSDATATIDSPUNKTET (når kursen
// faktisk gjaldt hos kilden), `receivedAt` er tidspunktet appen mottok/fikk
// tilgang til observasjonen. For sanntidsdata er de tilnærmet like; for
// forsinkede feeds (f.eks. 15 min forsinket) vil receivedAt > observedAt.
export interface PriceObservation {
  ticker: string;
  // Desimaltall som streng (f.eks. "184.53") — parses til Decimal av
  // kalleren idet den brukes i penge-regning. Holder float helt unna
  // pengeveier i handelsmotoren.
  price: string;
  observedAt: Date;
  receivedAt: Date;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly isDemo: boolean;
  // Menneskelesbar etikett vist i UI, f.eks. "Demodata (simulert)".
  readonly label: string;

  listTickers(): readonly string[];

  isMarketOpen(at: Date): boolean;
  // Neste tidspunkt markedet åpner på eller etter `at` (for feilmeldinger/UI).
  nextMarketOpen(at: Date): Date;

  // Siste kjente observasjon tilgjengelig på tidspunkt `at` (receivedAt <= at).
  // Null hvis ingen observasjon finnes ennå for denne tickeren.
  getLatestObservation(ticker: string, at: Date): PriceObservation | null;

  // Den FØRSTE gyldige observasjonen med observedAt STRIKT ETTER `after`.
  // Dette er observasjonen en ordre skal fylles mot — aldri en kjent,
  // allerede-observert kurs. `availableAt` er tidspunktet observasjonen
  // faktisk blir tilgjengelig (kan ligge i fremtiden relativt til "nå").
  getNextObservationAfter(
    ticker: string,
    after: Date
  ): { observation: PriceObservation; availableAt: Date };

  // Felles verdsettelsestidspunkt å bruke for ALLE kontoer i en resultatliste
  // på tidspunkt `at`, slik at ingen deltaker vurderes mot en annen kurs enn
  // de andre.
  getValuationTimestamp(at: Date): Date;
}
