# Egne bilder med ChatGPT: prompter og filnavn

Spillet bruker bildene dine automatisk der de finnes. Alt som mangler, tegnes fortsatt av koden, så du kan bytte inn bilder ett og ett.

## Slik gjør du det

1. Åpne **én** ny samtale i ChatGPT per gruppe (hus, figurer, biler, grensesnitt). Bruk den samme samtalen for hele gruppen, så holder stilen seg likere.
2. Lim inn **stilbeskrivelsen** (del 1) som første melding i hver samtale.
3. Lim deretter inn én prompt om gangen, **og legg ved riktig mal-tegning fra `docs/maler/`** (se tabellen under). Malen er det viktigste for at vinkelen blir riktig. Last ned hvert bilde som PNG.
4. Gi filen **nøyaktig** navnet som står foran prompten, for eksempel `building-shop-3-1.png`.
5. Legg filene i `art-inbox/` (via GitHub: «Add file → Upload files»), eller send dem til meg i chatten.
6. Kjør `npm run art`, eller be meg gjøre det. Skriptet fjerner bakgrunnen, beskjærer og skalerer bildene.

**Maler (last ned fra `docs/maler/` og legg ved hver gang)**

| Mal | Brukes til |
|---|---|
| `mal-hus-lav.png` | Hus i 1–2 etasjer (butikker, diner, garasje, frisør) |
| `mal-hus-middels.png` | Hus i 3–4 etasjer (bakeri/hovedkvarter, leiegårder, klubber, politistasjon) |
| `mal-hus-hoyt.png` | Hus i 5–8 etasjer (hoteller, høye leiegårder) |
| `mal-figur.png` | Alle figurark (fire positurer) |
| `mal-bil.png` | Alle biler |

Den grå ruta i malen er tomta, og den blå klossen viser hvordan vegger og tak skal stå. Huset kan stikke ut av klossen med tak, tårn og markiser, men alle kanter skal ha **samme retning** som klossens kanter.

**Sjekk vinkelen:** Kjør `npm run art:check` (eller be meg gjøre det). Da legges en turkis fasit-kloss oppå hvert hus i `art-inbox/sjekk/`. Hvis veggene vider seg ut oppover, eller takkanten er flatere enn bakken, har ChatGPT brukt perspektiv. Be den lage bildet på nytt med setningen under «Retting».

**Tips**
- Be om *transparent background* der det står. Får du likevel en ensfarget hvit eller grå bakgrunn, fjerner skriptet den.
- Hvis et bilde skiller seg ut, svar: *«Same style, light and camera angle as the previous images, but …»*.
- La ChatGPT droppe tekst på skilt i spillverdenen. Spillet viser navnene selv. Logoen og tittelbildet er de eneste unntakene.
- Lag gjerne flere varianter (`-1`, `-2`, `-3` …). Spillet fordeler dem mellom bygg og figurer.
- Et godt sted å begynne: `building-shop-3-1`, `person-corrado-1`, `person-doyle-1`, `car-sedan-front` og `car-sedan-rear`, `ui-title` og `ui-tommaso`. Send meg dem først, så justerer jeg plassering og størrelse før du lager resten.

## 1. Stilbeskrivelse (lim inn først i hver samtale)

Stilen henter inspirasjon fra prestisjeseriene om forbudstiden, med badebyer, strandpromenader og gangstere i skreddersydde dresser. Vi beskriver bare stilen, uten navn fra noen serie.

