# Grafikk

Det meste av grafikken tegnes i kode når spillet starter (`packages/client/src/render/tex/`).
Denne mappa er for bildefiler som skal erstatte eller komme i tillegg til den genererte grafikken.

Konvensjon for å bytte inn egne bilder (planlagt, se `docs/grafikk.md`):

- `buildings/<type>.png`: fasade for en bygningstype (isometrisk, 64 px per rute)
- `people/<family>.png`: spritesheet med 4 ruter (står, gå 1, gå 2, sikter)
- `vehicles/<model>-<retning>.png`
