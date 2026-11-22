# Bathtub Gin: Blood Debt

Nettleserspill (TypeScript-monorepo): `packages/shared` (simulering, ren TS), `packages/client` (Vite + PixiJS v8), `packages/server` (Node + ws).

- Kjør `npm test` og `npm run typecheck` etter endringer i simuleringen. `npm run build` sjekker klienten.
- All spilllogikk hører hjemme i `shared`, og tilstanden må forbli JSON-serialiserbar (spillet kjører også på serveren).
- Spillerhandlinger går via `Command` → `World.command()`. Klienten skal aldri endre tilstanden direkte.
- Tomter må være kvadratiske (3×3 eller 6×6) av hensyn til dybdesorteringen i rendereren.
- Tekst i spillet er på engelsk. Dokumentasjon og commit-meldinger er på norsk.
- Bruk ikke navn, figurer eller grafikk fra eksisterende spill.
