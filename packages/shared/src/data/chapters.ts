// The seven chapters of the Blood Debt campaign. Each has its own district map.

import type { Layout } from '../map/mapgen';
import type { ObjDef, ScriptTrigger, Spec, Stance, StatKey, VModel, WeaponId } from '../types';

export interface FamilySetup {
  id: string;
  name: string;
  short: string;
  color: string;
  human: boolean;
  money: number;
  aggression: number;
  cap: number;
  statLo: number;
  statHi: number;
  /** No headquarters on this map: reinforcements arrive from the map edge. */
  edge?: boolean;
}

export interface NpcSetup {
  fam: string;
  name?: string;
  role?: string;
  tag?: string;
  count?: number;
  boss?: boolean;
  hp?: number;
  stats?: Partial<Record<StatKey, number>>;
  weapon?: WeaponId;
  stance?: Stance;
  /** Building tag to spawn at. */
  at: string;
  inside?: boolean;
  route?: { tags: string[]; wait: number; night?: string };
  bodyguards?: number;
  jailed?: boolean;
  /** Joins the player's roster when freed. */
  joins?: boolean;
  spec?: Spec;
}

export interface ChapterObjective {
  id: string;
  text: string;
  def: ObjDef;
  optional?: boolean;
  after?: string;
}

export interface ChapterDef {
  id: string;
  num: number;
  title: string;
  district: string;
  briefing: string[];
  tip: string;
  layout: Layout;
  families: FamilySetup[];
  npcs: NpcSetup[];
  objectives: ChapterObjective[];
  script: ScriptTrigger[];
  slots: number;
  startHour: number;
  gift: VModel[];
  minCash: number;
  bribeMult: number;
  reward: number;
  news: string[];
}

export const CORRADO = { id: 'P', name: 'Corrado Family', short: 'Corrado', color: '#3fbf8a', human: true };
export const DOYLE = { id: 'D', name: 'Doyle Gang', short: 'Doyle', color: '#e09a3c', human: false };
export const KESSLER = { id: 'K', name: 'Kessler Outfit', short: 'Kessler', color: '#e0505f', human: false };

