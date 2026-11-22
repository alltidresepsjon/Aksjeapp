# Egne bilder med ChatGPT: prompter og filnavn

Spillet bruker bildene dine automatisk der de finnes. Alt som mangler, tegnes fortsatt av koden, så du kan bytte inn bilder ett og ett.

## Slik gjør du det

1. Åpne **én** ny samtale i ChatGPT, og bruk den samme samtalen til alle bildene. Da holder stilen seg likere fra bilde til bilde.
2. Lim inn **stilbeskrivelsen** under som første melding.
3. Lim deretter inn én prompt om gangen fra listene. Last ned hvert bilde som PNG.
4. Gi filen **nøyaktig** navnet som står foran prompten, for eksempel `building-shop-3-1.png`.
5. Legg filene i `art-inbox/` (via GitHub: «Add file → Upload files»), eller send dem til meg i chatten.
6. Kjør `npm run art`, eller be meg gjøre det. Skriptet fjerner bakgrunnen, beskjærer og skalerer bildene.

**Tips**
- Be om *transparent background* hver gang. Får du likevel en ensfarget hvit eller grå bakgrunn, fjerner skriptet den.
- Ser et bilde annerledes ut enn de andre, svar: *«Same style and camera angle as the previous buildings, but …»*.
- Ikke la ChatGPT skrive tekst på skilt. AI-tekst blir ofte uleselig, og spillet viser navnene selv.
- Lag gjerne flere varianter av samme type (`-1`, `-2`, `-3` …). Spillet fordeler dem mellom byggene.

## 1. Stilbeskrivelse (lim inn først)

```
I am making art for an isometric strategy game set in a fictional American harbour city in 1928, during Prohibition.
Every image I ask for must follow these rules:

STYLE: painted noir illustration. Soft painterly brushwork, rich but slightly muted colours (brick reds, soot greys,
slate blues, cream stone, brass and amber), warm late-afternoon light from the upper left, gentle ambient occlusion,
subtle film grain. Detailed, but readable when shown small. No cartoon outlines, no photo-realism.

CAMERA: classic 2:1 isometric game view (dimetric, about 30° above the ground), looking from the south-east, so
the object's front-left side and front-right side are both visible and its nearest corner points straight down.
Never a front view, never a top-down view.

FRAMING: exactly ONE object, centred, fully visible, nothing cropped. Transparent background (or plain flat white if
transparency is not possible). No ground, no street, no sky, no extra objects, no shadow outside the object.
No text, letters or numbers anywhere (signs and posters stay blank or show simple pictures).

Reply only with the image.
```

## 2. Hus

Viktig for husene:
- Grunnflaten er **kvadratisk**, og bildet viser huset fra hjørnet.
- Tomtens venstre, nederste og høyre hjørne skal treffe venstre kant, bunnen og høyre kant av motivet.
- Taket kan stikke opp så høyt det vil.
- `3` betyr en liten tomt (en fjerdedel av et kvartal), og `6` betyr en tomt som fyller et helt kvartal.

Legg til denne setningen i hver huprompt:
> *The building stands on a perfectly square footprint; its lowest corner is at the bottom centre of the image and its left and right corners touch the left and right edges.*

