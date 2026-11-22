import type { Act, Racket, StatKey, Stance, VModel } from '../types';

/** Orders a player can send. In multiplayer these are the only thing clients send to the server. */
export type Command =
  | { c: 'move'; units: number[]; x: number; y: number }
  | { c: 'attack'; units: number[]; target: number }
  | { c: 'kidnap'; units: number[]; target: number }
  | { c: 'act'; units: number[]; b: number; act: Act; arg?: string }
  | { c: 'stance'; units: number[]; stance: Stance }
  | { c: 'retreat'; units: number[]; on: boolean }
  | { c: 'board'; units: number[]; v: number }
  | { c: 'drive'; v: number; x: number; y: number }
  | { c: 'exit'; v: number }
  | { c: 'cargo'; v: number; b: number; op: 'load' | 'unload' }
  | { c: 'route'; v: number; from: number; to: number }
  | { c: 'stopRoute'; v: number }
  | { c: 'driveBy'; v: number; on: boolean }
  | { c: 'hire'; ad: string }
  | { c: 'fire'; unit: number }
  | { c: 'bail'; unit: number }
  | { c: 'manager'; b: number; idx: number }
  | { c: 'fireManager'; b: number }
  | { c: 'hireGuard'; b: number }
  | { c: 'racket'; b: number; kind: Racket }
  | { c: 'closeRacket'; b: number }
  | { c: 'buyCar'; b: number; model: VModel }
  | { c: 'hostage'; unit: number; what: 'interrogate' | 'ransom' | 'release' }
  | { c: 'skill'; unit: number; stat: StatKey }
  /** Put men under a lieutenant (leader -1 = they work on their own again). */
  | { c: 'lieutenant'; units: number[]; leader: number }
  | { c: 'patrol'; units: number[]; pts: { x: number; y: number }[] }
  | { c: 'tail'; units: number[]; target: number }
  | { c: 'guard'; units: number[]; x: number; y: number }
  /** Hire a lawyer for a jailed man's trial. */
  | { c: 'lawyer'; unit: number }
  /** Pay the street for news of a rival family. */
  | { c: 'rumor'; fam: string };