const P = (money = 0): FamilySetup => ({ ...CORRADO, money, aggression: 0, cap: 99, statLo: 1, statHi: 3 });

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'c1', num: 1, title: 'Take Back the Street', district: 'Foundry Street',
    briefing: [
      'Three nights ago your father, Sal Corrado, was shot dead outside his bakery on Foundry Street. The police wrote "robbery" and went home.',
      'The shopkeepers on Foundry Street paid Sal no protection money. They liked him. Now the Doyle Gang is going door to door, and the shopkeepers are scared.',
      'Show the street the Corrados are not finished. Win four businesses over: a quiet visit from a charming man (extortion) or cash on the counter (buying). Then hold the bakery. Word is the Doyles will come for it after dark.',
    ],
    tip: 'Select your crew, then tap a building. Charm makes extortion faster. Put men inside the bakery with the stance set to Defensive before nightfall.',
    layout: {
      seed: 101,
      streetsH: ['Kettle St', 'Mercer St', 'Foundry St', 'Bishop St', 'Canal St'],
      streetsV: ['1st Ave', 'Rye Ln', 'Market St', 'Harbor Way', 'Union Ave'],
      blocks: [
        ['q:diner,barber,-,laundry', 'q:grocer,-,tailor,pawn', 'q:warehouse@D#doyle1,-,garage@D#doyle2,-', 'f:church'],
        ['q:-,grocer,bakery,-', 'park', 'q:barber,diner,-,laundry', 'q:-,tailor,grocer,-'],
        ['q:tailor,-,pawn,diner', 'q:laundry,-,-,club', 'f:precinct', 'q:diner,-,-,barber'],
        ['q:-,-,hq@P#hq*2!Corrado Bakery,grocer', 'q:barber,-,tailor,-', 'q:-,laundry,-,diner', 'q:garage,-,-,bakery'],
      ],
    },
    families: [P(), { ...DOYLE, money: 200, aggression: 0.25, cap: 5, statLo: 1, statHi: 3, edge: true }],
    npcs: [{ fam: 'D', count: 2, at: 'doyle1' }, { fam: 'D', count: 1, at: 'doyle2' }],
    objectives: [
      { id: 'o1', text: 'Control 4 businesses on the street', def: { k: 'control', n: 4 } },
      { id: 'o2', text: 'Hold the Corrado Bakery through the night (until 2:00 on day 2)', def: { k: 'defend', tag: 'hq', untilDay: 2, untilHour: 2 } },
      { id: 'o3', text: 'Optional: drive the Doyles off Foundry Street (take both Doyle buildings)', def: { k: 'capture', tag: 'doyle' }, optional: true },
    ],
    script: [
      { at: { day: 1, hour: 19 }, do: [{ k: 'news', text: 'Doyle men seen drinking on Kettle St, "talking about bread"', big: true }, { k: 'toast', text: 'Rumour: the Doyles will hit the bakery tonight. Get people inside it.' }] },
      { at: { day: 1, hour: 22 }, do: [{ k: 'wave', fam: 'D', n: 4, tag: 'hq', edge: 'N' }, { k: 'toast', text: 'Doyle gunmen are coming for the bakery!' }] },
      { at: { day: 2, hour: 0.5 }, do: [{ k: 'wave', fam: 'D', n: 2, tag: 'hq', edge: 'E' }] },
    ],
    slots: 3, startHour: 8, gift: [], minCash: 600, bribeMult: 1, reward: 300,
    news: ['Baker Sal Corrado shot dead on Foundry St; police call it a robbery', 'Son Nico Corrado seen at the funeral, "not saying much"'],
  },
  {
    id: 'c2', num: 2, title: 'The Barber Talks', district: 'Mercer Street',
    briefing: [
      'Ezio the barber on Mercer Street sends word. He shaved the man who did it, the morning after. Doyle man. Ezio did not catch the name.',
      'But Petey Sullivan will know. He collects the Doyle money, shop to shop, with a bodyguard. Grab him, put him in a car and bring him back to your headquarters for a talk.',
      'You need a car for that. The garage on Mercer Street will sell you one.',
    ],
    tip: 'Kidnapping: select muscle, then tap the target and choose Kidnap. The target has to be weakened or alone, and one of your cars must be parked close by.',
    layout: {
      seed: 202,
      streetsH: ['Canal St', 'Mercer St', 'Orchard St', 'Dray St', 'Larkin Ave'],
      streetsV: ['Rye Ln', 'Market St', 'Quarry Rd', 'Elm St', 'Bell St'],
      blocks: [
        ['q:barber@D#dA,-,diner,laundry', 'q:-,tailor@D#dB,grocer,-', 'q:club@D#dC,-,-,pawn', 'q:-,grocer,laundry,-', 'q:garage,-,-,tailor'],
        ['q:grocer,-,-,diner', 'f:warehouse@D#dD', 'q:-,barber#ezio!Ezio\'s Barbershop,diner,-', 'park', 'q:-,bakery,-,diner'],
        ['q:hq@P#hq*3!Corrado House,-,garage#garage,tailor', 'q:laundry,-,pawn,-', 'q:-,grocer,-,barber', 'f:precinct', 'q:club,-,-,laundry'],
      ],
    },
    families: [P(), { ...DOYLE, money: 400, aggression: 0.35, cap: 8, statLo: 1, statHi: 4, edge: true }],
    npcs: [
      { fam: 'D', name: 'Petey Sullivan', role: 'Bagman', tag: 'runner', at: 'dA', stats: { muscle: 2, aim: 2, stealth: 2 }, route: { tags: ['dA', 'dB', 'dC', 'dD'], wait: 1.5 }, bodyguards: 1 },
      { fam: 'D', count: 2, at: 'dD', inside: true },
      { fam: 'D', count: 1, at: 'dC', inside: true },
    ],
    objectives: [
      { id: 'o1', text: 'Get a car (buy one at a garage)', def: { k: 'car' } },
      { id: 'o2', text: 'Kidnap Petey Sullivan, the Doyle bagman', def: { k: 'kidnap', tag: 'runner' } },
      { id: 'o3', text: 'Interrogate Petey at your headquarters', def: { k: 'interrogate', tag: 'runner' }, after: 'o2' },
      { id: 'o4', text: 'Optional: control 6 businesses', def: { k: 'control', n: 6 }, optional: true },
    ],
    script: [
      { on: 'o2', do: [{ k: 'news', text: 'Doyle collector vanishes on Mercer St; shopkeepers "saw nothing"', big: true }, { k: 'wave', fam: 'D', n: 3, tag: 'hq', edge: 'N' }] },
    ],
    slots: 4, startHour: 9, gift: [], minCash: 900, bribeMult: 1, reward: 400,
    news: ['Corrado boy "took back" Foundry St, say neighbours', 'Doyle Gang says it fears no baker\'s son'],
  },
  {
    id: 'c3', num: 3, title: 'Rum Row', district: 'Canal Docks',
    briefing: [
      'Petey gave you a name before he passed out: Mick Doyle, Doyle\'s cousin and best gun. Mick has a dozen men behind him. You have a bakery.',
      'War costs money, and in this city money is liquor. Open a still behind an honest front and a speakeasy to sell from. The smugglers on Pier 9 sell crates after dark.',
      'Haul the crates by truck. Every manager needs a salary, and every racket needs people to guard it. The Kessler Outfit runs liquor on these docks too, and they will not share.',
    ],
    tip: 'Hire a manager straight from the building menu. Rackets only pay at night. Give a truck a supply route so the crates move on their own.',
    layout: {
      seed: 303,
      streetsH: ['Warehouse Row', 'Tar St', 'Canal St', 'Quay Rd', 'Harbor Front'],
      streetsV: ['Rope Walk', 'Fish Market', 'Salt Ln', 'Anchor St', 'Gull St', 'Pier Rd'],
      blocks: [
        ['q:hq@P#hq*3!Corrado Warehouse,laundry,garage#garage,-', 'q:warehouse,-,diner,-', 'q:-,tailor,laundry,-', 'q:warehouse@K,-,club@K#kclub,-', 'q:-,warehouse@K#kwh,hotel@K,diner'],
        ['q:-,bakery,diner,-', 'f:warehouse', 'q:grocer,-,-,barber', 'f:precinct', 'q:laundry@K,-,-,garage@K'],
        ['q:pier#pier9!Pier 9,water,warehouse,water', 'q:water,water,water,water', 'q:pier#pier7!Pier 7,water,-,water', 'water', 'q:water,pier@K!Pier 12,water,water'],
      ],
    },
    families: [P(), { ...KESSLER, money: 900, aggression: 0.3, cap: 8, statLo: 2, statHi: 4 }],
    npcs: [{ fam: 'K', count: 2, at: 'kclub', inside: true }, { fam: 'K', count: 2, at: 'kwh' }],
    objectives: [
      { id: 'o1', text: 'Open a Distillery racket behind a front', def: { k: 'racket', kind: 'still', n: 1 } },
      { id: 'o2', text: 'Open a Speakeasy racket', def: { k: 'racket', kind: 'speakeasy', n: 1 } },
      { id: 'o3', text: 'Deliver 10 crates of liquor to your speakeasies', def: { k: 'deliver', n: 10 } },
      { id: 'o4', text: 'Build a war chest of $3,000', def: { k: 'cash', n: 3000 } },
    ],
    script: [
      { at: { day: 2, hour: 23 }, do: [{ k: 'wave', fam: 'K', n: 4, tag: 'hq', edge: 'E' }, { k: 'news', text: 'Kessler trucks seen circling Canal Docks', big: true }] },
    ],
    slots: 5, startHour: 8, gift: ['truck'], minCash: 1500, bribeMult: 1, reward: 500,
    news: ['Mysterious kidnapping on Mercer St; Doyle Gang furious', 'Pier smugglers say business "never better"'],
  },
  {
    id: 'c4', num: 4, title: 'The Trigger Man', district: 'Larkin Avenue',
    briefing: [
      'Mick Doyle pulled the trigger. Everyone on Larkin Avenue knows it, and nobody will say it out loud.',
      'He does his rounds by day with two bodyguards, from one Doyle shop to the next. At night he drinks at the Blue Heron and never sits with his back to the door.',
      'Find him and finish it. A hitman or a rifle from across the street. Or a sedan and a drive-by, if you want the whole city to hear.',
    ],
    tip: 'You only see what your people can see. A card sharp at a table picks up rumours, and those reveal the rivals on the map for a while. A hitman\'s first shot on an unaware target hits three times as hard.',
    layout: {
      seed: 404,
      streetsH: ['Larkin Ave', 'Viola St', 'Crown St', 'Mercer St', 'Lower Larkin'],
      streetsV: ['Rye Ln', 'Opera Way', 'Mill St', 'Bell St', 'Glass St', 'Ferry Rd'],
      blocks: [
        ['q:club@D#heron!The Blue Heron,-,diner@D#r1,-', 'q:-,tailor,-,barber@D#r2', 'q:casino#casino!Lucky Seven,-,-,grocer', 'q:hotel,-,laundry@D#r3,-', 'q:-,pawn,-,diner'],
        ['q:-,grocer,-,laundry', 'park', 'f:precinct', 'q:barber,-,-,tailor@D#r4', 'q:garage@D,-,-,-'],
        ['q:hq@P#hq*3!Corrado House,-,garage#garage,-', 'q:diner,-,-,bakery', 'q:-,tailor,grocer,-', 'q:-,club,-,laundry', 'q:warehouse@D,-,-,grocer'],
      ],
    },
    families: [P(), { ...DOYLE, money: 700, aggression: 0.4, cap: 10, statLo: 2, statHi: 5, edge: true }],
    npcs: [
      { fam: 'D', name: 'Mick Doyle', role: 'The Trigger Man', tag: 'mick', boss: true, hp: 120, at: 'r1', weapon: 'dual', stats: { muscle: 5, aim: 6, stealth: 3 }, route: { tags: ['r1', 'r2', 'r3', 'r4'], wait: 1.2, night: 'heron' }, bodyguards: 2 },
      { fam: 'D', count: 2, at: 'heron', inside: true },
      { fam: 'D', count: 2, at: 'r3' },
    ],
    objectives: [
      { id: 'o1', text: 'Kill Mick Doyle', def: { k: 'kill', tag: 'mick' } },
      { id: 'o2', text: 'Optional: take the Blue Heron', def: { k: 'capture', tag: 'heron' }, optional: true },
    ],
    script: [
      { on: 'o1', do: [{ k: 'news', text: 'MICK DOYLE FOUND DEAD ON LARKIN AVE', big: true }, { k: 'wave', fam: 'D', n: 4, tag: 'hq', edge: 'N' }] },
    ],
    slots: 5, startHour: 10, gift: ['sedan'], minCash: 1200, bribeMult: 1, reward: 600,
    news: ['Bathtub gin floods Canal Docks; Dry agents "baffled"', 'Witness names Mick Doyle in the Corrado killing', ],
  },
  {
    id: 'c5', num: 5, title: 'Cut the Head Off', district: 'Orchard Street',
    briefing: [
      'Mick died with a Kessler banknote in his pocket. The Doyles were never more than hired muscle. Somebody paid them.',
      'Seamus Doyle keeps the books in the safe at his headquarters on Orchard Street. Take the building, then put a safecracker on the safe. Those books will show who paid.',
      'His men are fed from two warehouses. Burn them first and he will run out of fresh blood faster.',
    ],
    tip: 'Headquarters fall slowly: clear the defenders inside first. An arsonist can torch rival buildings. A safecracker opens a safe fastest at night.',
    layout: {
      seed: 505,
      streetsH: ['Orchard St', 'Peel St', 'Doyle Row', 'Cask St', 'Lower Orchard'],
      streetsV: ['Tanner Ln', 'Hill St', 'Gate St', 'Ash St', 'Clay St', 'Moor Rd'],
      blocks: [
        ['q:-,laundry@D,diner@D,-', 'f:hq@D#dhq*4!Doyle Hall', 'q:warehouse@D#dwh,-,-,pawn@D', 'q:-,tailor@D,club@D,-', 'q:grocer@D,-,-,-'],
        ['q:bakery,-,-,garage@D', 'q:-,barber,-,diner', 'f:precinct', 'q:warehouse@D#dwh,-,-,laundry', 'q:-,diner,-,tailor'],
        ['q:hq@P#hq*3!Corrado House,-,garage#garage,grocer', 'q:-,laundry,tailor,-', 'park', 'q:diner,-,-,barber', 'q:-,grocer,pawn,-'],
      ],
    },
    families: [P(), { ...DOYLE, money: 1200, aggression: 0.45, cap: 12, statLo: 2, statHi: 5 }],
    npcs: [
      { fam: 'D', name: 'Seamus Doyle', role: 'Boss', tag: 'seamus', boss: true, hp: 140, at: 'dhq', inside: true, weapon: 'shotgun', stats: { muscle: 6, aim: 4 } },
      { fam: 'D', count: 4, at: 'dhq', inside: true },
      { fam: 'D', count: 2, at: 'dwh' },
    ],
    objectives: [
      { id: 'o1', text: 'Optional: burn the Doyle warehouses', def: { k: 'destroy', tag: 'dwh' }, optional: true },
      { id: 'o2', text: 'Capture Doyle Hall', def: { k: 'capture', tag: 'dhq' } },
      { id: 'o3', text: 'Crack the safe in Doyle Hall and find the ledger', def: { k: 'crack', tag: 'dhq' }, after: 'o2' },
    ],
    script: [
      { at: { day: 1, hour: 21 }, do: [{ k: 'wave', fam: 'D', n: 3, tag: 'hq', edge: 'E' }] },
      { on: 'o2', do: [{ k: 'news', text: 'DOYLE GANG FINISHED — HALL FALLS TO CORRADO CREW', big: true }] },
    ],
    slots: 6, startHour: 9, gift: [], minCash: 1500, bribeMult: 1, reward: 800,
    news: ['Doyle Gang "in mourning", vows revenge on Corrado upstart', 'Kessler Outfit buys up half of Uptown'],
  },
  {
    id: 'c6', num: 6, title: 'Kessler\'s Money', district: 'Bank District',
    briefing: [
      'The ledger is plain: $2,000 from Victor Kessler, "for the baker." Your father would not sell him the bakery for a liquor front, so Kessler had him killed.',
      'Kessler owns the precinct here, and he has had Dot Okafor locked up. She kept your father\'s books and knows every judge in the city. Get her out: bribe the judge, pay the bail, or send a fixer.',
      'Then take Kessler\'s money where it sleeps. After dark, First Halloran Savings is guarded by one old man and a time lock.',
    ],
    tip: 'Bribes cost 50% more here, because Kessler pays the cops too. A bank can only be robbed at night, and it takes a safecracker. The alarm brings the police.',
    layout: {
      seed: 606,
      streetsH: ['Exchange St', 'Gold St', 'Court St', 'Pine St', 'Lake St'],
      streetsV: ['Bridge St', 'Treasury Rd', 'Cedar St', 'Grand Ave', 'Bay St', 'Wall St'],
      blocks: [
        ['q:hotel@K,-,-,club@K', 'f:bank#bank!First Halloran Savings', 'q:casino@K#kcasino!Golden Wheel,-,-,tailor', 'f:courthouse#court', 'q:-,diner@K,laundry@K,-'],
        ['q:-,diner,pawn,-', 'f:precinct#jail', 'plaza', 'q:grocer,-,-,barber', 'f:cityhall'],
        ['q:hq@P#hq*3!Corrado Offices,-,garage#garage,-', 'q:tailor,-,-,laundry', 'q:-,grocer,club,-', 'q:-,bakery@K,-,diner', 'q:warehouse@K#kwh,-,-,garage'],
      ],
    },
    families: [P(), { ...KESSLER, money: 2000, aggression: 0.4, cap: 12, statLo: 2, statHi: 5 }],
    npcs: [
      { fam: 'P', name: 'Dot Okafor', role: 'Fixer', tag: 'dot', at: 'jail', jailed: true, joins: true, spec: 'fixer', stats: { muscle: 1, aim: 2, charm: 7, stealth: 3 } },
      { fam: 'K', count: 3, at: 'kcasino', inside: true },
      { fam: 'K', count: 2, at: 'kwh' },
    ],
    objectives: [
      { id: 'o1', text: 'Get Dot Okafor out of jail', def: { k: 'free', tag: 'dot' } },
      { id: 'o2', text: 'Rob $4,000 from First Halloran Savings (at night)', def: { k: 'rob', n: 4000 } },
      { id: 'o3', text: 'Optional: take the Golden Wheel casino', def: { k: 'capture', tag: 'kcasino' }, optional: true },
    ],
    script: [
      { on: 'o2', do: [{ k: 'news', text: 'SAFE-CRACKERS EMPTY FIRST HALLORAN VAULT', big: true }, { k: 'wave', fam: 'K', n: 4, tag: 'hq', edge: 'N', weapon: 'tommy' }] },
    ],
    slots: 6, startHour: 8, gift: [], minCash: 1500, bribeMult: 1.5, reward: 1000,
    news: ['Doyle ledger "missing," say police', 'Kessler buys a third hotel; mayor attends the opening'],
  },
  {
    id: 'c7', num: 7, title: 'Blood Debt', district: 'Kessler Heights',
    briefing: [
      'Victor Kessler has seen what happened to the Doyles. He has filled his mansion on the Heights with every gun he can buy.',
      'Take his businesses one by one and his money dries up. Wait too long and he will come for you with Tommy guns.',
      'Kill Victor Kessler and take his headquarters. Then the debt is paid.',
    ],
    tip: 'Kessler Manor is the toughest building in the city. Soften it up first: torch his warehouses, take his casino and pick off his patrols. Keep Nico out of the front line.',
    layout: {
      seed: 707,
      streetsH: ['Heights Rd', 'Crest Ave', 'Linden St', 'Orchard Hill', 'Vale St', 'Low Rd'],
      streetsV: ['Ridge St', 'Kessler Way', 'Maple Ave', 'Summit St', 'Oak Ln', 'Glen Rd'],
      blocks: [
        ['q:club@K,-,-,hotel@K', 'park', 'f:hq@K#khq*5!Kessler Manor', 'q:casino@K#kcas!Ace of Clubs,-,-,tailor@K', 'q:-,diner@K,-,laundry@K'],
        ['q:warehouse@K#kwh,-,-,pawn', 'q:-,grocer@K,barber,-', 'plaza', 'q:garage@K,-,-,club@K', 'q:-,warehouse@K#kwh,-,-'],
        ['q:-,diner,laundry,-', 'f:precinct', 'q:bakery,-,-,grocer', 'q:-,tailor,diner,-', 'f:church'],
        ['q:hq@P#hq*3!Corrado House,-,garage#garage,-', 'q:-,barber,-,pawn', 'q:laundry,-,-,diner', 'q:-,grocer,tailor,-', 'q:diner,-,-,barber'],
      ],
    },
    families: [P(), { ...KESSLER, money: 3000, aggression: 0.55, cap: 16, statLo: 3, statHi: 6 }],
    npcs: [
      { fam: 'K', name: 'Victor Kessler', role: 'Boss', tag: 'victor', boss: true, hp: 260, at: 'khq', inside: true, weapon: 'tommy', stats: { muscle: 7, aim: 6, charm: 5 } },
      { fam: 'K', count: 5, at: 'khq', inside: true, weapon: 'tommy' },
      { fam: 'K', count: 2, at: 'kcas', inside: true },
      { fam: 'K', count: 3, at: 'kwh' },
    ],
    objectives: [
      { id: 'o1', text: 'Kill Victor Kessler', def: { k: 'kill', tag: 'victor' } },
      { id: 'o2', text: 'Capture Kessler Manor', def: { k: 'capture', tag: 'khq' } },
      { id: 'o3', text: 'Optional: burn the Kessler warehouses', def: { k: 'destroy', tag: 'kwh' }, optional: true },
    ],
    script: [
      { at: { day: 2, hour: 22 }, do: [{ k: 'wave', fam: 'K', n: 5, tag: 'hq', edge: 'S', weapon: 'tommy', car: true }, { k: 'news', text: 'Kessler cars seen massing on the Heights', big: true }] },
      { on: 'o1', do: [{ k: 'news', text: 'VICTOR KESSLER SLAIN — CITY HOLDS ITS BREATH', big: true }] },
    ],
    slots: 8, startHour: 9, gift: [], minCash: 2000, bribeMult: 1.2, reward: 0,
    news: ['Bank job stuns financial district', 'Kessler: "I am a legitimate businessman"'],
  },
];

export function chapterById(id: string): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.id === id);
}