| Filnavn | Prompt |
|---|---|
| `building-shop-3-1.png` | A narrow 2-storey red-brick corner shop with a striped canvas awning and large display windows on the ground floor, apartments above with sash windows and flower boxes. |
| `building-shop-3-2.png` | A 3-storey cream stone building with a corner grocery on the ground floor, green awning, wooden crates of fruit by the door, a painted ghost advert (no letters) on the side wall. |
| `building-shop-3-3.png` | A 2-storey barbershop with a red-white striped pole, gable roof of dark slate, small dormer window, brick chimney. |
| `building-shop-3-4.png` | A 3-storey laundry and tailor's building, yellow-brown brick, steam venting from a pipe, washing lines between the windows. |
| `building-shop-3-5.png` | A 2-storey pawn and gun shop with barred windows, dark green wooden shopfront, brass balls hanging over the door. |
| `building-type-bakery-3-1.png` | A warm 2-storey brick bakery with a gold-trimmed dark-red shopfront, bread loaves in the window, a flour-dusted delivery bench, a brass bell by the door. |
| `building-tenement-3-1.png` | A 5-storey brick tenement with zig-zag iron fire escapes, laundry hanging between windows, a water tower on the flat roof. |
| `building-tenement-3-2.png` | A 4-storey grey stone tenement with bay windows, cornice, rooftop chimneys and a small rooftop shed. |
| `building-hq-3-1.png` | The Corrado family home and headquarters: a 3-storey brick bakery-and-townhouse with a gold-trimmed dark-red shopfront, warm light in the windows, heavy oak side door, iron railings, mansard roof with dormers. Make it feel loved. |
| `building-hq-6-1.png` | A grand 4-storey brick mansion headquarters filling a whole city block: mansard roof, ornate cornices, a front portico with columns, iron gates, a small courtyard garden. |
| `building-club-3-1.png` | A jazz club: 3-storey dark building with a glowing neon marquee (no letters), a velvet rope and red carpet at the door, string lights. |
| `building-club-3-2.png` | A casino: 3-storey art-deco building, black and gold facade, rows of light bulbs around the entrance, tall windows with red curtains. |
| `building-hotel-3-1.png` | A narrow 6-storey hotel with a canopy over the entrance, a vertical blade sign without letters, cream stone and many windows. |
| `building-hotel-6-1.png` | A luxurious 8-storey art-deco hotel tower with stepped setbacks, a spire with a red light, a grand entrance canopy. |
| `building-diner-3-1.png` | A one-storey streamlined chrome diner with teal stripes, long windows, round stools visible inside. |
| `building-garage-3-1.png` | A one-storey brick motor garage with two big roller doors, a red gas pump by the door, oil stains, tyres stacked outside. |
| `building-warehouse-3-1.png` | A 2-storey corrugated-iron warehouse with a sawtooth roof, big loading doors, crates and barrels outside. |
| `building-warehouse-6-1.png` | A big harbour warehouse filling a whole block: brick and corrugated iron, sawtooth skylight roof, loading docks with crates. |
| `building-bank-6-1.png` | A classical savings bank filling a whole block: grey stone, tall columns, a pediment, wide steps, bronze doors. |
| `building-precinct-6-1.png` | A 3-storey police precinct house: blue-grey brick, two green lamps by the door, barred basement windows, a flagpole. |
| `building-civic-3-1.png` | A small white-stone courthouse with columns and a copper-green dome. |
| `building-civic-6-1.png` | City Hall filling a whole block: white stone, columns, a large copper-green dome, broad steps. |
| `building-church-6-1.png` | A stone Catholic church with a tall spire, rose window, arched doors, a small graveyard garden. |
| `building-pier-3-1.png` | A smugglers' pier: a wooden shack on stilts over dark water, rope coils, barrels, a lantern, a small rowing boat tied up. |

## 3. Figurer

Viktig for figurene:
- Hele kroppen skal være med, stående, med retning ned mot høyre (tre kvart forfra).
- Figuren skal bære våpenet lavt.
- Detaljene må være så tydelige at de synes selv om figuren vises bare 45 piksler høy.

Legg til denne setningen i hver figurprompt:
> *Full-body single character, standing, turned three-quarters towards the bottom-right, small readable silhouette.*

