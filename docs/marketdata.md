# Markedsdata: fra demodata til en ekte leverandør

Denne appen bruker i dag utelukkende `MockProvider`
(`src/lib/market/mock-provider.ts`) — en deterministisk, selvstendig
prisgenerator uten avhengighet til noen ekstern tjeneste. Ingen ekte
markedsdata-API-er er kontaktet, antatt eller etterlignet noe sted i denne
koden, og ingen finansnettsteder skrapes. Dette dokumentet beskriver hva
som konkret må avklares og bygges før appen kan kobles til en ekte,
lisensiert markedsdatakilde.

**Dette er ikke en implementasjonsplan for en spesifikk leverandør.** Vi
har bevisst latt være å anta hvilken leverandør som skal brukes, hvilke
endepunkter den har, eller hvilke rettigheter man har til å vise dataene —
alt dette er kommersielle og juridiske spørsmål som må avklares med en
faktisk leverandør/børs før noe av det under kan besvares konkret.

## Grensesnittet appen forventer

Alt appen trenger fra en markedsdatakilde er beskrevet i
`src/lib/market/types.ts` sitt `MarketDataProvider`-grensesnitt:

- `listTickers()` — hvilke instrumenter er tilgjengelige
- `isMarketOpen(at)` / `nextMarketOpen(at)` — åpningstider
- `getLatestObservation(ticker, at)` — siste kjente kurs på et gitt tidspunkt
- `getNextObservationAfter(ticker, after)` — den første gyldige
  observasjonen STRENGT ETTER et gitt tidspunkt (brukt til ordreutførelse)
- `getValuationTimestamp(at)` — et delt verdsettelsestidspunkt for
  resultatlister

En ekte leverandør kobles inn ved å implementere dette grensesnittet og
legge den til i `src/lib/market/index.ts` sin `getMarketDataProvider()`,
uten å endre handelsmotor, ligalogikk eller UI.

## Avklaringer som kreves før en ekte leverandør kan brukes

### 1. Markedsdekning

- Hvilket marked/børs(er) skal dekkes (f.eks. Oslo Børs / Euronext)?
  Appen forutsetter i dag ett marked og én valuta (NOK) — å utvide til
  flere markeder/valutaer krever endringer i datamodellen (valutakurser,
  åpningstider per marked) og UI.
- Hvilke instrumenter er faktisk tilgjengelig hos leverandøren, og dekker
  de aksjene man ønsker å tilby i ligaene?
- Presis definisjon av handelskalender: hvilke dager/tider er markedet
  faktisk åpent hos leverandøren (se helligdager under).

### 2. Lisens og bruksrettigheter

- Har man rett til å **vise** sanntids- eller forsinkede kurser til
  sluttbrukere i en forbrukerrettet app (ikke bare til intern bruk)?
  Dette krever normalt en egen "market data display"-avtale/lisens utover
  en generell API-tilgang, med egne vilkår for antall brukere, plattform
  (web/mobil/PWA), og om kursene vises "live" eller forsinket.
- Er det egne vilkår for **å vise historikk/graf** (kursgrafen i denne
  appen), kontra kun siste kurs?
- Er det restriksjoner på å bruke kursene til å beregne og vise en
  offentlig/delt resultatliste (rangering basert på reelle kursbevegelser)?
- Attribusjonskrav — må kilden krediteres synlig i UI?

### 3. Forsinkelse ("latency")

- Er dataene sanntid eller forsinket (typisk 15 minutter for gratis/rimelige
  avtaler)? Appen er designet for å håndtere begge deler eksplisitt
  (`observedAt` vs. `receivedAt` i `PriceObservation`), men UI-teksten
  ("Demodata"-merket i dag) må oppdateres til å vise riktig forsinkelse
  til brukeren, og handelsregelen "ordre fylles aldri til en kjent gammel
  kurs" må fortsatt overholdes — med en 15-minutters-forsinket feed betyr
  det i praksis at en ordre kan måtte vente lenge på en fersk nok
  observasjon. `ORDER_MAX_WAIT_MS`, maksimal ventetid og
  brukerkommunikasjon rundt dette må revurderes for en forsinket feed (se
  "Bakgrunnsjobb" i README).

### 4. Lagring

- Har man lov til å **lagre** (cache/persistere) kursobservasjoner i egen
  database, eller må hvert oppslag gå direkte til leverandøren? Mange
  markedsdataavtaler har egne regler for dette ("redistribution" vs.
  "display only", maks lagringstid, osv.).
- Hvis lagring er tillatt: hvor lenge, og med hvilken presisjon
  (tick-for-tick vs. aggregert)?

### 5. Kostnad

