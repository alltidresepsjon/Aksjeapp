# Beregningsmetoder

All beregning under er **ren, deterministisk kode**
(`src/lib/accounting/`) — ingen AI/språkmodell er involvert i noen av
tallene. Kildekoden er den endelige sannheten; dette dokumentet forklarer
konvensjonene i klartekst.

## Dagsresultat

For hver handelsdag (`DailySnapshot`) beregnes:

```
dayResult = endValue - startValue - netDeposits
```

- `startValue` / `endValue`: total porteføljeverdi (kontanter +
  markedsverdi av alle posisjoner) ved henholdsvis begynnelsen og slutten
  av handelsdagen (16:30 Europe/Oslo).
- `netDeposits`: innskudd minus uttak registrert i tidsvinduet — dette
  sikrer at å legge inn mer kapital aldri fremstår som avkastning, og at
  et uttak aldri fremstår som et tap.
- Porteføljeverdi rekonstrueres **punkt-i-tid** fra faktisk ordre- og
  kontantledger-historikk (`src/lib/accounting/reconstruct.ts`), ikke fra
  dagens "gjeldende" beholdning — det gjør beregningen korrekt uansett
  når den kjøres, og trygt å kjøre på nytt (idempotent).

## Realisert vs. urealisert bidrag

`dayResult` er alltid den autoritative verdien. Splitten under er
forklarende, og garantert konsistent med `dayResult` ved konstruksjon:

```
realizedPnl   = Σ (salgspris − snittkost) × antall   [BRUTTO, før kostnader]
costs         = Σ kurtasje/slippage for alle fylte ordre denne dagen
unrealizedPnlChange = dayResult − realizedPnl + costs   [resten, per definisjon]
```

Siden porteføljeverdien kun kan endres av realiserte handler, kostnader,
urealisert kursbevegelse og kapitalbevegelser (som allerede er trukket
fra), vil `realizedPnl + unrealizedPnlChange − costs` alltid summere
nøyaktig til `dayResult`. Dette er en bevisst forenkling: en fullstendig
lot-for-lot-realisasjonsmetode (f.eks. FIFO per skattemessig lot) er ikke
implementert — `avgCost` (glidende snittkost) brukes konsekvent.

## Stengte dager (helg/helligdag)

En dag markeres `marketClosed: true` når den faller på en helg. Start- og
sluttverdi settes til **samme** referanseinstant (forrige faktiske
handelsdags stenging), slik at `dayResult` alltid blir eksakt 0 — ikke en
tilfeldig, "spøkelses"-bevegelse fra en syntetisk pris generert utenfor
åpningstid.

> **Kjent begrensning**: kun ukedag sjekkes i dag, ikke norske/børsspesifikke
> helligdager. Se `docs/kjente-begrensninger.md`.

## Manglende prisdata

Hvis en holdt posisjon mangler en gyldig prisobservasjon på
verdsettelsestidspunktet, flagges snapshotet `dataIncomplete: true`, og
posisjonen holdes **utenfor** verdisummen — den verdsettes ALDRI til 0.
Totalverdien er dermed et dokumentert minimumsanslag den dagen, aldri en
uriktig eksakt verdi. UI viser dette tydelig (⚠-merking).

## Akkumulert resultat og periodeavkastning

- **Akkumulert resultat** = sum av `dayResult` for alle dager fra
  kontoens opprettelse til og med valgt dag.
- **Periodeavkastning** (siste dag/uke/måned) = sum av `dayResult` i
  perioden, delt på porteføljeverdien ved **periodens start** (ikke
  annualisert — korte perioder vises aldri som misvisende
  annualiserte tall).
- **Siden oppstart (%)** = akkumulert resultat delt på startkapitalen.

## Størst verdifall (drawdown)

Løpende topp av kumulativ porteføljeverdi (`startingCapital +
akkumulert dayResult`); drawdown på et gitt tidspunkt er `(verdi − topp)
/ topp`. Det største (mest negative) tallet i serien vises som "Største
fall fra topp".

## Referanseindeks

DEMO-referanseindeksen er et enkelt, likevektet gjennomsnitt av alle
DEMO-instrumentene, normert til å starte på 100. Dette er en pedagogisk
forenkling for demoformål — en reell PAPER-versjon bør bruke en faktisk,
navngitt indeks (f.eks. OSEBX) med egen lisensavklaring (se
`docs/dataleverandorer.md`).

## Simulerte handelskostnader

- **Kurtasje**: flat avgift + prosentandel av handelsverdi
  (`BROKERAGE_FLAT_FEE`, `BROKERAGE_PERCENT_FEE`).
- **Slippage**: kjøp fylles til `pris × (1 + SLIPPAGE_PERCENT)`, salg til
  `pris × (1 − SLIPPAGE_PERCENT)` — en dokumentert forenkling av reelt
  spread/markedsdybde, ikke en ordrebok-simulering.
- Valutaveksling er ikke modellert ennå (`fxImpact` er alltid 0) — alle
  DEMO-instrumenter er i NOK. Se `docs/kjente-begrensninger.md`.

## Idempotens og gjenkjøring

`computeDailySnapshot(accountId, tradingDate)` er en ren `upsert` —
gjentatte kall for samme dag overskriver med samme (eller oppdaterte,
hvis ny historikk er lagt til) tall, uten å opprette duplikater.
`ensureSnapshotsThrough` bygger ut manglende dager fra kontoens
opprettelse og frem til en gitt dato, og er trygg å kalle på nytt etter
en omstart eller feilet jobb.
