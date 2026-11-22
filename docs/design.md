# Spilldesign

## Kjernen

Bathtub Gin bygger videre på oppdragsstrukturen fra klassiske gangsterstrategispill fra rundt 2000, men retter opp de kjente svakhetene:

| Kritikk av sjangeren | Slik løser vi det |
|---|---|
| Oppdragene var like hverandre | Hvert kapittel har sin egen mekanikk: forsvar, kidnapping, spritlogistikk, attentat, beleiring med safeknekking, bankran og befrielse, sluttoppgjør |
| Kampen var bare «prikker mot prikker» | Våpenrekkevidde, Aim, dekning bak vegger, synlighet (Stealth) og overraskelsesangrep teller. Med aggresjonsnivå og flukt ved lav helse styrer du kampen uten å detaljstyre den |
| Mye venting | Fart 1×/2×/3×, pause, og knappen ⏭ som hopper til kveld eller morgen. Hoppet stopper av seg selv når noe skjer |
| Tungvint å ansette managere | Managere ansettes i menyen til selve bygget |
| Dum AI | Rivalene samler seg i lag før angrep, forsvarer bygg som blir truet, trekker sårede tilbake, prioriterer svake mål, hevner seg og bemanner hovedkvarteret. De ser bare det de faktisk kan se |

## Stats

- **Muscle**: helse og hvor fort du tar over bygg med makt
- **Aim**: treffsikkerhet
- **Charm**: hvor fort du får pressepenger, og bedre avtaler
- **Stealth**: mindre heat, vanskeligere å oppdage, og ekstra skade på den som ikke er oppmerksom

Gangstere får erfaring av drap, overtakelser, kupp og av å overleve kapitler. Et nytt nivå gir et ferdighetspoeng og mer helse.

## Økonomi

- Lovlige bedrifter betaler hver time mellom 08:00 og 20:00. Klubber og kasinoer betaler hele døgnet.
- Rackets betaler mellom 20:00 og 04:00. En speakeasy bruker en kasse annenhver time, og uten kasser tjener den bare 20 %. Et brenneri lager 3 kasser per natt.
- Lønn trekkes kl. 06:00. Har du for lite penger, slutter den som tjener mest.
- Razzia kan komme kl. 23:00. Sjansen øker med heat. En bestukket politikaptein stopper razziaer, og vakter kan av og til jage politiet bort.

## Heat og politi

Skudd, drap, overtakelser, brann og kupp gir heat. Stealth og mørke demper det. Fra 50 i heat jakter politiet på personen og arresterer ved kontakt. Politiet skyter bare på dem som skyter på politiet, eller på svært ettersøkte folk med holdningen *Attack*. Heat synker raskere når du gjemmer deg inne i et bygg.

## Kapitlene

| # | Bydel | Mål | Nytt |
|---|---|---|---|
| 1 | Foundry Street | Få kontroll på 4 bedrifter, og hold bakeriet gjennom natta | Grunnstyring, aggresjon, forsvar |
| 2 | Mercer Street | Skaff en bil, kidnapp Doyles bagmann og avhør ham | Biler, kidnapping, tåke |
| 3 | Canal Docks | Brenneri og speakeasy, lever 10 kasser, og tjen $2 500 | Rackets, managere, frakt, forsyningsruter |
| 4 | Larkin Avenue | Drep Mick Doyle, som går runder med livvakter | Leiemorder, drive-by, kortspiller gir rykter |
| 5 | Orchard Street | Ta Doyle Hall og knekk safen (regnskapet) | Beleiring, safeknekker, brannstifter |
| 6 | Bank District | Få Dot Okafor ut av fengsel, og ran banken for $4 000 | Fixer, dommer, bankran og alarm |
| 7 | Kessler Heights | Drep Victor Kessler og ta Kessler Manor | Alt sammen |

Kapitlene er definert som data i `packages/shared/src/data/chapters.ts`. Der står kart, familier, figurer, mål og skriptede hendelser.

### Kartformat

En by er et rutenett av kvartaler på 6×6 ruter, med gater som er 2 ruter brede mellom dem. Hvert kvartal er enten
`f:<tomt>` (én stor tomt) eller `q:<NV>,<NØ>,<SV>,<SØ>` (fire tomter på 3×3 ruter), eventuelt `park`, `plaza` eller `water`.
En tomt skrives slik: `type[@eier][#tag][*etasjer][!Navn]`, for eksempel `hq@P#hq*3!Corrado House`.