- Pris per bruker / per API-kall / per instrument / flat avtale — og
  hvordan skalerer dette med antall aktive ligaer og deltakere?
- Er det en gratis/utviklertilgang som er tilstrekkelig for en pilot, og et
  klart oppgraderingsløp til en fullverdig avtale ved lansering?

## Krav som må på plass før EKTE konkurranser (utover selve datatilkoblingen)

Disse påvirker korrekt verdsettelse og rangering, og MÅ løses uavhengig av
hvilken leverandør som velges:

### Helligdager og stengte handelsdager

`MockProvider.isMarketOpen()` sjekker i dag kun ukedag (mandag–fredag) og
klokkeslett. Dette dekker IKKE norske/børsspesifikke helligdager (f.eks.
skjærtorsdag, 1. og 17. mai, jul/nyttår). Før en ekte konkurranse må:

- En helligdagskalender (børsens offisielle handelskalender) legges til i
  `isMarketOpen`/`nextMarketOpen`.
- Ordre som forsøkes lagt inn på en helligdag avvises med samme
  "markedet er stengt"-logikk som allerede finnes for helger.
- Sesongstart/-slutt bør ideelt sett ikke falle midt i en lengre
  helligdagsperiode uten at dette kommuniseres tydelig i UI.

### Aksjesplitt

Ved en splitt endres antall utestående aksjer og kursen justeres
proporsjonalt. Dette påvirker:

- **Beholdninger**: `quantity` og `avgCost` på alle `Holding`-rader for det
  aktuelle instrumentet må justeres samtidig med splitten (f.eks. ved en
  2:1-splitt: dobles `quantity`, halveres `avgCost`), slik at
  markedsverdi og kostbasis forblir korrekt.
- **Ordrehistorikk**: historiske `fillPrice`/`totalAmount` bør IKKE
  justeres i ettertid (de representerer hva som faktisk skjedde), men UI
  bør vise at et instrument har blitt splittet, slik at historiske priser
  ikke feiltolkes ved sammenligning med dagens kurs.
- **Resultatliste**: må bruke splitt-justerte kurser fra det tidspunktet
  splitten trer i kraft, ellers vil avkastningsberegningen bli feil for
  alle med en posisjon i instrumentet.

Ingen splitt-håndtering finnes i dagens modell — dette må bygges som en
egen hendelsestype (`CorporateAction` e.l.) med en engangsjobb som
justerer beholdninger atomisk på ikrafttredelsestidspunktet.

### Utbytte

Utbytte er ikke modellert i det hele tatt i dag. Før ekte konkurranser må
det besluttes:

- Skal utbytte krediteres kontantsaldoen til alle med en posisjon på
  ex-dividend-dato (mest realistisk, mest rettferdig for rangeringen)?
- Eller skal avkastningsberegningen se bort fra utbytte (kan oppleves
  urettferdig for utbyttetunge sektorer/aksjer og skape feil insentiver)?
- Uansett valg: krever en ny `CashLedgerEntry`-type (f.eks.
  `DIVIDEND`), en jobb som kjenner utbyttedatoer/-beløp per instrument, og
  at denne krediteringen skjer identisk og samtidig for alle berørte
  kontoer — akkurat som prinsippet om ett delt verdsettelsestidspunkt i
  resultatlisten i dag.

## Oppsummert: hva er allerede forberedt, og hva gjenstår

**Allerede på plass (krever ingen endring for å bytte leverandør):**

- Utskiftbart `MarketDataProvider`-grensesnitt
- Tydelig skille mellom markedsdatatidspunkt (`observedAt`) og
  mottakstidspunkt (`receivedAt`) helt inn i ordreutførelsen
- Handelsmotor som aldri fyller mot en kjent/gammel kurs
- Ett delt verdsettelsestidspunkt for hele resultatlisten
- Håndtering (flagging, ikke null-verdsetting) av manglende priser

**Gjenstår før en ekte, lisensiert leverandør kan brukes i produksjon:**

- Faktisk avtale/lisens avklart som over (dekning, rettigheter, forsinkelse,
  lagring, kostnad)
- Konkret implementasjon av `MarketDataProvider` mot den valgte
  leverandørens faktiske API (ukjent og ikke antatt her)
- Helligdagskalender i åpningstidslogikken
- Aksjesplitt-håndtering (justering av beholdninger + kostbasis)
- Utbyttehåndtering (kreditering av kontantsaldo, ny ledger-type)
- Sannsynlig migrering av ordreutførelse fra synkron ventelogikk til en
  bakgrunnsjobb/kø, tilpasset leverandørens faktiske oppdateringsfrekvens
  og forsinkelse (se README)
