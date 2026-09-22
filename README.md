# Aksjeanalyse

En **privat** plattform for å undersøke om AI kan gi positiv avkastning og
meravkastning mot en referanseindeks etter realistiske kostnader, med
kontrollert risiko. Systemet skal kunne konkludere med at en strategi ikke
fungerer og la være å handle — det gis ingen løfter om avkastning.

**Ingen ekte penger.** Denne versjonen er paper trading: simulert handel
med enten syntetiske (DEMO) eller ekte (PAPER, ikke koblet til ennå)
markedsdata. Automatisk handel med ekte penger er bevisst ikke bygget, og
krever en egen, eksplisitt avklaring senere (leverandørvilkår, risiko,
regelverk).

## Tre datamoduser

| Modus | Data | Status |
|---|---|---|
| **DEMO** | Syntetiske, deterministisk genererte kurser | ✅ Fungerer, brukes til å vise grensesnittet |
| **PAPER** | Ekte markedsdata | ❌ Ingen leverandør koblet til ennå — se [`docs/dataleverandorer.md`](docs/dataleverandorer.md) |
| **LIVE READ-ONLY** | Lesetilgang til en reell portefølje | ❌ Ikke bygget — egen, senere avklaring |

Hver konto har sin egen datakilde basert på modus (`src/lib/market/index.ts`).
Et forsøk på å handle på en PAPER- eller LIVE-konto feiler i dag **tydelig**,
i stedet for stille å bruke DEMO-data.

## Teknologi

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind CSS v4**
- **PostgreSQL** via **Prisma ORM** — alle pengefelt er `Decimal`/`NUMERIC`, aldri float
- **Auth.js (NextAuth v5)** med e-post/passord, JWT-sesjoner, og en
  **tillatt-liste** (`ALLOWED_EMAILS`) — ingen åpen registrering
- **Vitest** for tester
- Tenkt driftet på **Railway** (se lenger ned)

## Tilgangsoversikt

| Tjeneste | Formål | Status |
|---|---|---|
| GitHub (`alltidresepsjon/Aksjeapp`) | Kodelager | ✅ I bruk |
| Railway | Hosting av app + Postgres | ⏳ Må kobles til av deg (se under) — ingen Railway-tilgang er brukt til å bygge dette |
| Anthropic API-nøkkel | AI-analyse i selve appen (adskilt fra Claude Code) | ⏳ Ikke koblet til — ingen AI-logikk er bygget i etappe 1 |
| Markedsdataleverandør (PAPER) | Ekte kurser | ⏳ Ikke avklart — se `docs/dataleverandorer.md` |
| Megler (LIVE read-only) | Fremtidig lesetilgang | ⏳ Ikke aktuelt før en egen, senere avklaring |

## Kom i gang lokalt

### Forutsetninger

- Node.js 20.9+
- PostgreSQL 14+ kjørende lokalt (eller en ekstern `DATABASE_URL`)

### Oppsett

```bash
npm install
cp .env.example .env
```

Rediger `.env`:
- Sett `ALLOWED_EMAILS` til din(e) egen(e) e-postadresse(r) (kommaseparert).
- Generer en ekte `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Juster `STARTING_CAPITAL`, `BROKERAGE_*`, `SLIPPAGE_PERCENT`, kostnadstak osv. ved behov — se kommentarene i `.env.example`.

```bash
createdb aksjeanalyse
npm run db:migrate
npm run db:seed
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

Demobruker fra seed-scriptet: **demo@aksjeanalyse.no** / **Demo1234!**
(husk å legge denne e-posten i `ALLOWED_EMAILS` for å kunne logge inn —
seed-scriptet oppretter brukeren direkte i databasen og går utenom
registreringens tillatt-liste-sjekk, men innlogging går gjennom vanlig
autentisering).

### Tester

Egen testdatabase (rører aldri utviklingsdataene dine):

```bash
createdb aksjeanalyse_test
DATABASE_URL="postgresql://<bruker>:<passord>@localhost:5432/aksjeanalyse_test?schema=public" npx prisma migrate deploy
npm test
```

### Bygg

```bash
npm run build
npm start
```

## Deploy til Railway

Ingen Railway-tilgang er tilgjengelig i denne utviklingsøkten — koden er
forberedt for Railway, men aldri faktisk deployet eller testet der. Slik
kobler du det til selv:

1. Opprett et nytt Railway-prosjekt, koble det til `alltidresepsjon/Aksjeapp`
   (GitHub-integrasjon — Railway deployer automatisk ved push, ingen
   Railway-tilgang trengs fra Claude sin side).
2. Legg til et **PostgreSQL**-tillegg i prosjektet. Railway setter
   `DATABASE_URL` automatisk.
3. Sett resten av miljøvariablene fra `.env.example` under **Variables** i
   Railway — aldri i chat, kode eller logger. Minst påkrevd:
   `AUTH_SECRET`, `ALLOWED_EMAILS`.
4. `railway.json` er allerede satt opp til å kjøre `prisma migrate deploy`
   automatisk før hver oppstart, og til å helsesjekke `/api/health`.
5. Kjør `npm run db:seed` manuelt (via `railway run`) hvis du vil ha
   demodata i produksjonsmiljøet — vurder om det i det hele tatt er
   ønskelig utenfor et rent testmiljø.

## Arkitektur i korte trekk

