# Markeds- og nyhetsdata: fra DEMO til PAPER

Denne appen bruker i dag utelukkende `DemoProvider`
(`src/lib/market/demo-provider.ts`) — en deterministisk, selvstendig
prisgenerator uten avhengighet til noen ekstern tjeneste. Ingen ekte
markedsdata- eller nyhets-API-er er kontaktet, antatt eller etterlignet
noe sted i denne koden, og ingen nettsteder skrapes. Dette dokumentet
beskriver hva som konkret må avklares før PAPER-modus (ekte data) kan
bygges.

**Dette er ikke en implementasjonsplan for en spesifikk leverandør.** Vi
har bevisst latt være å anta hvilken leverandør som skal brukes, hvilke
endepunkter den har, eller hvilke rettigheter man har til å hente/vise
dataene — det er kommersielle og juridiske spørsmål som må avklares med en
faktisk leverandør før noe av det under kan besvares konkret.

## Grensesnittet appen forventer

Alt appen trenger fra en markedsdatakilde er beskrevet i
`src/lib/market/types.ts` sitt `MarketDataProvider`-grensesnitt:

- `listInstruments()` — hvilke instrumenter er tilgjengelige
- `isMarketOpen(at)` / `nextMarketOpen(at)` — åpningstider
- `getLatestObservation(ticker, at)` — siste kjente kurs på et gitt tidspunkt
- `getNextObservationAfter(ticker, after)` — den første gyldige
  observasjonen STRENGT ETTER et gitt tidspunkt (brukt til ordreutførelse)
- `getLatestBenchmark(at)` — referanseindeksverdi

En ekte leverandør kobles inn ved å implementere dette grensesnittet og
legge den til i `src/lib/market/index.ts` sin `getProviderForMode()`, uten
å endre regnskapsmotor, handelsmotor eller UI. I dag kaster
`getProviderForMode("PAPER")` en tydelig feil — den faller ALDRI stille
tilbake til DEMO-data.

## Avklaringer som kreves for markedsdata

### 1. Dekning

- Hvilket marked/børs skal dekkes (Oslo Børs? andre?), og hvilke
  instrumenter er faktisk tilgjengelig hos leverandøren?
- Presis handelskalender: hvilke dager/tider er markedet faktisk åpent
  hos leverandøren (se helligdager under).

### 2. Lisens og bruksrettigheter

- Rett til å **vise** kurser (sanntid eller forsinket) til sluttbrukere i
  en app — krever normalt en egen "market data display"-avtale utover
  generell API-tilgang.
- Egne vilkår for å vise **historikk/graf**, kontra kun siste kurs.
- Restriksjoner på å bruke kursene til å beregne og vise en resultatliste
  basert på reelle kursbevegelser.
- Attribusjonskrav.

### 3. Forsinkelse ("latency")

- Sanntid eller forsinket (typisk 15 min for rimelige avtaler)? Appen er
  designet for å håndtere begge deler eksplisitt (`observedAt` vs.
  `receivedAt`), men UI-teksten (DEMO-merket i dag) må oppdateres til å
  vise riktig forsinkelse, og "aldri fyll til en kjent gammel kurs" må
  fortsatt overholdes — med en 15-minutters-forsinket feed kan en ordre
  måtte vente lenge på en fersk nok observasjon. Dagens synkrone
  ventelogikk (`ORDER_MAX_WAIT_MS`-mønsteret i handelsmotoren) er tunet
  for demoens sekundraske tick-intervall og MÅ vurderes på nytt — en
  reelt forsinket feed bør sannsynligvis flyttes til en kø/bakgrunnsjobb
  med varsling til klienten i stedet for en lang-holdt HTTP-forespørsel.

### 4. Lagring

- Har man lov til å lagre (cache/persistere) kursobservasjoner i egen
  database, eller må hvert oppslag gå direkte til leverandøren? Mange
  avtaler har egne regler for dette ("redistribution" vs. "display
  only", maks lagringstid).

### 5. Kostnad

- Pris per bruker/API-kall/instrument, og hvordan dette skalerer.
- Er det en gratis/utviklertilgang tilstrekkelig for en pilot, med et
  klart oppgraderingsløp?

## Nyhets- og datakilder for beslutningsgrunnlag

Når AI-drevne beslutninger bygges (etappe 4), gjelder samme
forsiktighetsprinsipp:

- **Bruk primærkilder** der mulig: børsmeldinger, selskapsrapporter,
  investorsider. Aviser (f.eks. E24) kan supplere når tilgang og bruk er
  tillatt.
- **Ikke omgå betalingsmurer**, og ikke anta at et privat abonnement
  tillater automatisert innhenting, lagring eller AI-behandling av
  innholdet — dette må avklares eksplisitt med hver kilde/abonnement.
- Hver nyhets-/datapost må lagre: kilde og URL, opprinnelig
  publiseringstidspunkt (når tilgjengelig), tidspunkt systemet mottok
  informasjonen, kobling til riktig selskap/verdipapir, og eventuell
  usikkerhet/forsinkelse.
- **Duplikater og oppdaterte artikler må identifiseres** — samme melding
  gjengitt i flere aviser skal aldri telle som uavhengige signaler. Dette
  krever en dedupliseringsmekanisme (f.eks. innholdshash + kobling til en
  kanonisk sak) som ikke finnes ennå.
- Markedspriser skal alltid komme fra selve datakilden — **aldri fra
  AI-generert tekst**.

## Oppsummert: hva er allerede forberedt, og hva gjenstår

**Allerede på plass (krever ingen endring for å bytte leverandør):**

- Utskiftbart `MarketDataProvider`-grensesnitt, valgt per kontomodus
- Tydelig skille mellom markedsdatatidspunkt og mottakstidspunkt
- Handelsmotor som aldri fyller mot en kjent/gammel kurs
- Regnskapsmotor som flagger (ikke nuller ut) manglende prisdata

**Gjenstår før PAPER-modus kan brukes:**

- Faktisk avtale/lisens avklart som over
- Konkret implementasjon av `MarketDataProvider` mot den valgte
  leverandørens faktiske API (ukjent og ikke antatt her)
- Helligdagskalender i åpningstidslogikken (se
  `docs/kjente-begrensninger.md`)
- Sannsynlig migrering av ordreutførelse til en bakgrunnsjobb/kø for en
  reelt forsinket feed
- Nyhetsinnhenting: primærkilde-prioritering, dedupliseringsmekanisme,
  eksplisitt avklarte databehandlingsrettigheter per kilde