| Filnavn | Prompt |
|---|---|
| `person-nico.png` | Nico Corrado, 24, the baker's son turned gang boss: pale cream fedora, dark green three-piece suit, white shirt, gold tie pin, revolver in hand, serious face. |
| `person-corrado-1.png` | A Corrado family gangster: dark green suit and green hatband, broad shoulders, pump shotgun. |
| `person-corrado-2.png` | A Corrado family gangster: green overcoat, flat cap, revolver, cigarette. |
| `person-corrado-3.png` | A Corrado family woman fixer: green cloche hat and dark green coat, handbag, small pistol. |
| `person-doyle-1.png` | A Doyle Gang thug: brown tweed suit with orange tie, flat cap, revolver. |
| `person-doyle-2.png` | A Doyle Gang heavy: rust-orange waistcoat, rolled sleeves, shotgun. |
| `person-mick.png` | Mick Doyle, the gang's top gunman: lean, scarred, tan suit with orange pocket square, two pistols. |
| `person-seamus.png` | Seamus Doyle, the boss: heavy-set, red beard, brown three-piece suit, shotgun. |
| `person-kessler-1.png` | A Kessler Outfit soldier: black pinstripe suit with dark red tie, black fedora, Thompson submachine gun. |
| `person-kessler-2.png` | A Kessler Outfit gunman: charcoal overcoat with dark red scarf, revolver. |
| `person-victor.png` | Victor Kessler, the crime lord: silver hair, black tuxedo with dark red carnation, gold watch chain, Thompson gun. |
| `person-moretti-1.png` | A Moretti Clan gangster: purple-grey suit, purple hatband, revolver. |
| `person-police-1.png` | A 1920s city patrolman: navy tunic with brass buttons, custodian helmet-style cap, baton and revolver. |
| `person-civilian-1.png` | A 1920s working man: brown waistcoat, flat cap, newspaper under arm. |
| `person-civilian-2.png` | A 1920s woman: cloche hat, drop-waist coat, shopping basket. |
| `person-civilian-3.png` | A 1920s businessman: grey suit, bowler hat, umbrella. |
| `person-civilian-4.png` | A 1920s flapper: beaded dress, feather headband, fur stole. |
| `person-civilian-5.png` | A newsboy: cap, knickerbockers, bag of newspapers. |
| `person-civilian-6.png` | A dock worker: sweater, wool cap, sack over shoulder. |

## 4. Biler

Viktig for bilene:
- Lakken skal være **nøytral lys grå**, fordi spillet farger bilene etter familie.
- *front*: bilen kjører mot nedre høyre hjørne, og fronten synes.
- *rear*: den samme bilen kjører bort mot øvre høyre hjørne, og baksiden synes.

Legg til denne setningen i hver bilprompt:
> *Painted in plain neutral light grey (no other body colour); chrome, glass, tyres and lamps keep their own colours.*

| Filnavn | Prompt |
|---|---|
| `car-sedan-front.png` | A 1928 four-door touring sedan driving towards the bottom-right corner, front and left side visible, long hood, upright cabin, running boards, spoked white-wall wheels, round headlamps. |
| `car-sedan-rear.png` | The same 1928 touring sedan seen from behind, driving away towards the top-right corner, spare wheel on the back, small red tail lamps. |
| `car-roadster-front.png` | A 1928 open two-seat roadster driving towards the bottom-right corner, folded soft top, low windscreen, long hood. |
| `car-roadster-rear.png` | The same roadster seen from behind, driving away towards the top-right corner. |
| `car-truck-front.png` | A 1928 bakery delivery truck driving towards the bottom-right corner: small cab, tall box body at the back (leave the box side blank). |
| `car-truck-rear.png` | The same delivery truck seen from behind, driving away towards the top-right corner, double back doors. |
| `car-armored-front.png` | A 1928 armoured limousine driving towards the bottom-right corner: riveted steel plates, narrow slit windows, heavy bumpers. |
| `car-armored-rear.png` | The same armoured limousine seen from behind, driving away towards the top-right corner. |

## 5. Grensesnitt

| Filnavn | Prompt |
|---|---|
| `ui-tommaso.png` | Head-and-shoulders portrait of Uncle Tommaso, a kind but shrewd old Italian-American man in his late 60s: grey moustache, dark fedora, cigar, waistcoat. Square image, painted noir style, plain dark warm background (this one may have a background). |
| `ui-title.png` | A wide 16:9 cinematic painting of a rainy 1920s harbour city street at night: gas lamps, a bakery with lights on, a parked sedan, steam from a manhole, silhouettes in fedoras. No text. (This one keeps its background.) |

`ui-title.png` og `ui-tommaso.png` beholder bakgrunnen sin. Skriptet fjerner bare bakgrunner som er helt ensfargede.

## Hvordan bildene tilpasses

| Type | Bredde eller høyde i spillet | Plassering |
|---|---|---|
| Hus | Bredden tilpasses tomten | Nederste hjørne settes på tomtens nærmeste hjørne |
| Figurer | Høyden blir om lag 45 piksler | Bildet speiles når figuren går mot venstre |
| Biler | Bredden blir om lag 104 piksler | *front* og *rear* speiles for de to andre kjøreretningene |

Om natta blir egne bilder mørkere med resten av byen. Opplyste vinduer i egne bilder kommer i en senere versjon.
