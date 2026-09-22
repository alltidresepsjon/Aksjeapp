# Kjente begrensninger og forenklinger

Dette er en ærlig liste over hva som er forenklet, hva som mangler, og hva
som må på plass før neste etappe eller en reell konkurranse/beslutning.
Ingenting her er skjult i koden — hver forenkling har en tilsvarende
kommentar i kildekoden der den er relevant.

## Markedsdata og handel

- **Kun DEMO-data finnes.** PAPER (ekte data) er ikke koblet til — se
  `docs/dataleverandorer.md`.
- **Tick-intervallet (5 sek.) er en implementasjonsdetalj** i den
  syntetiske generatoren, valgt for at manuell demo-handel skal føles
  responsiv — det er IKKE en påstand om ekte markedsdatafrekvens. En
  reell, forsinket feed krever en annen kjøremodell (se under).
- **Ordreutførelse venter synkront** (innenfor selve HTTP-forespørselen)
  på neste prisobservasjon. Dette fungerer greit for et sekundraskt
  demo-tick, men skalerer IKKE til en reelt forsinket feed (f.eks. 15
  min) — det må bygges om til en kø/bakgrunnsjobb med varsling til
  klienten før PAPER-handel med en treg feed er brukbart.
- **Ingen helligdagskalender.** Kun ukedag (mandag–fredag) sjekkes for
  åpningstider — norske/børsspesifikke helligdager (skjærtorsdag, 17.
  mai, jul/nyttår osv.) behandles i dag som vanlige åpne dager.
- **Ingen aksjesplitt- eller utbyttehåndtering.** Begge påvirker korrekt
  verdsettelse og må bygges som egne hendelser (`CorporateAction`-type)
  som justerer beholdninger/kostbasis atomisk, før ekte konkurranser eller
  beslutninger.
- **Ingen shorting, gearing eller derivater** — kun hele aksjer, kun
  kjøp/salg av eksisterende beholdning, slik spesifikasjonen krever for
  denne versjonen.
- **Realisert resultat bruker glidende snittkost**, ikke en
  lot-for-lot/FIFO-metode. Se `docs/beregningsmetoder.md`.
- **Valutaveksling er ikke modellert.** Alle DEMO-instrumenter er i NOK;
  `fxImpact` er alltid 0. Må bygges før instrumenter i andre valutaer
  støttes.
- **Stop-loss finnes ikke i det hele tatt ennå**, og skal — når det
  bygges — aldri fremstilles som en garanti mot større tap (kan gape over
  ved store kurshopp/lav likviditet).

## Tidssoner

- `osloDateTimeToUtc` bruker ett offset-gjett (ikke iterativ korrigering)
  rundt selve sommertidsovergangs-døgnet (siste søndag i mars/oktober) —
  kan i sjeldne tilfeller avvike med opptil en time for tidspunkter akkurat
  den natten. Uten praktisk betydning for daglig stengetid kl. 16:30, som
  ligger langt unna overgangstidspunktet.

## AI og beslutninger

- **Ingen AI-logikk er bygget i det hele tatt i denne versjonen.** Ingen
  Anthropic API-kall gjøres av appen. Beslutningsjournal,
  strategiversjonering, evaluering og modellsammenligning er fremtidige
  etapper (2–4), ikke påbegynt.
- Kalenderens dagsdetalj viser i dag ingen "kort forklaring på hva som
  påvirket resultatet" utover de rene tallene, siden en slik forklaring
  krever AI som ikke finnes ennå — å dikte opp en tekstforklaring uten AI
  ville brutt prinsippet om at rapporttall/forklaringer ikke skal "finnes
  på".

## Sikkerhet og drift

- **Ingen rate limiting** på innlogging/registrering ennå.
- **Ingen e-postverifisering eller passord-reset-flyt.**
- **Kostnadsgrensene i .env (`MONTHLY_AI_BUDGET_NOK` osv.) er kun
  konfigurerte tak, ikke faktisk forbrukssporing** — det finnes ingen
  telling av reelt AI-/data-forbruk ennå, siden ingen slike kall gjøres.
  Dashbordet viser dette eksplisitt som "budsjettgrense, ikke faktisk
  forbruk".
- **`SystemEvent`-tabellen finnes i datamodellen, men brukes ikke aktivt
  ennå** utover nødstopp-loggingen — driftsvarsling (e-post/Slack ved
  feil) er ikke bygget.
- **Sikkerhetskopiering**: ikke konfigurert av oss. Railway sin
  administrerte PostgreSQL-tjeneste tilbyr innebygde
  backup-/gjenopprettingsmuligheter — dette må aktiveres eksplisitt i
  Railway-dashbordet av kontoeieren; ingen automatisk backup-jobb er
  bygget i denne appen.
- **Ingen dedikert sikkerhetsgjennomgang (penetrasjonstest) er utført.**
  God praksis er fulgt (parameteriserte spørringer via Prisma, hashet
  passord, server-side eierskapssjekk på alle handelsruter, ekstern
  tekst/artikler behandlet som ubetrodde data — ingen slik behandling
  finnes ennå siden ingen ekstern tekst konsumeres i denne etappen), men
  dette erstatter ikke en reell gjennomgang før noe brukes til virkelige
  beslutninger.
- Prisma sin `package.json#prisma`-konfigurasjon for seed-scriptet er
  markert deprecated fra Prisma 7 (vi bruker 6.19.3, stabil) — bør
  migreres til en `prisma.config.ts`-fil ved en fremtidig
  Prisma-oppgradering.

## Testing

- Testene bruker én delt Postgres-testdatabase og nullstiller den med
  `TRUNCATE` mellom hver test — testfiler kjøres derfor bevisst
  **sekvensielt** (`fileParallelism: false` i `vitest.config.ts`), ikke i
  parallelle prosesser, for å unngå at samtidige `TRUNCATE`-kall
  deadlocker mot hverandre. Dette gjør testsuiten tregere (~70 sek.) enn
  den ellers ville vært, men er en bevisst, dokumentert avveining for
  korrekthet fremfor hastighet i denne størrelsen prosjekt.
