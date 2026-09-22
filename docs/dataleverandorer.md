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

## Valg av leverandør: Saxo Bank OpenAPI (anbefalt, ikke endelig avklart)

Etter research 22.9.2026 anbefales **Saxo Bank OpenAPI** som første kandidat
for både markedsdata og fremtidig ordreutførelse. Alternativene vurdert:

| Leverandør | Data (Oslo Børs) | Ordre-API for automatisert handel | Arkitekturpasning |
|---|---|---|---|
| **Saxo Bank OpenAPI** | Ja, del av 30 000+ instrumenter | Ja — REST/OAuth, egen SIM-modus for testing | Stateless REST passer direkte med Next.js/Railway, ingen ekstra prosess |
| **Interactive Brokers** | Ja, bekreftet (0,05 % kurtasje, min. NOK 49) | Ja — TWS API/IB Gateway | Krever en kontinuerlig kjørende IB Gateway-prosess (Java) med periodisk re-innlogging — ekstra driftskompleksitet på Railway |
| **Nordnet** | Ja (nordisk) | Uklart/stengt — Nordnet tar **ikke imot nye API-kunder** for tiden | Utelukket inntil videre |

**Hvorfor Saxo:**
1. **Ett integrasjonspunkt løser både datakilde- og megler-spørsmålet** —
   samme API leverer kurser (erstatter `DemoProvider` i PAPER-modus) og
   ordreutførelse (fremtidig LIVE-modus), fremfor å koble til to separate
   tjenester.
2. **Selvbetjent SIM-miljø uten ferdig kundeforhold** — Saxos
   utviklerportal (developer.saxobank.com) tilbyr en simulerings-konto man
   kan registrere seg for direkte, uten å først ha en finansiert
   Saxo-konto. Dette betyr vi kan bygge og teste `PAPER`-integrasjonen mot
   ekte markedsdata og realistisk simulert ordreutførelse **før** noen
   ekte, finansiert konto må opprettes.
3. **REST/OAuth passer arkitekturen vår** — ingen langvarig
   sesjons-/gateway-prosess å drifte på Railway, i motsetning til IBKR
   (som krever en egen IB Gateway-prosess som må holdes innlogget).

**Ikke avklart ennå — bruker må gjøre selve kontoregistreringen:**
Jeg kan ikke opprette en konto eller godta vilkår hos Saxo på dine vegne.
Konkrete steg for deg:

1. Gå til <https://www.developer.saxo/accounts/signin> og registrer en
   utviklerkonto (krever kun e-post — ikke en finansiert handelskonto).
2. Be om en **SIM (simulerings)-applikasjon** i portalen — dette
   utsteder AppKey/AppSecret/redirect-URI for simuleringsmiljøet.
3. Send meg (ikke i klartekst i chat om du kan unngå det — samme mønster
   som Railway-miljøvariablene) følgende, som `SAXO_*`-miljøvariabler:
   `SAXO_APP_KEY`, `SAXO_APP_SECRET`, `SAXO_REDIRECT_URI`,
   `SAXO_ENVIRONMENT=sim`.
4. Les gjennom Saxos vilkår for OpenAPI/automatisert handel selv og
   bekreft at du aksepterer dem — jeg kan ikke gjøre den juridiske
   vurderingen for deg.

**Fortsatt bevisst ikke avklart/antatt:** nøyaktig lisens/visningsrett for
kurser i UI (pkt. 2 over), lagringsrett for historikk, kostnad ved skalering
utover pilot — dette må leses ut av Saxos faktiske utvikleravtale når
kontoen er opprettet, ikke antas her.

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
