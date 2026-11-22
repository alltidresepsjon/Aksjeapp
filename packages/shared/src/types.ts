// Core data types for the Bathtub Gin simulation.
// Everything in WorldState is plain JSON so it can be saved and sent over the network.

export interface Pt { x: number; y: number }

export type FamId = string;
export const POLICE: FamId = 'police';

export type Stance = 'passive' | 'defensive' | 'aggressive';
export type Spec = 'none' | 'safecracker' | 'arsonist' | 'hitman' | 'cardsharp' | 'fixer';
export type WeaponId = 'fists' | 'revolver' | 'dual' | 'shotgun' | 'tommy' | 'rifle';
export type StatKey = 'muscle' | 'aim' | 'charm' | 'stealth';
export type Stats = Record<StatKey, number>;
export type VModel = 'roadster' | 'sedan' | 'truck' | 'armored';
export type Racket = 'speakeasy' | 'still' | 'gambling';

export type BType =
  | 'hq' | 'bakery' | 'barber' | 'laundry' | 'pawn' | 'diner' | 'tailor' | 'grocer'
  | 'garage' | 'warehouse' | 'club' | 'casino' | 'hotel' | 'bank' | 'precinct'
  | 'cityhall' | 'courthouse' | 'church' | 'pier' | 'tenement' | 'park' | 'water' | 'plaza'
  | 'amusement' | 'landing';

/** Things a unit can do at a building's door. */
export type Act =
  | 'enter' | 'extort' | 'takeover' | 'buy' | 'crack' | 'torch' | 'cards'
  | 'bribe' | 'spring' | 'load' | 'unload' | 'arm' | 'donate';

export type UnitLoc = 'street' | 'inside' | 'car' | 'jail' | 'dead' | 'held';

export type Order =
  | { k: 'idle' }
  | { k: 'move'; x: number; y: number }
  | { k: 'attack'; id: number }
  | { k: 'kidnap'; id: number }
  | { k: 'goto'; b: number; act: Act; arg?: string }
  | { k: 'board'; v: number }
  | { k: 'retreat'; b: number }
  | { k: 'follow'; id: number };

/** Scripted behaviour for named NPCs (Mick Doyle's rounds, a bodyguard, a garrison). */
export type Behavior =
  | { k: 'route'; tags: string[]; wait: number; i: number; t: number; car?: boolean }
  | { k: 'garrison'; tag: string }
  | { k: 'bodyguard'; of: number }
  | { k: 'raid'; tag: string };

export interface Task { k: Act; t: number; total: number; b: number }

export interface Unit {
  id: number;
  fam: FamId;
  name: string;
  role: string;
  spec: Spec;
  stats: Stats;
  level: number;
  xp: number;
  sp: number;
  hp: number;
  maxHp: number;
  weapon: WeaponId;
  mag: number;
  reload: number;
  cd: number;
  x: number;
  y: number;
  face: number;
  path: Pt[];
  moving: boolean;
  stance: Stance;
  retreat: boolean;
  order: Order;
  task: Task | null;
  loc: UnitLoc;
  bld: number;
  car: number;
  heat: number;
  wage: number;
  hero: boolean;
  boss: boolean;
  cop: boolean;
  guard: boolean;
  tag: string;
  target: number;
  lastHurt: number;
  lastShot: number;
  lastAttacker: number;
  bail: number;
  rosterId: string;
  kills: number;
  xpGain: number;
  repath: number;
  behavior: Behavior | null;
  heldBy: FamId;
  intel: number;
  grab: number;
}

export interface Manager { name: string; skill: number; wage: number; fee: number }

export interface Building {
  id: number;
  type: BType;
  name: string;
  x: number;
  y: number;
  size: number;
  floors: number;
  door: Pt;
  side: 'N' | 'S' | 'E' | 'W';
  street: string;
  owner: FamId | null;
  prog: Record<FamId, number>;
  manager: Manager | null;
  candidates: Manager[];
  racket: Racket | null;
  shut: number;
  stock: number;
  burned: boolean;
  fire: number;
  safe: number;
  cracked: boolean;
  tag: string;
  hqOf: FamId | null;
  price: number;
  style: number;
  seed: number;
  alarm: number;
}