```
I am making art for an isometric strategy game set in a fictional American seaside city in 1928, during Prohibition:
a boardwalk resort town and harbour, run by bootleggers, crooked politicians and their crews.
Every image I ask for must follow these rules:

STYLE: painted, cinematic period-drama look. Soft painterly brushwork, rich but muted colours graded warm:
amber and honey highlights, deep teal and slate-blue shadows, brick reds, cream limestone, polished brass, mahogany.
Late-afternoon golden light from the upper left, a faint sea haze, subtle film grain. Lavish 1920s detail: tailored
three-piece suits, fedoras and bowler hats, cloche hats and furs, electric light-bulb marquees, striped awnings,
art-deco ornament. Detailed, but still readable when shown small. No cartoon outlines, no photo-realism, no modern objects.

CAMERA (for buildings, people and cars) — this is a game sprite, so the geometry must be exact:
- Use a strict ISOMETRIC PARALLEL PROJECTION (2:1 pixel-art isometric / dimetric, like a technical axonometric drawing).
  There is NO perspective: no vanishing points, no foreshortening, no wide-angle lens.
- Every vertical edge is perfectly vertical and all verticals are parallel. The building is exactly as wide at the top
  as at the bottom; walls never lean outwards or inwards.
- Every horizontal edge (ground outline, roof edges, cornices, rows of windows, awnings, steps) runs along one of two
  directions only: down-left or down-right, with a slope of exactly 1:2 (it drops 1 pixel for every 2 pixels across,
  about 26.57°). A roof outline is the same diamond shape as the ground outline, only higher up.
- Viewed from the south-east: the front-left wall and the front-right wall are both visible, the nearest corner points
  straight down to the bottom centre of the image.
- I will attach a template image. Build the object inside it: its grey diamond is the ground plot, its blue box shows
  the exact angle of walls and roof. Match the template's angles precisely; do not copy its colours or lines.

FRAMING: exactly ONE object, centred, fully visible, nothing cropped. Transparent background (or plain flat white if
transparency is not possible). No ground, no street, no sky, no other objects, no shadow outside the object.
No text, letters or numbers anywhere (signs and posters stay blank or show simple pictures) unless I ask for text.

Reply only with the image.
```

### Retting når vinkelen blir feil

Lim inn dette sammen med malen på nytt:

```
The angle is wrong: you drew it with perspective. Redraw the SAME building in strict isometric parallel projection,
exactly matching the attached template: all vertical edges perfectly vertical and parallel (the top is as wide as the
bottom), and every roof, cornice and window-row edge parallel to the ground diamond's edges at a 1:2 slope.
No vanishing points. Keep everything else the same.
```

## 2. Hus

Viktig for husene:
- Grunnflaten er **kvadratisk**, og bildet viser huset fra hjørnet.
- Tomtens venstre, nederste og høyre hjørne skal treffe venstre kant, bunnen og høyre kant av motivet.
- Taket kan stikke opp så høyt det vil.
- `3` betyr en liten tomt (en fjerdedel av et kvartal), og `6` betyr en tomt som fyller et helt kvartal.
- Bruk kvadratisk format, 1024×1024.

Legg til denne setningen i hver huprompt:
> *Use the attached template: the building stands on its grey square plot, lowest corner at the bottom centre, left and right corners at the template's left and right corners. Strict isometric parallel projection, no perspective: walls exactly vertical, roof edges parallel to the ground edges at a 1:2 slope.*

