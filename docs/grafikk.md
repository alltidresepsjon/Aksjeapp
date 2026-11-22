# Grafikk

All grafikk lages i kode. Det gjør det lett å endre farger og stil, og det betyr at spillet ikke bruker noe lånt materiale.

- **Hus** (`render/tex/buildings.ts`): et isometrisk volum med teglstein eller panel, vinduer, butikkfront med markise og skilt (med byggets eget navn), takdetaljer (piper, vanntårn, kirkespir, kuppel) og et eget lag med opplyste vinduer for natta. Brente hus får en sotet variant.
- **Folk** (`render/tex/sprites.ts`): fire bilder per utseende (står, går ×2, sikter). Fargen viser familien, politiet har uniform og sivile har egne farger.
- **Biler**: fire retninger og fire modeller (roadster, sedan, lastebil, panserbil) pluss drosje.
- **Lys**: gatelys og frontlykter tegnes med additiv blanding og blir sterkere når det mørkner.

## Bytte inn egne bilder (videre arbeid)

Konvensjonene står i `packages/client/public/assets/graphics/README.md`. Den enkleste måten å koble inn egne filer på er i `WorldRenderer.ensureBuildings` og `personTex`: last en PNG med `Assets.load` og bruk den i stedet for den genererte teksturen.
