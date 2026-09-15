# Børsliga

Et norsk, mobiltilpasset sosialt aksjespill. Brukere handler aksjer med
**fiktive penger** og konkurrerer mot venner i private ligaer over
fireukers sesonger. Ingen ekte aksjeordre, innskudd, uttak eller
pengepremier finnes i denne versjonen.

> **Demodata:** Kursene i denne versjonen kommer fra en deterministisk,
> selvstendig `MockProvider` — ikke ekte markedsdata. Se
> [`docs/marketdata.md`](docs/marketdata.md) for hva som kreves for å koble
> til en ekte, lisensiert leverandør.

## Teknologi

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind CSS v4**
- **PostgreSQL** via **Prisma ORM** (penger lagres som `Decimal`/`NUMERIC`, aldri float)
- **Auth.js (NextAuth v5)** med e-post/passord (bcrypt-hashet), JWT-sesjoner
- **PWA**: installérbar manifest + ikoner, minimal service worker (ingen offline-cache av handel)
- **Vitest** for tester

## Kom i gang lokalt

### Forutsetninger

- Node.js 20.9+ (se `package.json` for eksakte versjoner)
- PostgreSQL 14+ kjørende lokalt (eller en `DATABASE_URL` til en ekstern instans)

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Sett opp miljøvariabler

```bash
cp .env.example .env
```

Rediger `.env` ved behov — se kommentarene i filen for hva hver variabel
styrer (databasetilkobling, autentiseringshemmelighet, simulerte
markedsparametre, kurtasjesatser, osv.). Generer en ekte hemmelighet til
`AUTH_SECRET` med:

```bash
npx auth secret
```

### 3. Opprett databasen og kjør migrasjoner

```bash
createdb borsliga   # eller tilsvarende i ditt Postgres-oppsett
npm run db:migrate
```

### 4. Så inn demodata

```bash
npm run db:seed
```

Dette oppretter:

- 25 fiktive aksjer (samme valuta, NOK)
- En demobruker: **demo@borsliga.no** / **Demo1234!** (med litt handel i øvingskontoen)
- To ekstra demobrukere (Kari Nordmann, Ola Hansen)
- En demoliga **«Demoligaen»** med en aktiv sesong — invitasjonskode **`DEMO2026`**

### 5. Start utviklingsserveren

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

### Kjøre tester

Testene bruker en **egen database** (så de aldri rører utviklingsdataene
dine). Opprett den én gang:

```bash
createdb borsliga_test
DATABASE_URL="postgresql://<bruker>:<passord>@localhost:5432/borsliga_test?schema=public" npx prisma migrate deploy
```

Kjør så:

```bash
npm test
```

(Testdatabasens tilkoblingsstreng kan overstyres med miljøvariabelen
`TEST_DATABASE_URL` — se `vitest.config.ts`.)

### Bygg for produksjon

```bash
npm run build
npm start
```

## Arkitektur i korte trekk

```
src/
  app/                     Next.js App Router-sider
    (app)/                 Innlogget skall: Oversikt, Marked, Ligaer, Profil, Konto
    logg-inn/, registrer/  Offentlige auth-sider
    api/orders/            REST-endepunkt for ordreplassering/-kansellering
  lib/
    market/                MarketDataProvider-grensesnitt + MockProvider
    trading/                Ordreutførelsesmotor (kjøp/salg, låsing, idempotens)
    leagues/                Ligaer, sesonger, invitasjonskoder, øvingskonto
    ranking.ts              Resultatliste-beregning
    accounts.ts             Porteføljevisning (kontantsaldo + beholdninger + avkastning)
    money.ts                Desimalpresis pengehåndtering + kurtasjeformel
prisma/
  schema.prisma            Datamodell
  migrations/               SQL-migrasjoner (inkl. håndskrevne CHECK-constraints)
  seed.ts                   Demodata-script
tests/                       Vitest-tester (handel, tilgangskontroll, rangering)
docs/marketdata.md           Krav til en ekte markedsdataleverandør
```

### Nøkkelprinsipper i handelsmotoren

- **All validering og utførelse skjer på serveren.** Klienten sender kun
  ticker/side/antall/idempotensnøkkel — server bestemmer utførelsespris,
  saldo og avkastning.
- **Databasetransaksjoner + radlåsing** (`SELECT ... FOR UPDATE`) rundt
  konto­oppdateringer forhindrer at samtidige ordre kan overtrekke en konto
  eller selge flere aksjer enn man eier.
- **Idempotens**: hver ordre har en unik `(konto, idempotensnøkkel)`-rad.
  Gjentatte/parallelle forespørsler med samme nøkkel returnerer samme
  resultat i stedet for å utføre ordren på nytt.
- **Ingen fyll til gammel kurs**: en ordre fylles alltid mot den FØRSTE
  gyldige prisobservasjonen med markedsdatatidspunkt STRENGT ETTER
  serverens mottakstidspunkt for ordren — aldri en allerede kjent pris.
  Se `src/lib/trading/place-order.ts`.