| Filnavn | Prompt |
|---|---|
| `building-hq-3-1.png` | The Corrado family home and headquarters: a 3-storey brick bakery-and-townhouse with a gold-trimmed oxblood shopfront, warm light in the windows, heavy oak side door, iron railings, mansard roof with dormers. It should feel loved and proud. |
| `building-hq-6-1.png` | A rival boss's mansion filling a whole city block: 4 storeys of dark brick and limestone, mansard roof, ornate cornices, a portico with columns, iron gates, a small walled garden, a black limousine-sized gateway. |
| `building-shop-3-1.png` | A narrow 2-storey red-brick shop with a striped canvas awning and large display windows, apartments above with sash windows and flower boxes. |
| `building-shop-3-2.png` | A 3-storey cream limestone corner grocery with a green awning, crates of fruit by the door, a painted advert (no letters) on the side wall. |
| `building-shop-3-3.png` | A 2-storey barbershop with a red-white striped pole, slate gable roof, small dormer window, brick chimney. |
| `building-shop-3-4.png` | A 3-storey yellow-brick laundry and tailor's building, steam venting from a pipe, washing hung between windows. |
| `building-shop-3-5.png` | A 2-storey pawn and gun shop with barred windows, dark green wooden shopfront, three brass balls over the door. |
| `building-type-bakery-3-1.png` | A warm 2-storey brick bakery with a gold-trimmed shopfront, bread loaves in the window, a flour-dusted bench outside. |
| `building-type-diner-3-1.png` | A one-storey streamlined chrome diner with teal stripes, long windows, red stools visible inside. |
| `building-tenement-3-1.png` | A 5-storey brick tenement with zig-zag iron fire escapes, laundry lines, a wooden water tower on the flat roof. |
| `building-tenement-3-2.png` | A 4-storey grey limestone tenement with bay windows, a heavy cornice, rooftop chimneys and a small rooftop shed. |
| `building-club-3-1.png` | A jazz club: a 3-storey dark building with a glowing light-bulb marquee (no letters), velvet rope and red carpet at the door, string lights. |
| `building-club-3-2.png` | A casino: a 3-storey art-deco building in black and gold, rows of bulbs around the entrance, tall windows with red curtains. |
| `building-club-6-1.png` | A grand seaside casino and ballroom filling a whole block: white art-deco facade, a domed roof, hundreds of light bulbs, a sweeping entrance canopy. |
| `building-hotel-3-1.png` | A narrow 6-storey boardwalk hotel with a canopy over the entrance, a vertical blade sign without letters, cream stone, many windows, striped window awnings. |
| `building-hotel-6-1.png` | A luxurious 8-storey seaside resort hotel: art-deco tower with stepped setbacks, a spire with a red light, flags on the roof, a grand canopy. |
| `building-garage-3-1.png` | A one-storey brick motor garage with two big roller doors, a red gas pump by the door, tyres stacked outside. |
| `building-warehouse-3-1.png` | A 2-storey corrugated-iron warehouse with a sawtooth roof, big loading doors, crates and barrels outside. |
| `building-warehouse-6-1.png` | A big harbour warehouse filling a whole block: brick and corrugated iron, sawtooth skylight roof, loading docks with crates and a small crane. |
| `building-bank-6-1.png` | A classical savings bank filling a whole block: limestone, tall columns, a pediment, wide steps, bronze doors. |
| `building-precinct-6-1.png` | A 3-storey police precinct house: blue-grey brick, two green lamps by the door, barred basement windows, a flagpole. |
| `building-civic-3-1.png` | A small white-stone courthouse with columns and a copper-green dome. |
| `building-civic-6-1.png` | City Hall filling a whole block: white stone, columns, a large copper-green dome, broad steps, flags. |
| `building-church-6-1.png` | A stone Catholic church with a tall spire, rose window, arched doors, a small graveyard garden. |
| `building-pier-3-1.png` | A smugglers' pier: a wooden shack on stilts over dark water, rope coils, barrels, a lantern, a rowing boat tied up. |

## 3. Figurer med bevegelse (4 positurer i ett bilde)

Hver figur lages som **ett bredt bilde med fire positurer side om side**. Da blir figuren lik i alle fire, og spillet lager animasjonen av dem:

1. står
2. går (venstre fot fram)
3. går (høyre fot fram)
4. sikter med våpenet

Bruk liggende format, 1536×1024. Skriptet deler bildet i fire like store deler. Lager du bare én figur i et høyt bilde, brukes den som stillbilde.

Legg til dette i hver figurprompt:
> *A character sprite sheet: the SAME character drawn four times side by side in a single row, evenly spaced, all the same size, all turned three-quarters towards the bottom-right: (1) standing, (2) walking with left foot forward, (3) walking with right foot forward, (4) aiming the weapon to the right. Full body, feet on the same baseline, small readable silhouette, transparent background. Use the attached template for size, baseline and facing direction (the red arrow); strict isometric view, no perspective.*

