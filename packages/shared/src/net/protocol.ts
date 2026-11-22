// Wire protocol for Turf War. The server runs the simulation; clients send commands
// and receive fog-filtered snapshots several times per second.

import type { Layout } from '../map/mapgen';
import type { Command } from '../sim/commands';
import type { World } from '../sim/world';
import type { Building, Family, FamId, GameEvent, Unit, Vehicle, WorldState } from '../types';

export interface LobbyPlayer { id: string; name: string; fam: string; host: boolean; connected: boolean }

export type ClientMsg =
  | { t: 'hello'; name: string; token?: string }
  | { t: 'create'; ai: number; days: number }
  | { t: 'join'; code: string }
  | { t: 'config'; ai: number; days: number }
  | { t: 'start' }
  | { t: 'leave' }
  | { t: 'cmd'; cmd: Command }
  | { t: 'speed'; speed: number }
  | { t: 'vote'; kind: 'pause' | 'skip' }
  | { t: 'chat'; text: string };

export type ServerMsg =
  | { t: 'welcome'; id: string; token: string }
  | { t: 'lobby'; code: string; players: LobbyPlayer[]; ai: number; days: number; started: boolean }
  | { t: 'error'; text: string }
  | { t: 'start'; fam: FamId; layout: Layout; startHour: number }
  | { t: 'snap'; s: Snapshot }
  | { t: 'cmdErr'; text: string }
  | { t: 'chat'; from: string; text: string }
  | { t: 'votes'; pause: string[]; skip: string[]; need: number };

/** The subset of WorldState a client needs to draw and play. */
export type ViewState = Pick<WorldState,
  'mode' | 'chapter' | 'tick' | 'time' | 'day' | 'hour' | 'units' | 'buildings' | 'vehicles' | 'families' | 'order' |
  'news' | 'ads' | 'events' | 'objectives' | 'result' | 'fog' | 'timeLimitDay'>;

export interface Snapshot extends ViewState {
  vis: string;
  speed: number;
  paused: boolean;
  skipping: boolean;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function packBits(bits: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bits.length; i += 6) {
    let v = 0;
    for (let j = 0; j < 6; j++) v |= (bits[i + j] ? 1 : 0) << j;
    out += B64[v];
  }
  return out;
}

export function unpackBits(str: string, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < str.length; i++) {
    const v = B64.indexOf(str[i]);
    for (let j = 0; j < 6; j++) { const k = i * 6 + j; if (k < n) out[k] = (v >> j) & 1; }
  }
  return out;
}

function hideBuilding(b: Building, fam: FamId, seen: boolean): Building {
  if (b.owner === fam) return b;
  return {
    ...b,
    candidates: [],
    manager: b.manager && seen ? b.manager : null,
    racket: seen ? b.racket : null,
    stock: 0,
    safe: b.type === 'bank' ? b.safe : 0,
    prog: seen || Object.prototype.hasOwnProperty.call(b.prog, fam) ? b.prog : {},
  };
}

function hideFamily(f: Family, fam: FamId): Family {
  if (f.id === fam) return f;
  return { ...f, money: Math.round(f.money / 500) * 500, payroll: { precinct: 0, hall: 0, judge: 0 } };
}

/** Build the snapshot one family is allowed to see. */
export function makeSnapshot(w: World, fam: FamId, sinceEv: number, extra: { speed: number; paused: boolean; skipping: boolean }): Snapshot {
  const s = w.s;
  const vis = w.visibility(fam);
  const seen = (x: number, y: number) => w.visibleTo(fam, vis, { x, y });
  const units: Unit[] = [];
  for (const u of s.units) {
    if (u.fam === fam) { units.push(u); continue; }
    if (u.loc === 'dead' && s.time - u.lastHurt > 3) continue;
    if (u.loc === 'held' && u.heldBy === fam) { units.push(u); continue; }
    if (u.loc !== 'street' && u.loc !== 'car' && u.loc !== 'dead') continue;
    const p = w.pos(u);
    if (!seen(p.x, p.y)) continue;
    units.push({ ...u, path: u.path.slice(0, 1), stats: u.stats, behavior: null });
  }
  const vehicles: Vehicle[] = s.vehicles.filter((v) => v.fam === fam || seen(v.x, v.y));
  const buildings = s.buildings.map((b) => hideBuilding(b, fam, seen(b.door.x, b.door.y)));
  const families: Record<FamId, Family> = {};
  for (const id of Object.keys(s.families)) families[id] = hideFamily(s.families[id], fam);
  const events: GameEvent[] = s.events.filter((e) => {
    if (e.id <= sinceEv) return false;
    if (e.k === 'toast' || e.k === 'levelup') return e.fam === fam;
    if (e.k === 'shot') return seen(e.x, e.y) || seen(e.tx, e.ty);
    if (e.k === 'death' || e.k === 'cash' || e.k === 'arrest') return e.fam === fam || seen(e.x, e.y);
    return true;
  });
  return {
    mode: s.mode, chapter: s.chapter, tick: s.tick, time: s.time, day: s.day, hour: s.hour,
    units, buildings, vehicles, families, order: s.order, news: s.news.slice(0, 30), ads: s.ads,
    events, objectives: s.objectives, result: s.result, fog: s.fog, timeLimitDay: s.timeLimitDay,
    vis: packBits(vis), ...extra,
  };
}

export type { Command };