- **Forenklet simulering, ikke full ordrebok**: ordren venter (synkront,
  innenfor samme forespørsel) på neste gyldige kursobservasjon, avgrenset
  av `ORDER_MAX_WAIT_MS`. Overskrides denne, eller ville fyllingen skjedd
  etter at markedet/sesongen er stengt, avvises/utløper ordren i stedet.

## Hva er faktisk verifisert

- ✅ `npm run build` (Next.js production build) fullfører uten feil
- ✅ `npx eslint .` og `npx tsc --noEmit` uten feil eller advarsler
- ✅ `npm test` — 36 automatiserte tester grønne, blant annet:
  - kjøp/salg fyller korrekt, trekker/krediterer kontantsaldo inkl. kurtasje
  - avvisning ved manglende dekning (kjøp) og manglende beholdning (salg)
  - to samtidige ordre som til sammen overstiger dekning/beholdning: nøyaktig
    én fylles, aldri negativ saldo eller beholdning (radlåsing virker)
  - duplikate/samtidige forespørsler med samme idempotensnøkkel gir samme
    ordre, ikke dobbel utførelse
  - tilgangskontroll: kan ikke handle på eller kansellere andres konto,
    kan ikke handle i en sesong som ikke er aktiv
  - ordre fylles aldri til en kjent/gammel kurs; utløper korrekt ved for
    lang ventetid; avvises når markedet er stengt
  - resultatlisten rangerer korrekt etter prosentvis avkastning, bruker
    samme verdsettelsestidspunkt for alle, og markerer (ikke nuller ut)
    manglende priser
- ✅ Manuell ende-til-ende-gjennomgang i nettleser (Playwright, mobilvisning
  390×844): registrering/innlogging → oversikt → marked → søk → kjøp →
  bekreftelse → portefølje → ordrehistorikk → liga → resultatliste → profil
  → utlogging. Se skjermbilder fra denne gjennomgangen om ønskelig.

## Hva gjenstår før en eventuell produksjonssetting

Dette er en MVP/demo. Følgende er **ikke** gjort, og må vurderes før en
reell konkurranse med ekte deltakere:

- **Ekte markedsdata**: se [`docs/marketdata.md`](docs/marketdata.md) for
  full liste over avklaringer (dekning, lisens, forsinkelse, lagring, kost)
  samt nødvendig håndtering av helligdager, aksjesplitt og utbytte.
- **Bakgrunnsjobb for ordreutførelse**: dagens motor venter synkront innenfor
  HTTP-forespørselen (fungerer fint med korte, konfigurerbare
  tick-intervaller i demoen). En ekte, saktere/forsinket feed bør flyttes
  til en kø/bakgrunnsprosess med webhook/polling-varsling til klienten,
  ikke en lang-holdt HTTP-forbindelse.
- **E-postverifisering, passord-reset og rate limiting** på autentisering
  er ikke implementert.
- **Automatisert sesongstenging/opprydding**: sesongstatus beregnes i dag
  dynamisk fra dato (ingen bakgrunnsjobb kreves for korrekthet), men det
  finnes ingen automatisk varsling/e-post ved sesongslutt.
- **Overvåkning, logging og varsling** i produksjonsdrift.
- **Sikkerhetsgjennomgang** utover det som er gjort her (se
  "Sikkerhet"-avsnittet under) — bør inkludere en dedikert
  penetrasjonstest/kodegjennomgang før ekte penger eller premier
  involveres (noe denne versjonen uansett ikke støtter).
- **Skalerbarhet**: `MOCK_MARKET_TICK_INTERVAL_MS` og ventelogikken er
  tunet for demoformål; en produksjonsversjon med mange samtidige brukere
  bør laste- og ytelsesteste ordreflyten.

## Sikkerhet

- Passord hashes med bcrypt (12 runder) — aldri lagret i klartekst.
- Sesjoner er JWT-baserte via Auth.js; `AUTH_SECRET` må aldri committes
  eller sendes til klienten (`.env` er gitignoret, `.env.example` inneholder
  kun placeholder-verdier).
- Alle handelsruter verifiserer eierskap til kontoen på serveren
  (`ForbiddenError` ved forsøk på å handle/kansellere på andres konto).
- Private ligaer sjekker medlemskap server-side før liga-/resultatdata vises
  (`notFound()` i stedet for å lekke at en liga/konto finnes).
- Alle pengebeløp er `Decimal`/`NUMERIC` — ingen float-aritmetikk i
  handelsveien.

## Norsk regelverk for handel (oppsummert)

- Bare hele aksjer, kun kjøp/salg av eksisterende beholdning — ingen
  shorting, gearing eller derivater.
- Handel krever at markedet er åpent (mandag–fredag, konfigurerbare
  åpningstider) og at sesongen (for ligakontoer) er aktiv.
- Simulert kurtasje: flat avgift + prosentandel av handelsverdien, begge
  konfigurerbare via `.env` (se `BROKERAGE_FLAT_FEE_NOK` og
  `BROKERAGE_PERCENT_FEE`).
- 100 000 fiktive NOK per bruker per liga-sesong; øvingskontoen er egen og
  påvirkes ikke av liga-sesonger.
- Ingen nullstilling eller ekstra kapital tilføres en aktiv sesong.