| Filnavn | Prompt |
|---|---|
| `person-nico.png` | Nico Corrado, 24, the baker's son turned boss: pale cream fedora, dark green three-piece suit, white shirt, gold tie pin, revolver, serious face. |
| `person-corrado-1.png` | A Corrado family gangster: dark green suit, green hatband, broad shoulders, pump shotgun. |
| `person-corrado-2.png` | A Corrado family gangster: green overcoat, flat cap, revolver, cigarette. |
| `person-corrado-3.png` | A Corrado family woman fixer: green cloche hat, dark green coat with fur collar, handbag, small pistol. |
| `person-doyle-1.png` | A Doyle Gang thug: brown tweed suit, orange tie, flat cap, revolver. |
| `person-doyle-2.png` | A Doyle Gang heavy: rust-orange waistcoat, rolled sleeves, braces, shotgun. |
| `person-mick.png` | Mick Doyle, the gang's top gunman: lean and scarred, tan suit, orange pocket square, two pistols. |
| `person-seamus.png` | Seamus Doyle, the boss: heavy-set, red beard, brown three-piece suit, watch chain, shotgun. |
| `person-kessler-1.png` | A Kessler Outfit soldier: black pinstripe suit, dark red tie, black fedora, Thompson submachine gun. |
| `person-kessler-2.png` | A Kessler Outfit gunman: charcoal overcoat, dark red scarf, revolver. |
| `person-victor.png` | Victor Kessler, the crime lord: silver hair, black tuxedo with a dark red carnation, gold watch chain, Thompson gun. |
| `person-moretti-1.png` | A Moretti Clan gangster: plum-coloured suit, purple hatband, revolver. |
| `person-police-1.png` | A 1920s city patrolman: navy tunic with brass buttons, tall police helmet, baton and revolver. |
| `person-civilian-1.png` | A working man: brown waistcoat, flat cap, newspaper under his arm (aiming pose: shielding his face instead). |
| `person-civilian-2.png` | A woman in a cloche hat and drop-waist coat with a shopping basket (aiming pose: ducking). |
| `person-civilian-3.png` | A businessman: grey suit, bowler hat, umbrella. |
| `person-civilian-4.png` | A flapper: beaded dress, feather headband, fur stole. |
| `person-civilian-5.png` | A newsboy: cap, knickerbockers, a bag of newspapers. |
| `person-civilian-6.png` | A boardwalk bather in a striped 1920s swimsuit with a towel. |

## 4. Biler

Viktig for bilene:
- Lakken skal være **nøytral lys grå**, fordi spillet farger bilene etter familie.
- *front*: bilen kjører mot nedre høyre hjørne, og fronten synes.
- *rear*: den samme bilen kjører bort mot øvre høyre hjørne, og baksiden synes.
- Bruk liggende format, 1536×1024.

Legg til denne setningen i hver bilprompt:
> *Painted in plain neutral light grey (no other body colour); chrome, glass, tyres and lamps keep their own colours. Transparent background. Use the attached template: the car's footprint lies on the grey ground box, nose pointing along the red arrow for "front" images; strict isometric parallel projection, no perspective.*

| Filnavn | Prompt |
|---|---|
| `car-sedan-front.png` | A 1928 four-door touring sedan driving towards the bottom-right corner, front and left side visible, long hood, upright cabin, running boards, spoked white-wall wheels, round headlamps. |
| `car-sedan-rear.png` | The same 1928 touring sedan seen from behind, driving away towards the top-right corner, spare wheel on the back, small red tail lamps. |
| `car-roadster-front.png` | A 1928 open two-seat roadster driving towards the bottom-right corner, folded soft top, low windscreen, long hood. |
| `car-roadster-rear.png` | The same roadster seen from behind, driving away towards the top-right corner. |
| `car-truck-front.png` | A 1928 bakery delivery truck driving towards the bottom-right corner: small cab, tall box body behind (leave the box side blank). |
| `car-truck-rear.png` | The same delivery truck seen from behind, driving away towards the top-right corner, double back doors. |
| `car-armored-front.png` | A 1928 armoured limousine driving towards the bottom-right corner: riveted steel plates, narrow slit windows, heavy bumpers. |
| `car-armored-rear.png` | The same armoured limousine seen from behind, driving away towards the top-right corner. |
| `car-taxi-front.png` | A 1928 checker taxi cab driving towards the bottom-right corner, roof light, chequered band along the side. |
| `car-taxi-rear.png` | The same taxi seen from behind, driving away towards the top-right corner. |

## 4b. Portretter til kortraden

Portrettene vises på gangsterkortene øverst i spillet og i safehouse. Bildet beholder bakgrunnen. Bruk kvadratisk format og **ingen mal**.