```
src/
  app/
    (app)/              Innlogget skall: Oversikt, Kalender, Handle, Profil
    logg-inn/, registrer/  Offentlige auth-sider (registrering krever ALLOWED_EMAILS)
    api/orders/          Ordreplassering (DEMO/PAPER)
    api/health/          Offentlig helsesjekk for Railway
  lib/
    market/               MarketDataProvider-grensesnitt + DemoProvider
    trading/               Ordreutførelse: låsing, idempotens, nødstopp
    accounting/             Regnskapsmotor: dagssnapshots, tidssone, nøkkeltall
    kill-switch.ts          Nødstopp for all handel (satt av menneske, aldri AI)
    auth/register.ts        Registrering med tillatt-liste
prisma/
  schema.prisma           Datamodell (se kommentarer for etappe-avgrensning)
  migrations/               SQL-migrasjoner
  seed.ts                  Demodata-script
tests/                     Vitest-tester
docs/                      Utdypende dokumentasjon (se under)
```

### Nøkkelprinsipper i handelsmotoren

- **All validering og utførelse skjer på serveren.** Klienten bestemmer
  aldri utførelsespris, saldo eller resultat.
- **Databasetransaksjoner + radlåsing** rundt kontooppdateringer hindrer at
  samtidige ordre kan overtrekke en konto eller selge flere aksjer enn man
  eier.
- **Idempotens**: hver ordre har en unik `(konto, idempotensnøkkel)`-rad —
  gjentatte/parallelle forespørsler gir samme resultat, aldri dobbel
  utførelse.
- **Ingen fremtidsinformasjon**: en ordre fylles alltid mot den FØRSTE
  gyldige prisobservasjonen STRENGT ETTER serverens mottakstidspunkt for
  ordren — aldri en allerede kjent kurs.
- **Nødstopp**: satt av et menneske via Profil-siden, sjekkes FØR alt annet
  i `placeOrder`. En språkmodell kan aldri sette den til eller fra.
- **Regnskapet er ren, deterministisk kode** (`src/lib/accounting/`) — ingen
  AI er involvert i noen tall som helst. Se
  [`docs/beregningsmetoder.md`](docs/beregningsmetoder.md) for formlene.

## Hva er faktisk verifisert

- ✅ `npm run build`, `npx eslint .`, `npx tsc --noEmit` — alle uten feil
- ✅ `npm test` — 48 automatiserte tester grønne: porteføljeregnskap og
  dagsresultat, innskudd/uttak holdt utenfor resultatet, idempotent
  gjenberegning, stengt marked (helg) gir nøytralt resultat, manglende
  prisdata flagges (aldri verdsatt til 0), tidssone/sommertid-håndtering,
  kjøp/salg, manglende dekning, samtidige ordre (radlåsing), duplikate
  ordreforespørsler, tilgangskontroll (feil bruker, LIVE_READONLY, PAPER
  uten leverandør), aldri fylt til gammel kurs, nødstopp blokkerer handel
- ✅ Manuell ende-til-ende-gjennomgang i nettleser (Playwright, mobilvisning
  390×844): innlogging → oversikt (DEMO + PAPER-kort) → resultatkalender →
  dagsdetalj → handle → kjøpsbekreftelse → profil
- ❌ **Ikke** deployet eller testet på Railway (ingen tilgang i denne økten)
- ❌ **Ikke** testet mot ekte markedsdata (ingen leverandør avklart)

## Hva gjenstår

Se de fire etappene i den opprinnelige planen — dette er **etappe 1**:

1. ✅ App, database, innlogging og resultatkalender med merkede demodata
2. ⏳ Reelle data og fungerende PAPER-handel (krever avklaring av
   markedsdataleverandør, se `docs/dataleverandorer.md`)
3. ⏳ Daglige/ukentlige rapporter og evaluering
4. ⏳ Kandidatstrategier og kontrollert forbedringsprosess, AI-drevne
   beslutninger med beslutningsjournal, sammenligning av AI-modeller

Se også [`docs/kjente-begrensninger.md`](docs/kjente-begrensninger.md) for
en fullstendig liste over forenklinger og hva som konkret må på plass før
noe av dette brukes til reelle beslutninger.

## Dokumentasjon

- [`docs/dataleverandorer.md`](docs/dataleverandorer.md) — hva som må
  avklares for ekte markedsdata og nyhetskilder
- [`docs/beregningsmetoder.md`](docs/beregningsmetoder.md) — nøyaktig
  hvordan dagsresultat, avkastning og risikomål beregnes
- [`docs/kjente-begrensninger.md`](docs/kjente-begrensninger.md) —
  forenklinger, kjente begrensninger, og sikkerhets-/kostnadsnotater

## Sikkerhet (kort)

- Passord hashes med bcrypt (12 runder), aldri lagret i klartekst.
- Alt bak innlogging som standard (`src/proxy.ts`) — kun `/logg-inn`,
  `/registrer`, `/api/auth/*` og `/api/health` er offentlige.
- Registrering krever en e-post på `ALLOWED_EMAILS` — plattformen er ikke
  åpen for hvem som helst.
- Alle handelsruter verifiserer kontoeierskap server-side.
- Nødstopp (`SystemSetting`) kan stanse all handel umiddelbart, uavhengig
  av kontomodus.
- `.env` er gitignoret; `.env.example` inneholder kun placeholder-verdier.
  Ekte hemmeligheter hører hjemme i Railway Variables, aldri i kode, chat
  eller logger.

Full sikkerhetsgjennomgang, rate limiting på innlogging og
kostnadssporing i sanntid er **ikke** implementert ennå — se
`docs/kjente-begrensninger.md`.