export interface Vehicle {
  id: number;
  fam: FamId;
  model: VModel;
  name: string;
  x: number;
  y: number;
  face: number;
  hp: number;
  maxHp: number;
  path: Pt[];
  seats: number[];
  cargo: number;
  route: { from: number; to: number; stage: number; wait: number } | null;
  dead: boolean;
  driveBy: boolean;
}

export interface Payroll { precinct: number; hall: number; judge: number }

export interface Family {
  id: FamId;
  name: string;
  short: string;
  color: string;
  human: boolean;
  player: string;
  money: number;
  hq: number;
  eliminated: boolean;
  payroll: Payroll;
  reveal: number;
  robbed: number;
  delivered: number;
  aggression: number;
  cap: number;
  statLo: number;
  statHi: number;
  nextAi: number;
  edge: boolean;
  income: number;
  /** Standing with ordinary people, −100 (public enemy) … +100 (pillar of the community). */
  rep: number;
}

export interface Ad {
  id: string;
  name: string;
  role: string;
  spec: Spec;
  blurb: string;
  stats: Stats;
  weapon: WeaponId;
  fee: number;
  wage: number;
}

export interface NewsItem { day: number; hour: number; text: string; big: boolean; fam?: FamId }

export type GameEvent =
  | { id: number; k: 'shot'; x: number; y: number; tx: number; ty: number; w: WeaponId; hit: boolean; fam: FamId; t?: number }
  | { id: number; k: 'death'; x: number; y: number; fam: FamId; name: string }
  | { id: number; k: 'capture'; b: number; fam: FamId; prev: FamId | null }
  | { id: number; k: 'fire'; b: number }
  | { id: number; k: 'cash'; x: number; y: number; amount: number; fam: FamId }
  | { id: number; k: 'toast'; text: string; fam: FamId; x?: number; y?: number; urgent?: boolean }
  | { id: number; k: 'siren'; x: number; y: number }
  | { id: number; k: 'levelup'; unit: number; fam: FamId }
  | { id: number; k: 'arrest'; x: number; y: number; fam: FamId; name: string };

export type ObjDef =
  | { k: 'control'; n: number }
  | { k: 'defend'; tag: string; untilDay: number; untilHour: number }
  | { k: 'kidnap'; tag: string }
  | { k: 'interrogate'; tag: string }
  | { k: 'kill'; tag: string }
  | { k: 'racket'; kind: Racket; n: number }
  | { k: 'deliver'; n: number }
  | { k: 'cash'; n: number }
  | { k: 'destroy'; tag: string }
  | { k: 'capture'; tag: string }
  | { k: 'crack'; tag: string }
  | { k: 'free'; tag: string }
  | { k: 'rob'; n: number }
  | { k: 'car' };

export interface Objective {
  id: string;
  text: string;
  def: ObjDef;
  optional: boolean;
  after: string;
  done: boolean;
  failed: boolean;
  progress: string;
}

export interface Stamp { day: number; hour: number }

export type ScriptAction =
  | { k: 'news'; text: string; big?: boolean }
  | { k: 'toast'; text: string }
  | { k: 'wave'; fam: FamId; n: number; tag: string; edge: 'N' | 'S' | 'E' | 'W'; weapon?: WeaponId; car?: boolean }
  | { k: 'flag'; name: string };

export interface ScriptTrigger {
  at?: Stamp;
  on?: string;
  do: ScriptAction[];
  fired?: boolean;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface WorldState {
  mode: 'campaign' | 'turf';
  chapter: string;
  tick: number;
  time: number;
  day: number;
  hour: number;
  units: Unit[];
  buildings: Building[];
  vehicles: Vehicle[];
  families: Record<FamId, Family>;
  order: FamId[];
  news: NewsItem[];
  ads: Ad[];
  events: GameEvent[];
  evId: number;
  objectives: Objective[];
  script: ScriptTrigger[];
  flags: Record<string, number>;
  nextId: number;
  copTimer: number;
  result: null | { winner: FamId | null; text: string };
  fog: boolean;
  timeLimitDay: number;
  interrupt: number;
  /** 1 while it rains (fewer witnesses, shorter sight). */
  rain: number;
}