Felles setning:
> *Head-and-shoulders portrait for a game character card, painted noir 1920s style, warm lamplight from the left, plain dark warm background, looking slightly to the right, square image, no text.*

| Filnavn | Prompt |
|---|---|
| `portrait-nico.png` | The hero: a young man of 24 with a pale cream fedora, dark green suit, determined and grieving. (Brukes for helten uansett hvilket navn spilleren velger.) |
| `portrait-runner.png` | Petey Sullivan, a nervous Doyle bagman: thin, freckles, flat cap. |
| `portrait-mick.png` | Mick Doyle: lean gunman, scar across the cheek, tan suit, cold eyes. |
| `portrait-seamus.png` | Seamus Doyle: heavy-set Irish boss, red beard, brown three-piece suit. |
| `portrait-victor.png` | Victor Kessler: silver-haired crime lord, black tuxedo, dark red carnation. |
| `portrait-dot.png` | Dot Okafor: sharp-eyed bookkeeper and fixer in her forties, spectacles, cloche hat. |

Vanlige gangstere uten eget portrett får et portrett tegnet i kode.

## 5. Grensesnitt: åpningsskjerm, skjermbilder og teksturer

Disse bildene **beholder bakgrunnen**, bortsett fra logoen. Du kan bruke en egen ChatGPT-samtale for dem. Lim inn stilbeskrivelsen og si at kamera- og innrammingsreglene ikke gjelder her.

| Filnavn | Format | Prompt |
|---|---|---|
| `ui-title.png` | 16:9 (1792×1024) | A cinematic painting for a game title screen: dusk on a 1920s seaside boardwalk, a lit Ferris wheel and casino on the pier, gulls, a row of men in fedoras and overcoats walking towards the viewer, a black sedan by the kerb, warm bulb light against a teal sky. Leave the upper middle third calm and dark for the logo. No text. |
| `ui-logo.png` | Bred, gjennomsiktig | The words "BATHTUB GIN" as an art-deco logo, gold and cream lettering with a thin black outline, a small cocktail-glass motif, and beneath it the smaller words "BLOOD DEBT" in red. Transparent background. (Bare dette bildet skal ha tekst. Hvis bokstavene blir feil, dropper vi logoen, for spillet har en egen tekstlogo.) |
| `ui-tommaso.png` | Kvadrat | Head-and-shoulders portrait of Uncle Tommaso, a kind but shrewd old Italian-American man in his late 60s: grey moustache, dark fedora, cigar, waistcoat. Plain dark warm background. |
| `ui-safehouse.png` | 16:9 | The back room of a 1920s bakery used as a gang hideout: flour sacks, a long table with maps and cash, a radio, a Tommy gun on the wall, warm lamplight, cigarette smoke. No people. No text. |
| `ui-win.png` | 16:9 | Dawn over a 1920s seaside city seen from the boardwalk, warm golden light, a bakery's lights coming on, a sense of quiet victory. No text. |
| `ui-lose.png` | 16:9 | A rainy night street in the 1920s, a fedora lying in a puddle under a streetlamp, police lights reflected on wet cobbles. No text. |
| `ui-lobby.png` | 16:9 | Four 1920s crime bosses around a smoky card table in a dark private room, seen from above at an angle, money and pistols on the table. No text. |
| `ui-panel.png` | Kvadrat | A seamless texture of dark polished walnut with a subtle art-deco brass inlay border, very dark so light text stays readable. |
| `ui-paper.png` | Kvadrat | A seamless texture of 1920s newsprint paper: warm off-white, faint fibres and slight yellowing, no text. |
| `ui-button.png` | 3:1 (1536×512) | A blank art-deco button plate in brushed gold with a thin dark bevel, flat front view, no text. |

### Illustrasjoner til kapitlene (vises øverst i briefingen, 2,4:1, for eksempel 1536×640)

