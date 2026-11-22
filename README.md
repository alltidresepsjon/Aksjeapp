# Bathtub Gin: Blood Debt

Et sanntids strategispill i nettleseren om forbudstiden. Det foregår i den fiktive byen Port Halloran i 1928.
Du er Nico Corrado. Faren din, bakeren Sal Corrado, er skutt utenfor bakeriet sitt. Du skal finne ut hvem som sto bak, og gjøre opp regnskapet.

Spillet er på engelsk og fungerer både på PC og mobil.

## Kom i gang

Du trenger Node 20 eller nyere.

```bash
npm install          # installerer alle pakkene (workspaces)
npm run dev          # starter spillserveren (port 8787) og Vite (port 5173)
```

Åpne <http://localhost:5173>. Kampanjen kjører helt i nettleseren. Turf War (flerspiller) trenger at serveren kjører, og det gjør `npm run dev` for deg.

Vil du teste på mobilen i samme nettverk? Vite skriver ut en nettverksadresse (f.eks. `http://192.168.1.20:5173`). Åpne den på telefonen.

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | Utviklingsmodus med automatisk omlasting |
| `npm test` | Kjører testene for simuleringen (Vitest) |
| `npm run typecheck` | TypeScript-sjekk av alle pakkene |
| `npm run build` | Bygger klienten til `packages/client/dist` |
| `npm start` | Produksjonsserver: serverer det bygde spillet og WebSocket på samme port (`PORT`, standard 8787) |
| `npm run art` | Importerer egne bilder fra `art-inbox/` |
| `npm run shots` | Tar skjermbilder med Playwright (krever at `npm start` kjører) |

## Hva er med

- **Vanskelighetsgrad og lagring**: lett, normal eller vanskelig. Kapitler lagres automatisk hver morgen og med «Save game» i menyen.
- **Kampanje i 7 kapitler**, hvert med eget kart, briefing og valg av crew. Mellom kapitlene er du i et safehouse: der fordeler du ferdighetspoeng, kjøper våpen og biler, og ansetter eller sparker folk via avisa. Spillet lagres automatisk i nettleseren.
- **Isometrisk by** med hus, gater, gatelys, trær, folk og trafikk. Du kan panorere og zoome (mus, hjul eller to fingre), og det er et minikart.
- **Kamp**: du sender folkene dine og velger aggresjon (*Passive*, *Defend*, *Attack*) og om de skal *flykte når de er såret*. Resten går automatisk. Våpenrekkevidde, Aim, dekning bak vegger og Stealth avgjør hvordan det går.
- **Fem våpen**: revolver, doble pistoler, hagle, Tommy gun og rifle.
- **Biler**: kjøring, drive-by, frakt av spritkasser og automatiske forsyningsruter.
- **Spesialister**: safeknekker (bankran og safer), brannstifter, leiemorder, kortspiller og fixer. I tillegg kan du **kidnappe** og avhøre folk eller kreve løsepenger.
- **Ulovlige bedrifter** (speakeasy, brenneri, spillehule) bak lovlige fasader. De trenger en manager og helst vakter, og de kan få politirazzia.
- **Dag og natt**: butikkene tjener penger om dagen og rackets om natta. Bankran skjer bare om natta. Du kan hoppe til kveld eller morgen.
- **Managere ansettes rett fra byggets meny**, ikke via en egen avisskjerm.
- **Fra prototypen**: pause og 1×/2×/3× fart, avisa med overskrifter, heat og politi, bestikkelser (politikaptein, rådmann og dommer), kausjon, og at du taper hvis Nico dør eller hovedkvarteret faller.
- **Turf War**: 2–4 spillere på nett med romkode, eventuelt med AI-familier i tillegg. Serveren styrer simuleringen, og det er tåke slik at du bare ser det folkene dine ser.

## Prosjektstruktur

```
packages/
  shared/   Spillsimuleringen (ren TypeScript): kart, stifinning, kamp, AI, politi, økonomi,
            biler, kapitler og mål, kampanjelagring, nettverksprotokoll. Testene ligger i test/.
  client/   Nettleserklienten: Vite + PixiJS. Kildekoden ligger i src/ (render/, ui/, app/, audio/, input/, session/).
            Grafikk og lyd ligger i public/assets/graphics og public/assets/audio.
  server/   Node + ws: Turf War-rom og statisk servering av det bygde spillet.
docs/       Design, arkitektur, flerspiller og grafikk.
scripts/    Hjelpeskript (skjermbilder).
```

Mer om oppbyggingen finner du i [docs/arkitektur.md](docs/arkitektur.md). Spilldesignet og kapitlene står i [docs/design.md](docs/design.md), og flerspilleren i [docs/flerspiller.md](docs/flerspiller.md).

## Om grafikk og lyd

Grafikken tegnes i kode, men kan byttes ut bit for bit med egne bilder, for eksempel laget i ChatGPT.
Ferdige prompter og filnavn står i [docs/grafikk-prompter.md](docs/grafikk-prompter.md). Legg bildene i `art-inbox/` og kjør
`npm run art`. Skriptet fjerner bakgrunn, beskjærer og skalerer. `npm run art:clear` fjerner dem igjen.

Lyd og musikk er opptak med åpne lisenser fra OpenGameArt (se `packages/client/public/assets/audio/CREDITS.md`).
Resten lages med Web Audio. Skriftene (Limelight, Libre Franklin og Old Standard TT) har OFL-lisens og leveres via `@fontsource`.

## Publisering

`npm run build && npm start` gir én Node-prosess som serverer både spillet og WebSocket-forbindelsen. Den kan kjøres på hvilken som helst Node-vert (Railway, Fly.io, Render eller egen server). Sett `PORT` om verten krever det.
