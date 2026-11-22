# Arkitektur

## Prinsipp: én simulering, to steder

All spillogikk ligger i `packages/shared`. Den er ren TypeScript uten DOM, slik at den kan kjøre både i nettleseren (kampanjen) og på serveren (Turf War). Hele tilstanden (`WorldState`) er vanlig JSON.

- **Tikk**: 10 per sekund ved 1× fart (`DT = 0.1`). En spilltime er 10 sekunder, og et døgn er 4 minutter.
- **Kommandoer** (`sim/commands.ts`) er det eneste spillerne kan gjøre. `World.command(fam, cmd)` sjekker hver ordre. Det betyr at flerspiller er trygt: klienten kan bare be om ting, ikke endre tilstanden selv.
- **Hendelser** (`GameEvent`: skudd, død, kontant, overtakelse, varsel osv.) legges i en kø med økende id. Klienten tegner effekter og spiller lyd for hver ny hendelse.

### Moduler i `shared`

| Fil | Innhold |
|---|---|
| `map/mapgen.ts` | Lager tile-kart og tomter fra kvartalsbeskrivelsen |
| `map/pathfind.ts` | A* med 8 retninger, utglatting av rutene, siktlinje og dekning |
| `sim/world.ts` | Hovedsløyfen: tid, økonomi, ordre, bevegelse, handlinger ved bygg, biler, kamp, politi, tåke og kommandoer |
| `sim/ai.ts` | AI for rivalfamiliene: ansettelser, forsvar, garnison, angrepslag som samler seg først, innkreving |
| `sim/objectives.ts` | Kapittelmål, skriptede hendelser og sjekk av seier og tap |
| `sim/units.ts` | Opprettelse av enheter, avisannonser, erfaring og nivåer |
| `campaign.ts` | Kampanjelagring: crew, kontanter og biler mellom kapitlene |
| `turf.ts` | Oppsett av Turf War |
| `net/protocol.ts` | Meldinger mellom klient og server, og øyeblikksbilder filtrert gjennom tåken |

## Klienten

- `session/`: et felles `Session`-grensesnitt. `LocalSession` kjører `World` i nettleseren. `NetSession` mottar øyeblikksbilder og interpolerer bevegelsene.
- `render/`: PixiJS. `ground.ts` tegner gater, fortau, parker og vann som vektorgrafikk. `tex/buildings.ts` og `tex/sprites.ts` tegner hus, folk, biler og rekvisitter på canvas, og de blir til teksturer. `WorldRenderer.ts` håndterer dybdesortering (x+y), dag og natt (tint og additive lys), tåke, effekter og treffsjekk. `ambient.ts` står for fotgjengere og trafikk, som bare er pynt og ikke påvirker spillet. `Minimap.ts` tegner minikartet.
- `input/Input.ts`: mus, berøring, to-finger-zoom, langt trykk, høyreklikk og boksvalg.
- `app/Game.ts`: ett pågående oppdrag med HUD, paneler, byggmeny og valgt crew.
- `app/App.ts`: skjermflyten (tittel, briefing, safehouse, rapport og Turf War-lobby).
- `audio/Audio.ts`: Web Audio-effekter og musikk. Bruker filer fra `public/assets/audio` hvis de finnes.

## Dybdesortering

Alle tomter er kvadratiske. Da gir dybden `x+y` for punkter (folk, biler, lykter) og `x0+y0+size` for hus riktig rekkefølge for alt som står på gatene rundt. Ikke legg inn rektangulære tomter uten å endre sorteringen.