| Filnavn | Prompt |
|---|---|
| `ui-briefing-c1.png` | A bakery on a 1920s street at dawn, a chalk outline and flowers on the pavement outside, neighbours watching from doorways. |
| `ui-briefing-c2.png` | A barbershop interior, a nervous barber whispering to a young man in a pale fedora, razor in hand. |
| `ui-briefing-c3.png` | Rum-runners unloading crates from a motorboat at a foggy pier at night, a delivery truck waiting with its lights off. |
| `ui-briefing-c4.png` | A jazz club at night seen from across the street, a lean gunman with two bodyguards stepping out under the marquee. |
| `ui-briefing-c5.png` | A rival boss's brick hall at night, an open office safe glowing in lamplight, a leather ledger on the desk. |
| `ui-briefing-c6.png` | A grand bank vault door at night, a safecracker's tools laid out, a police car's lights far down the street. |
| `ui-briefing-c7.png` | A hilltop mansion above the seaside city at night, armed men on the steps, a storm coming in from the sea. |

### Ikoner til knappene (kvadrat, gjennomsiktig, 1024×1024)

Felles setning til alle ikonene:
> *A single simple game icon in the painted 1920s style: one clear object, centred, bold silhouette that reads at 20 pixels, warm gold and cream with dark outline, transparent background, no text.*

| Filnavn | Motiv |
|---|---|
| `icon-extort.png` | a hand slipping a folded envelope of cash |
| `icon-takeover.png` | a clenched fist with brass knuckles |
| `icon-buy.png` | a property deed with a wax seal |
| `icon-bribe.png` | a stack of banknotes held out under a table |
| `icon-torch.png` | a burning match and a kerosene can |
| `icon-crack.png` | a safe dial with a stethoscope |
| `icon-cards.png` | a fan of playing cards with an ace on top |
| `icon-kidnap.png` | a coil of rope and a burlap sack |
| `icon-arm.png` | a Tommy gun |
| `icon-donate.png` | a collection plate with coins |
| `icon-enter.png` | an open door with warm light |
| `icon-spring.png` | a jail cell key |
| `icon-passive.png` | a lowered fedora (hat over the eyes) |
| `icon-defensive.png` | a raised revolver behind a brick corner |
| `icon-aggressive.png` | a revolver firing with a muzzle flash |
| `icon-flee.png` | running shoes with motion lines |
| `icon-car.png` | a 1920s sedan in side view |
| `icon-driveby.png` | a gun barrel out of a car window |
| `icon-cargo.png` | a wooden crate of bottles |
| `icon-route.png` | a looping arrow between two buildings |
| `icon-exit.png` | an open car door |
| `icon-manager.png` | a man in spectacles with a ledger |
| `icon-guard.png` | a doorman with a shotgun |
| `icon-racket.png` | a cocktail glass with a curtain behind it |
| `icon-hire.png` | a newspaper "help wanted" page (no readable text) |
| `icon-bail.png` | a gavel and coins |
| `icon-walk.png` | a footprint |
| `icon-all.png` | three fedoras in a row |
| `icon-box.png` | a dashed selection square |
| `icon-hero.png` | a pale cream fedora |
| `icon-crew.png` | a group of three silhouettes |
| `icon-paper.png` | a folded newspaper |
| `icon-goals.png` | a notebook with a tick |
| `icon-pause.png` | a pocket watch, stopped |
| `icon-skip.png` | an hourglass with a moon and sun |
| `icon-zoom-in.png` | a magnifying glass with a plus |
| `icon-zoom-out.png` | a magnifying glass with a minus |

## Hvordan bildene tilpasses

| Type | Bredde eller høyde i spillet | Plassering |
|---|---|---|
| Hus | Bredden tilpasses tomten | Nederste hjørne settes på tomtens nærmeste hjørne |
| Figurer | Høyden blir om lag 45 piksler | Ark med fire positurer blir animasjon (står, går, går, sikter). Figuren speiles når den går mot venstre |
| Biler | Bredden blir om lag 104 piksler | *front* og *rear* speiles for de to andre kjøreretningene, og bilen farges etter familie |
| Ikoner | 18–20 piksler | Settes foran teksten på knappene |
| Teksturer | Fyller bakgrunnen | `ui-panel` brukes i paneler og menyer, `ui-paper` i avisa og briefingen, `ui-button` på de store gullknappene |

Om natta blir egne bilder mørkere med resten av byen. Opplyste vinduer i egne bilder kommer i en senere versjon.
