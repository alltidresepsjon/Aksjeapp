# Flerspiller: Turf War

## Flyt

1. Spilleren åpner **Turf War**, skriver inn navn og lager et rom (velger 0–3 AI-familier og lengde i dager). Serveren gir rommet en kode på fire bokstaver.
2. De andre blir med med koden eller invitasjonslenken (`?room=KODE`). Rommet tar opptil 4 familier.
3. Verten starter. Serveren bygger byen (`buildTurfWorld`) og sender `start` med kartbeskrivelsen. Klientene genererer det samme kartet lokalt.
4. Serveren tikker 10 ganger i sekundet og sender **øyeblikksbilder 5 ganger i sekundet** til hver spiller. Hvert bilde er filtrert gjennom tåken (`makeSnapshot`): du får bare fiendtlige enheter, skudd og hendelser du kan se. Rivalenes pengebeholdning rundes av.
5. Klientene sender bare `cmd` (ordre). Serveren svarer med `cmdErr` hvis en ordre blir avvist.

## Tid

- **Fart** (1×, 2× eller 3×) styres av verten.
- **Pause** og **hopp til kveld/morgen** krever at alle tilkoblede spillere stemmer for. Den samme knappen opphever pausen.

## Frakobling

Klienten husker en token i `sessionStorage`. Kobler du til igjen, får du tilbake familien din. En spiller som forlater kampen, blir erstattet av AI, så de andre kan spille videre. Rom uten spillere stenges etter 5 minutter.

## Seier

Du slår ut en familie ved å ta hovedkvarteret dens eller drepe Don-en. Den siste familien som står igjen, vinner. Når siste dag er over, vinner familien med høyest verdi (kontanter pluss eiendom).
