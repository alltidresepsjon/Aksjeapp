// The authoritative game simulation. Runs in the browser for the campaign and on the server for Turf War.

import {
  BUILDING_SIGHT, COP_SPEED, DT, HEAT_WANTED, HOUR, MAX_HEAT, NIGHT_SIGHT, SIGHT, WALK_SPEED,
  isNight, isOpen, PERIOD,
} from '../constants';
import { BTYPES, OFFICIALS, RACKETS, shopName } from '../data/buildings';
import { PROPRIETORS, WEATHER, FIRST, LAST } from '../data/names';
import { VEHICLES } from '../data/vehicles';
import { WEAPONS } from '../data/weapons';
import { generateMap, type Layout, type MapData } from '../map/mapgen';
import { PathFinder } from '../map/pathfind';
import { Rng } from '../rng';
import type {
  Act, Building, FamId, Family, GameEvent, Manager, Objective, Pt, ScriptTrigger, Unit, Vehicle, VModel,
  WeaponId, WorldState,
} from '../types';
import { POLICE } from '../types';
import type { Command } from './commands';
import { genAd, grantXp, makeUnit, soldierInit, spendSkillPoint, type UnitInit } from './units';
import { runAi, type AiMemory } from './ai';
import { checkObjectives, runScript } from './objectives';
import type { ChapterObjective, FamilySetup, NpcSetup } from '../data/chapters';

export interface WorldInit {
  mode: 'campaign' | 'turf';
  chapter: string;
  layout: Layout;
  families: (FamilySetup & { player?: string })[];
  crew: Record<FamId, UnitInit[]>;
  vehicles: { fam: FamId; model: VModel }[];
  npcs: NpcSetup[];
  objectives: ChapterObjective[];
  script: ScriptTrigger[];
  startHour: number;
  seed: number;
  fog: boolean;
  bribeMult: number;
  news: string[];
  timeLimitDay?: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export class World {
  s: WorldState;
  map: MapData;
  pf: PathFinder;
  rng: Rng;
  startHour: number;
  bribeMult: number;
  ai = new Map<FamId, AiMemory>();
  fired: string[] = [];
  private unitIdx = new Map<number, Unit>();

  constructor(init: WorldInit) {
    this.map = generateMap(init.layout);
    this.pf = new PathFinder(this.map);
    this.rng = new Rng(init.seed);
    this.startHour = init.startHour;
    this.bribeMult = init.bribeMult;
    const rng = this.rng;
    const buildings: Building[] = this.map.lots.map((l, i) => {
      const def = BTYPES[l.type];
      return {
        id: i, type: l.type, name: l.name || shopName(l.type, rng.pick(PROPRIETORS), rng.int(0, 9)),
        x: l.x, y: l.y, size: l.size, floors: l.floors, door: l.door, side: l.side, street: l.street,
        owner: l.owner, prog: {}, manager: null, candidates: [], racket: null, shut: 0, stock: 0,
        burned: false, fire: 0, safe: l.type === 'bank' ? 5000 : 0, cracked: false, tag: l.tag,
        hqOf: l.type === 'hq' ? l.owner : null, price: def.price * (l.size === 6 ? 1.6 : 1),
        style: rng.int(0, 7), seed: rng.int(1, 1e9), alarm: 0,
      };
    });
    const used = new Set<string>();
    for (const b of buildings) {
      let n = b.name;
      for (let k = 0; used.has(n) && k < 12; k++) n = shopName(b.type, rng.pick(PROPRIETORS), rng.int(0, 9));
      if (used.has(n)) n = `${b.name} (${b.street})`;
      used.add(n);
      b.name = n;
    }
    const families: Record<FamId, Family> = {};
    for (const f of init.families) {
      const hq = buildings.find((b) => b.hqOf === f.id);
      if (hq && !f.human) hq.safe = 1500;
      families[f.id] = {
        id: f.id, name: f.name, short: f.short, color: f.color, human: f.human, player: f.player ?? '',
        money: f.money, hq: hq ? hq.id : -1, eliminated: false, payroll: { precinct: 0, hall: 0, judge: 0 },
        reveal: 0, robbed: 0, delivered: 0, aggression: f.aggression, cap: f.cap, statLo: f.statLo, statHi: f.statHi,
        nextAi: 2 + Object.keys(families).length * 0.7, edge: !!f.edge || !hq, income: 0,
      };
    }
    this.s = {
      mode: init.mode, chapter: init.chapter, tick: 0, time: 0, day: 1, hour: init.startHour,
      units: [], buildings, vehicles: [], families, order: init.families.map((f) => f.id),
      news: [], ads: [], events: [], evId: 1,
      objectives: init.objectives.map((o): Objective => ({ id: o.id, text: o.text, def: o.def, optional: !!o.optional, after: o.after ?? '', done: false, failed: false, progress: '' })),
      script: init.script.map((t) => ({ ...t, fired: false })),
      flags: {}, nextId: 1, copTimer: 0, result: null, fog: init.fog, timeLimitDay: init.timeLimitDay ?? 0, interrupt: 0,
    };
    for (const b of buildings) this.refreshCandidates(b);
    const human = init.families.find((f) => f.human);
    if (human) this.s.flags.startMoney = human.money;

    // player crews
    for (const fid of Object.keys(init.crew)) {
      const fam = families[fid];
      const hq = fam && fam.hq >= 0 ? buildings[fam.hq] : null;
      for (const ui of init.crew[fid]) {
        const at = hq ? hq.door : this.edgePoint('S');
        const u = this.addUnit({ ...ui, fam: fid }, this.jitter(at));
        if (u.weapon === 'fists' && !ui.weapon) u.weapon = 'revolver';
      }
    }
    for (const v of init.vehicles) {
      const fam = families[v.fam];
      const near = fam && fam.hq >= 0 ? buildings[fam.hq].door : this.edgePoint('S');
      const garage = buildings.find((b) => b.type === 'garage' && b.owner === v.fam) ?? null;
      this.addVehicle(v.fam, v.model, this.pf.nearestWalkable(this.jitter(garage ? garage.door : near, 1.2)));
    }
    for (const n of init.npcs) this.spawnNpc(n);
    for (const t of init.news) this.news(t, true);
    for (let i = 0; i < 4; i++) this.s.ads.push(genAd(this.rng, 1));
    if (init.mode === 'campaign') this.s.order = init.families.map((f) => f.id);
  }

  // ---------- lookups ----------
  get state() { return this.s; }
  unit(id: number): Unit | undefined {
    const u = this.unitIdx.get(id);
    return u && u.loc !== 'dead' ? u : undefined;
  }
  anyUnit(id: number): Unit | undefined { return this.unitIdx.get(id); }
  vehicle(id: number): Vehicle | undefined { return this.s.vehicles.find((v) => v.id === id && !v.dead); }
  building(id: number): Building | undefined { return this.s.buildings[id]; }
  byTag(tag: string): Building[] { return this.s.buildings.filter((b) => b.tag === tag || (tag && b.tag.startsWith(tag))); }
  fam(id: FamId): Family | undefined { return this.s.families[id]; }
  hqOf(fam: FamId): Building | null { const f = this.s.families[fam]; return f && f.hq >= 0 ? this.s.buildings[f.hq] : null; }
  absHour(): number { return this.startHour + this.s.time / HOUR; }
  night(): boolean { return isNight(this.s.hour); }
  alive(u: Unit) { return u.loc !== 'dead'; }
  /** Units physically in the city (can fight or be seen). */
  active(u: Unit) { return u.loc === 'street' || u.loc === 'car' || u.loc === 'inside'; }
  pos(u: Unit): Pt {
    if (u.loc === 'inside' || u.loc === 'held') { const b = this.s.buildings[u.bld]; return b ? b.door : u; }
    if (u.loc === 'car') { const v = this.vehicle(u.car); return v ?? u; }
    return u;
  }

  // ---------- creation ----------
  jitter(p: Pt, r = 0.6): Pt {
    return { x: p.x + this.rng.range(-r, r) * 0.6, y: p.y + this.rng.range(-r, r) * 0.6 };
  }
  addUnit(init: UnitInit, at: Pt): Unit {
    const p = this.pf.nearestWalkable(at);
    const u = makeUnit(this.s.nextId++, init, p.x, p.y);
    this.s.units.push(u);
    this.unitIdx.set(u.id, u);
    return u;
  }
  addVehicle(fam: FamId, model: VModel, at: Pt): Vehicle {
    const def = VEHICLES[model];
    const v: Vehicle = {
      id: this.s.nextId++, fam, model, name: def.name, x: at.x, y: at.y, face: 0, hp: def.hp, maxHp: def.hp,
      path: [], seats: [], cargo: 0, route: null, dead: false, driveBy: true,
    };
    this.s.vehicles.push(v);
    return v;
  }
  edgePoint(edge: 'N' | 'S' | 'E' | 'W'): Pt {
    const { w, h, bw, bh } = this.map;
    const lane = (n: number) => this.rng.int(0, n) * PERIOD + 1;
    let p: Pt;
    if (edge === 'N') p = { x: lane(bw), y: 0.6 };
    else if (edge === 'S') p = { x: lane(bw), y: h - 0.6 };
    else if (edge === 'W') p = { x: 0.6, y: lane(bh) };
    else p = { x: w - 0.6, y: lane(bh) };
    return this.pf.nearestWalkable(p);
  }
  spawnNpc(n: NpcSetup) {
    const bs = this.byTag(n.at);
    const b = bs[0];
    const fam = this.s.families[n.fam];
    if (!fam) return;
    const count = n.count ?? 1;
    for (let i = 0; i < count; i++) {
      const base = b ?? null;
      const at = base ? base.door : this.edgePoint('N');
      let init: UnitInit;
      if (n.name) {
        init = {
          fam: n.fam, name: n.name, role: n.role ?? 'Soldier', spec: n.spec, tag: n.tag, boss: n.boss, hpBonus: n.hp,
          stats: { muscle: 3, aim: 3, charm: 2, stealth: 2, ...n.stats }, weapon: n.weapon ?? 'revolver', level: n.boss ? 4 : 1,
          stance: n.stance ?? (n.boss ? 'defensive' : 'aggressive'),
        };
      } else {
        init = soldierInit(this.rng, n.fam, fam.statLo, fam.statHi, n.weapon);
        init.stance = n.stance ?? 'aggressive';
      }
      const u = this.addUnit(init, this.jitter(at));
      if (n.joins) u.rosterId = 'new:' + u.id;
      if (n.jailed) { u.loc = 'jail'; u.bail = 1800; u.stance = 'passive'; continue; }
      if (n.inside && base) { u.loc = 'inside'; u.bld = base.id; u.behavior = { k: 'garrison', tag: n.at }; }
      if (n.route) {
        u.behavior = { k: 'route', tags: n.route.tags, wait: n.route.wait, i: 0, t: 0 };
        if (n.route.night) this.s.flags['night:' + u.id] = this.byTag(n.route.night)[0]?.id ?? -1;
        for (let g = 0; g < (n.bodyguards ?? 0); g++) {
          const bg = this.addUnit({ ...soldierInit(this.rng, n.fam, fam.statLo + 1, fam.statHi + 1, 'shotgun'), role: 'Bodyguard', stance: 'aggressive' }, this.jitter(at));
          bg.behavior = { k: 'bodyguard', of: u.id };
          bg.retreat = false;
        }
      }
      if (u.boss) u.retreat = false;
    }
  }

  // ---------- news & events ----------
  news(text: string, big = false, fam?: FamId) {
    this.s.news.unshift({ day: this.s.day, hour: Math.floor(this.s.hour), text, big, fam });
    if (this.s.news.length > 60) this.s.news.pop();
  }
  ev(e: Omit<GameEvent, 'id'> & { k: GameEvent['k'] }) {
    (e as GameEvent).id = this.s.evId++;
    this.s.events.push(e as GameEvent);
  }
  toast(fam: FamId, text: string, at?: Pt, urgent = false) {
    this.ev({ k: 'toast', text, fam, x: at?.x, y: at?.y, urgent } as GameEvent);
  }

  // ---------- main tick ----------
  tick() {
    const s = this.s;
    if (s.result) return;
    const prevAbs = this.absHour();
    s.tick++;
    s.time += DT;
    const abs = this.absHour();
    s.day = 1 + Math.floor(abs / 24);
    s.hour = abs % 24;
    if (Math.floor(abs) !== Math.floor(prevAbs)) this.onHour(Math.floor(abs) % 24);

    for (const fid of s.order) {
      const f = s.families[fid];
      if (!f || f.human || f.eliminated) continue;
      f.nextAi -= DT;
      if (f.nextAi <= 0) { f.nextAi = 2; runAi(this, f); }
    }
    this.behaviors();
    for (const u of s.units) if (u.loc === 'street') this.tickUnit(u);
    for (const v of s.vehicles) if (!v.dead) this.tickVehicle(v);
    this.combat();
    this.police();
    this.upkeep();
    for (const b of s.buildings) this.tickBuilding(b);
    if (s.tick % 5 === 0) { runScript(this); checkObjectives(this); }
    // trim
    if (s.events.length > 400) s.events.splice(0, s.events.length - 400);
    if (s.tick % 50 === 0) {
      s.units = s.units.filter((u) => u.loc !== 'dead' || s.time - u.lastHurt < 20 || u.rosterId);
      this.unitIdx = new Map(s.units.map((u) => [u.id, u]));
      s.vehicles = s.vehicles.filter((v) => !v.dead || s.time - v.hp < 30);
    }
  }

  // ---------- time-based economy ----------
  onHour(h: number) {
    const s = this.s;
    const earned: Record<FamId, number> = {};
    for (const b of s.buildings) {
      if (!b.owner || b.burned || !s.families[b.owner]) continue;
      const def = BTYPES[b.type];
      const fam = s.families[b.owner];
      const mgr = b.manager ? 1 + b.manager.skill * 0.08 : fam.human ? 1 : 1.15;
      let inc = 0;
      if (def.income && (isOpen(h) || b.type === 'hq' || b.type === 'club' || b.type === 'casino')) {
        const hours = b.type === 'hq' ? 24 : b.type === 'club' || b.type === 'casino' ? 24 : 12;
        inc += (def.income * (b.size === 6 ? 1.6 : 1)) / hours * mgr;
      }
      const rh = h >= 20 || h < 4;
      if (b.racket && b.shut <= 0 && rh && (b.manager || !fam.human)) {
        const r = RACKETS[b.racket];
        let mult = 1;
        if (b.racket === 'speakeasy') {
          if (h % 2 === 0) { if (b.stock > 0) b.stock--; else mult = 0.2; }
          else if (b.stock <= 0) mult = 0.2;
        }
        if (b.racket === 'still' && (h === 21 || h === 0 || h === 3)) b.stock = Math.min(24, b.stock + 1);
        inc += (r.income / 8) * mult * mgr;
      }
      if (inc > 0) { fam.money += inc; earned[fam.id] = (earned[fam.id] ?? 0) + inc; }
    }
    for (const fid of Object.keys(earned)) {
      const hq = this.hqOf(fid);
      const amt = Math.round(earned[fid]);
      if (hq && amt > 0) this.ev({ k: 'cash', x: hq.door.x, y: hq.door.y, amount: amt, fam: fid } as GameEvent);
    }
    // AI families without HQs on the map get a stipend from "back home"
    for (const f of Object.values(s.families)) if (!f.human && f.edge && !f.eliminated) f.money += 12;

    if (h === 0) this.news(`Midnight on ${this.map.streetsH[0]}. ${this.rng.pick(['The speakeasies are full.', 'Gin flows like the harbor tide.', 'A saxophone wails somewhere.'])}`);
    if (h === 6) this.morning();
    if (h === 23) this.raids();
  }

  morning() {
    const s = this.s;
    for (const f of Object.values(s.families)) {
      if (f.eliminated) continue;
      let wages = 0;
      for (const u of s.units) if (u.fam === f.id && this.active(u)) wages += u.wage;
      for (const b of s.buildings) if (b.owner === f.id && b.manager) wages += b.manager.wage;
      f.money -= wages;
      f.payroll.precinct = Math.max(0, f.payroll.precinct - 1);
      f.payroll.hall = Math.max(0, f.payroll.hall - 1);
      f.payroll.judge = Math.max(0, f.payroll.judge - 1);
      if (f.money < 0) {
        const q = s.units.filter((u) => u.fam === f.id && this.active(u) && !u.hero && !u.boss && u.wage > 0).sort((a, b) => b.wage - a.wage)[0];
        if (q) {
          this.removeUnit(q);
          if (f.human) { this.news(`Unpaid, ${q.name} walks out on the ${f.short}s`, true, f.id); this.toast(f.id, `${q.name} quit — you couldn't pay wages.`, undefined, true); }
        }
      }
    }
    for (const b of s.buildings) { b.shut = Math.max(0, b.shut - 1); this.refreshCandidates(b); if (b.type === 'bank' && b.safe < 2000) b.safe += 1500; }
    s.ads = [];
    for (let i = 0; i < 4; i++) s.ads.push(genAd(this.rng, s.day));
    this.news(`Day ${s.day}: ${this.rng.pick(WEATHER)}. New help-wanted notices posted.`);
  }

  raids() {
    const s = this.s;
    for (const b of s.buildings) {
      if (!b.racket || !b.owner || b.shut > 0) continue;
      const f = s.families[b.owner];
      if (!f || f.payroll.precinct > 0) continue;
      const crew = s.units.filter((u) => u.fam === f.id && this.active(u));
      const avgHeat = crew.length ? crew.reduce((a, u) => a + u.heat, 0) / crew.length : 0;
      const p = 0.05 + avgHeat / 260 - (f.payroll.hall > 0 ? 0.04 : 0);
      if (!this.rng.chance(p)) continue;
      const guards = s.units.filter((u) => u.fam === f.id && u.loc === 'inside' && u.bld === b.id);
      if (guards.length && this.rng.chance(0.5)) {
        for (const g of guards) g.heat = Math.min(MAX_HEAT, g.heat + 20);
        this.news(`Police raid on ${b.street} turned back by "unfriendly" doormen`, false, f.id);
        continue;
      }
      b.shut = 2; b.stock = 0;
      this.ev({ k: 'siren', x: b.door.x, y: b.door.y } as GameEvent);
      this.news(`DRY RAID! Police smash a ${RACKETS[b.racket].name.toLowerCase()} behind ${b.name} on ${b.street}`, true, f.id);
      if (f.human) this.toast(f.id, `Police raided your ${RACKETS[b.racket].name} at ${b.name}. Closed for 2 days.`, b.door, true);
    }
  }

  refreshCandidates(b: Building) {
    if (!BTYPES[b.type].business || b.type === 'hq') { b.candidates = []; return; }
    const out: Manager[] = [];
    for (let i = 0; i < 3; i++) {
      const skill = this.rng.int(1, 5);
      out.push({ name: `${this.rng.pick(['Mr.', 'Mrs.', 'Miss'])} ${this.rng.pick(LAST)}`, skill, wage: 4 + skill * 4, fee: 20 + skill * 25 });
    }
    b.candidates = out;
  }

  // ---------- NPC behaviours ----------
  behaviors() {
    const s = this.s;
    for (const u of s.units) {
      if (!u.behavior || !this.active(u)) continue;
      const bh = u.behavior;
      const busy = s.time - u.lastHurt < 4 || u.target >= 0;
      if (bh.k === 'garrison') {
        const b = bh.tag.startsWith('#') ? s.buildings[+bh.tag.slice(1)] : this.byTag(bh.tag)[0];
        if (b && b.owner !== u.fam) u.behavior = null;
        continue;
      }
      if (bh.k === 'bodyguard') {
        const lead = this.unit(bh.of);
        if (!lead) { u.behavior = null; continue; }
        if (lead.loc === 'inside' && u.loc !== 'inside') {
          if (u.order.k !== 'goto') this.order(u, { k: 'goto', b: lead.bld, act: 'enter' });
        } else if (lead.loc === 'street' && u.loc === 'inside') {
          this.exitBuilding(u);
        } else if (!busy && u.loc === 'street' && dist(u, lead) > 1.6 && s.tick % 5 === u.id % 5) {
          this.order(u, { k: 'move', x: lead.x + ((u.id % 3) - 1) * 0.5, y: lead.y + ((u.id % 2) - 0.5) * 0.6 });
        }
        continue;
      }
      if (bh.k === 'raid') {
        if (u.order.k === 'idle' && u.loc === 'street' && !busy) {
          const b = this.byTag(bh.tag)[0];
          if (b && b.owner !== u.fam) this.order(u, { k: 'goto', b: b.id, act: 'takeover' });
          else u.behavior = null;
        }
        continue;
      }
      if (bh.k === 'route') {
        if (busy) continue;
        const nightB = s.flags['night:' + u.id];
        if (this.night() && nightB !== undefined && nightB >= 0) {
          if (u.loc !== 'inside' && u.order.k !== 'goto') this.order(u, { k: 'goto', b: nightB, act: 'enter' });
          continue;
        }
        if (u.loc === 'inside') { this.exitBuilding(u); continue; }
        if (u.order.k === 'goto' || u.path.length) continue;
        bh.t -= DT;
        if (bh.t > 0) continue;
        bh.i = (bh.i + 1) % bh.tags.length;
        bh.t = bh.wait * HOUR;
        const b = this.byTag(bh.tags[bh.i])[0];
        if (b) this.order(u, { k: 'move', x: b.door.x, y: b.door.y });
      }
    }
  }

  // ---------- orders & movement ----------
  order(u: Unit, o: Unit['order']) {
    u.order = o;
    u.task = null;
    u.repath = 0;
    u.grab = 0;
    if (u.loc === 'inside' && o.k !== 'goto') this.exitBuilding(u);
    else if (u.loc === 'inside' && o.k === 'goto' && o.b !== u.bld) this.exitBuilding(u);
    if (u.loc !== 'street') { u.path = []; return; }
    const t = this.orderTarget(u);
    u.path = t ? this.pf.find(u, t) : [];
  }
  orderTarget(u: Unit): Pt | null {
    const o = u.order;
    if (o.k === 'move') return { x: o.x, y: o.y };
    if (o.k === 'goto' || o.k === 'retreat') { const b = this.s.buildings[o.b]; return b ? b.door : null; }
    if (o.k === 'attack' || o.k === 'kidnap' || o.k === 'follow') { const t = this.unit(o.id); return t ? this.pos(t) : null; }
    if (o.k === 'board') { const v = this.vehicle(o.v); return v ?? null; }
    return null;
  }
  exitBuilding(u: Unit) {
    if (u.loc !== 'inside') return;
    const b = this.s.buildings[u.bld];
    u.loc = 'street';
    u.bld = -1;
    u.task = null;
    if (b) { const p = this.jitter(b.door, 0.5); const w = this.pf.nearestWalkable(p); u.x = w.x; u.y = w.y; }
  }
  enterBuilding(u: Unit, b: Building) {
    u.loc = 'inside';
    u.bld = b.id;
    u.path = [];
    u.x = b.door.x; u.y = b.door.y;
  }
  speedOf(u: Unit): number {
    if (u.cop) return COP_SPEED;
    const hurt = u.hp < u.maxHp * 0.3 ? 0.8 : 1;
    return WALK_SPEED * (1 + u.stats.stealth * 0.015) * hurt * (u.order.k === 'retreat' ? 1.15 : 1);
  }
  step(o: { x: number; y: number; path: Pt[]; face: number }, spd: number): boolean {
    let step = spd * DT;
    let moved = false;
    while (step > 0 && o.path.length) {
      const w = o.path[0];
      const dx = w.x - o.x, dy = w.y - o.y, d = Math.hypot(dx, dy);
      if (d > 1e-4) o.face = dx - dy >= 0 ? 1 : -1;
      if (d <= step) { o.x = w.x; o.y = w.y; o.path.shift(); step -= d; }
      else { o.x += (dx / d) * step; o.y += (dy / d) * step; step = 0; }
      moved = true;
    }
    return moved;
  }

  tickUnit(u: Unit) {
    const o = u.order;
    const s = this.s;
    // chase moving targets
    if (o.k === 'attack' || o.k === 'kidnap' || o.k === 'follow' || o.k === 'board') {
      const tp = this.orderTarget(u);
      if (!tp) { this.order(u, { k: 'idle' }); return; }
      if (o.k === 'board') {
        const v = this.vehicle(o.v)!;
        if (dist(u, v) < 0.9) { this.board(u, v); return; }
      }
      const tu = o.k === 'attack' || o.k === 'kidnap' ? this.unit(o.id) : undefined;
      if (tu && (tu.loc === 'jail' || tu.loc === 'held')) { this.order(u, { k: 'idle' }); return; }
      const wr = WEAPONS[u.weapon].range;
      const want = o.k === 'kidnap' || u.cop ? 0.6 : o.k === 'attack' ? wr * 0.8 : 0.8;
      const d = dist(u, tp);
      const los = o.k === 'attack' ? this.pf.sight(u, tp) : true;
      if (d <= want && los) {
        u.path = [];
        if (o.k === 'kidnap' && tu) this.tryGrab(u, tu);
      } else {
        u.repath -= DT;
        if (u.repath <= 0 || !u.path.length) { u.repath = 0.6; u.path = this.pf.find(u, tp); }
      }
    }
    const stopToFight = u.target >= 0 && (o.k === 'idle' || o.k === 'attack' || o.k === 'goto' && u.stance === 'aggressive' && o.act !== 'enter');
    u.moving = !stopToFight && this.step(u, this.speedOf(u));
    if (u.path.length) return;
    if (o.k === 'move') { u.order = { k: 'idle' }; return; }
    if (o.k === 'retreat') {
      const b = this.s.buildings[o.b];
      if (b && b.owner === u.fam) this.enterBuilding(u, b);
      u.order = { k: 'idle' };
      return;
    }
    if (o.k === 'goto') {
      const b = this.s.buildings[o.b];
      if (!b) { u.order = { k: 'idle' }; return; }
      if (dist(u, b.door) > 0.6) { u.path = this.pf.find(u, b.door); if (!u.path.length) u.order = { k: 'idle' }; return; }
      this.doAct(u, b, o.act, o.arg);
    }
  }

  board(u: Unit, v: Vehicle) {
    if (v.fam !== u.fam) { this.order(u, { k: 'idle' }); return; }
    if (v.seats.length >= VEHICLES[v.model].seats) { this.toast(u.fam, `${v.name} is full.`); this.order(u, { k: 'idle' }); return; }
    v.seats.push(u.id);
    u.loc = 'car';
    u.car = v.id;
    u.path = [];
    u.order = { k: 'idle' };
  }
  unboard(u: Unit) {
    const v = this.vehicle(u.car) ?? this.s.vehicles.find((x) => x.id === u.car);
    if (v) v.seats = v.seats.filter((id) => id !== u.id);
    u.loc = 'street';
    u.car = -1;
    const p = this.pf.nearestWalkable(this.jitter(v ?? u, 0.7));
    u.x = p.x; u.y = p.y;
  }

  // ---------- building actions ----------
  canAct(u: Unit, b: Building, act: Act, arg?: string): string | null {
    const def = BTYPES[b.type];
    const fam = this.s.families[u.fam];
    const night = this.night();
    switch (act) {
      case 'enter': return b.owner === u.fam && !b.burned ? null : 'You can only go inside your own buildings.';
      case 'extort':
        if (!def.business || b.type === 'hq') return 'Nothing to extort here.';
        if (b.owner) return 'Already paying someone. You will have to muscle in.';
        if (b.burned) return 'Burned out. Buy it to rebuild.';
        if (!isOpen(this.s.hour)) return 'Shops are closed. Come back between 8:00 and 20:00.';
        return null;
      case 'takeover':
        if (!def.business) return 'You cannot take this building.';
        if (b.owner === u.fam) return 'Already yours.';
        if (b.burned) return 'Burned out. Buy it to rebuild.';
        return null;
      case 'buy': {
        if (b.owner) return 'Not for sale.';
        if (!def.price) return 'Not for sale.';
        if (!isOpen(this.s.hour)) return 'Offices are closed. Come back between 8:00 and 20:00.';
        if (fam.money < this.buyPrice(b, u.fam)) return 'Not enough cash.';
        return null;
      }
      case 'crack':
        if (u.spec !== 'safecracker') return 'Only a safecracker can open a safe.';
        if (b.type === 'bank') return night ? (b.safe > 0 ? null : 'The vault is empty.') : 'The bank is full of people. Come back after dark.';
        if (b.safe > 0 && !b.cracked && b.owner === u.fam) return null;
        return b.safe > 0 && !b.cracked ? 'Take the building first.' : 'No safe worth cracking here.';
      case 'torch':
        if (u.spec !== 'arsonist') return 'You need an arsonist for this.';
        if (b.owner === u.fam) return 'That is our own building!';
        if (b.burned) return 'Already a ruin.';
        if (!def.business || b.type === 'hq') return 'Too well built (or too holy) to burn.';
        return null;
      case 'cards':
        if (u.spec !== 'cardsharp') return 'Only a card sharp can win at the tables.';
        if (b.type !== 'casino' && b.type !== 'club' && b.racket !== 'gambling') return 'No card games here.';
        if (b.burned) return 'Burned out.';
        return null;
      case 'bribe': {
        if (b.type !== 'precinct' && b.type !== 'cityhall' && b.type !== 'courthouse') return 'Nobody here worth bribing.';
        if (fam.money < this.bribeCost(b, u)) return 'Not enough cash.';
        return null;
      }
      case 'spring':
        if (u.spec !== 'fixer') return 'Only a fixer can talk people out of jail.';
        if (b.type !== 'precinct') return 'Go to the police precinct.';
        if (!this.s.units.some((x) => x.fam === u.fam && x.loc === 'jail')) return 'Nobody of ours is in jail.';
        return null;
      case 'arm': {
        if (b.type !== 'pawn') return 'Guns are sold at the pawn shop.';
        if (b.owner && b.owner !== u.fam) return 'The rivals own this shop.';
        const w = WEAPONS[(arg as WeaponId) ?? 'revolver'];
        if (!w) return 'Unknown weapon.';
        if (fam.money < this.gunPrice(b, u.fam, w.id)) return 'Not enough cash.';
        return null;
      }
      default: return 'Not possible.';
    }
  }
  buyPrice(b: Building, fam: FamId): number {
    const f = this.s.families[fam];
    let p = b.price * (b.burned ? 1.2 : 1);
    if (f && f.payroll.hall > 0) p *= 0.7;
    return Math.round(p);
  }
  bribeCost(b: Building, u: Unit | null): number {
    const key = b.type as 'precinct' | 'cityhall' | 'courthouse';
    const base = OFFICIALS[key]?.cost ?? 0;
    return Math.round(base * this.bribeMult * (1 + (this.s.day - 1) * 0.05) * (u && u.spec === 'fixer' ? 0.6 : 1));
  }
  gunPrice(b: Building, fam: FamId, w: WeaponId): number {
    return Math.round(WEAPONS[w].price * (b.owner === fam ? 0.5 : 1));
  }

  doAct(u: Unit, b: Building, act: Act, arg?: string) {
    const err = this.canAct(u, b, act, arg);
    const f = this.s.families[u.fam];
    if (err) {
      if (f.human) this.toast(u.fam, `${u.name}: ${err}`, b.door);
      u.order = { k: 'idle' };
      if (act === 'enter' && b.owner === u.fam) this.enterBuilding(u, b);
      return;
    }
    const s = this.s;
    switch (act) {
      case 'enter': this.enterBuilding(u, b); u.order = { k: 'idle' }; return;
      case 'buy': {
        const p = this.buyPrice(b, u.fam);
        f.money -= p;
        b.burned = false; b.fire = 0;
        this.capture(b, u.fam, [u]);
        this.news(`${b.name} on ${b.street} changes hands; buyer "a respectable family"`, false, u.fam);
        u.order = { k: 'idle' };
        return;
      }
      case 'bribe': {
        const cost = this.bribeCost(b, u);
        f.money -= cost;
        if (b.type === 'precinct') {
          f.payroll.precinct = OFFICIALS.precinct.days;
          for (const x of s.units) if (x.fam === u.fam) x.heat = Math.max(0, x.heat - 40);
          this.news('Precinct captain spotted with a new overcoat; investigations "stalled"', false, u.fam);
        } else if (b.type === 'cityhall') {
          f.payroll.hall = OFFICIALS.cityhall.days;
          this.news('Alderman fast-tracks business permits for "community-minded" buyers', false, u.fam);
        } else {
          f.payroll.judge = OFFICIALS.courthouse.days;
          for (const x of s.units) if (x.fam === u.fam && x.loc === 'jail') this.release(x);
          this.news('Judge dismisses a stack of cases for "lack of evidence"', false, u.fam);
        }
        this.toast(u.fam, `Bribe paid ($${cost}). ${OFFICIALS[b.type as 'precinct'].effect}`, b.door);
        u.order = { k: 'idle' };
        return;
      }
      case 'arm': {
        const w = (arg as WeaponId) ?? 'revolver';
        f.money -= this.gunPrice(b, u.fam, w);
        u.weapon = w; u.mag = WEAPONS[w].mag; u.reload = 0;
        this.toast(u.fam, `${u.name} now carries a ${WEAPONS[w].name}.`, b.door);
        u.order = { k: 'idle' };
        return;
      }
      case 'extort': case 'takeover': {
        const defenders = this.defenders(b);
        if (defenders.length) { u.task = null; return; } // fight continues via combat
        const rate = act === 'extort' ? 3 + u.stats.charm * 2.3 : (2.5 + u.stats.muscle * 1.7) * (b.type === 'hq' ? 0.3 : 1);
        b.prog[u.fam] = (b.prog[u.fam] ?? 0) + rate * DT * (f.human ? 1 : 0.7);
        u.task = { k: act, t: b.prog[u.fam], total: 100, b: b.id };
        this.s.flags['work:' + b.id + ':' + u.fam] = s.time;
        if (b.owner) {
          const of = s.families[b.owner];
          if (of && of.human && s.tick % 30 === 0) this.toast(b.owner, `${b.name} is under attack!`, b.door, true);
          if (of && of.human) s.interrupt = s.time;
        }
        if (b.prog[u.fam] >= 100) {
          const workers = s.units.filter((x) => x.fam === u.fam && x.loc === 'street' && x.order.k === 'goto' && x.order.b === b.id && dist(x, b.door) < 1.2);
          for (const w of workers) w.heat = Math.min(MAX_HEAT, w.heat + (act === 'extort' ? 3 : 12) * this.heatMult(w));
          this.capture(b, u.fam, workers);
        }
        return;
      }
      case 'crack': case 'torch': case 'spring': {
        const total = act === 'crack' ? (b.type === 'bank' ? 30 : 18) / (1 + u.stats.stealth * 0.08) * (this.night() ? 1 : 1.6) : act === 'torch' ? 4 : 6;
        if (!u.task || u.task.k !== act) u.task = { k: act, t: 0, total, b: b.id };
        u.task.t += DT;
        if (act === 'crack' && b.type === 'bank' && b.alarm <= 0 && s.tick % 10 === 0 && this.rng.chance(0.022 * Math.max(0.2, 1 - u.stats.stealth * 0.08))) {
          b.alarm = 50;
          this.ev({ k: 'siren', x: b.door.x, y: b.door.y } as GameEvent);
          for (const x of s.units) if (x.fam === u.fam && this.active(x) && dist(this.pos(x), b.door) < 5) x.heat = Math.max(x.heat, 80);
          this.toast(u.fam, 'The bank alarm is ringing! Police on the way.', b.door, true);
          this.news(`Alarm bells at ${b.name}!`, true);
        }
        if (u.task.t >= u.task.total) {
          u.task = null;
          u.order = { k: 'idle' };
          if (act === 'crack') {
            const amount = Math.round(b.safe);
            f.money += amount;
            if (b.type === 'bank') { f.robbed += amount; this.news(`VAULT EMPTIED AT ${b.name.toUpperCase()}: $${amount.toLocaleString('en-US')} GONE`, true); }
            else { b.cracked = true; this.s.flags['cracked:' + b.tag] = 1; this.news(`Safe at ${b.name} found open and empty`, false); }
            b.safe = 0;
            u.heat = Math.min(MAX_HEAT, u.heat + (b.type === 'bank' ? 35 : 10) * this.heatMult(u));
            grantXp(u, 60);
            this.ev({ k: 'cash', x: b.door.x, y: b.door.y, amount, fam: u.fam } as GameEvent);
            this.toast(u.fam, `${u.name} cracked the safe: +$${amount}`, b.door);
          } else if (act === 'torch') {
            b.fire = 25;
            this.ev({ k: 'fire', b: b.id } as GameEvent);
            u.heat = Math.min(MAX_HEAT, u.heat + 30 * this.heatMult(u));
            grantXp(u, 40);
            this.news(`FIRE ON ${b.street.toUpperCase()}: ${b.name} goes up in flames`, true);
            if (b.owner && s.families[b.owner]?.human) this.toast(b.owner, `${b.name} is on fire!`, b.door, true);
          } else {
            const j = s.units.filter((x) => x.fam === u.fam && x.loc === 'jail').sort((a, c) => c.bail - a.bail)[0];
            if (j) {
              const cost = Math.round(j.bail * 0.25);
              if (f.money >= cost) { f.money -= cost; this.release(j); this.toast(u.fam, `${u.name} talked ${j.name} out of jail ($${cost}).`, b.door); grantXp(u, 30); }
              else this.toast(u.fam, `Need $${cost} for the "paperwork".`, b.door);
            }
          }
        }
        return;
      }
      case 'cards': {
        if (u.loc === 'street') { this.enterBuilding(u, b); u.task = { k: 'cards', t: 0, total: HOUR, b: b.id }; }
        return;
      }
    }
  }

  defenders(b: Building): Unit[] {
    if (!b.owner) return [];
    return this.s.units.filter((x) => x.fam === b.owner && ((x.loc === 'inside' && x.bld === b.id && !x.task) || (x.loc === 'street' && dist(x, b.door) < 1.6)));
  }

  capture(b: Building, fam: FamId, workers: Unit[]) {
    const s = this.s;
    const prev = b.owner;
    b.owner = fam;
    b.prog = {};
    b.manager = null;
    b.shut = 0;
    for (const x of s.units) if (x.loc === 'inside' && x.bld === b.id && x.fam !== fam && !x.task) this.exitBuilding(x);
    for (const w of workers) { grantXp(w, 15); w.order = { k: 'idle' }; w.task = null; }
    this.ev({ k: 'capture', b: b.id, fam, prev } as GameEvent);
    const f = s.families[fam];
    if (prev) {
      const pf = s.families[prev];
      this.news(`${f.short} crew muscles the ${pf ? pf.short : 'old owner'}s out of ${b.name} on ${b.street}`, false, fam);
      if (pf && pf.human) this.toast(prev, `You lost ${b.name}!`, b.door, true);
      if (pf && pf.hq === b.id) this.eliminate(prev, fam);
    } else if (workers.length) {
      this.news(`${b.name} on ${b.street} now "pays its respects" to the ${f.short}s`, false, fam);
    }
    if (f.human) this.toast(fam, `${b.name} is ours!`, b.door);
  }

  eliminate(fid: FamId, by: FamId | null) {
    const s = this.s;
    const f = s.families[fid];
    if (!f || f.eliminated) return;
    f.eliminated = true;
    for (const u of s.units) if (u.fam === fid && u.loc !== 'dead' && u.loc !== 'held' && u.loc !== 'jail') {
      if (u.boss && u.tag && u.loc !== 'inside') continue; // named bosses keep fighting
      this.removeUnit(u);
    }
    for (const b of s.buildings) if (b.owner === fid && b.id !== f.hq) { b.owner = null; b.racket = null; b.manager = null; }
    for (const v of s.vehicles) if (v.fam === fid && !v.seats.length) v.fam = '';
    this.news(`${f.name.toUpperCase()} FINISHED${by && s.families[by] ? ' — ' + s.families[by].short.toUpperCase() + 'S RULE THE BLOCK' : ''}`, true);
    if (f.human && s.mode === 'campaign') this.lose(`The ${by && s.families[by] ? s.families[by].name : 'rivals'} took your headquarters. The family is scattered to the wind.`);
  }

  removeUnit(u: Unit) {
    if (u.loc === 'car') this.unboard(u);
    u.loc = 'dead';
    u.lastHurt = this.s.time;
    u.path = [];
    if (u.rosterId) this.fired.push(u.rosterId);
    u.rosterId = '';
  }

  release(u: Unit) {
    const hq = this.hqOf(u.fam);
    u.loc = 'street';
    u.bail = 0;
    const p = this.pf.nearestWalkable(this.jitter(hq ? hq.door : this.edgePoint('S')));
    u.x = p.x; u.y = p.y;
    u.order = { k: 'idle' };
    u.heat = Math.min(u.heat, 10);
    if (u.tag) this.s.flags['freed:' + u.tag] = 1;
    this.news(`${u.name} walks out of the precinct, lawyer in tow`, false, u.fam);
  }

  tickBuilding(b: Building) {
    const s = this.s;
    if (b.alarm > 0) b.alarm -= DT;
    if (b.fire > 0) {
      b.fire -= DT;
      if (s.tick % 10 === 0) for (const u of s.units) if (u.loc === 'inside' && u.bld === b.id) { this.exitBuilding(u); this.hurt(u, 25, null); }
      if (b.fire <= 0) {
        b.burned = true; b.owner = null; b.racket = null; b.manager = null; b.stock = 0; b.prog = {};
        s.flags['burned:' + b.tag] = 1;
      }
    }
    // decay progress nobody is working on
    for (const fid of Object.keys(b.prog)) {
      const last = s.flags['work:' + b.id + ':' + fid] ?? -99;
      if (s.time - last > 1.5) { b.prog[fid] -= 4 * DT; if (b.prog[fid] <= 0) delete b.prog[fid]; }
    }
  }

  // ---------- vehicles ----------
  tickVehicle(v: Vehicle) {
    const s = this.s;
    const def = VEHICLES[v.model];
    const driver = v.seats.length > 0;
    if (v.route && driver && !v.path.length) {
      const r = v.route;
      const target = s.buildings[r.stage === 0 ? r.from : r.to];
      if (!target) { v.route = null; }
      else if (dist(v, target.door) > 1.2) v.path = this.pf.find(v, target.door);
      else {
        r.wait -= DT;
        if (r.wait <= 0) {
          this.cargoOp(v, target, r.stage === 0 ? 'load' : 'unload', !s.flags['oneshot:' + v.id]);
          r.stage = 1 - r.stage;
          r.wait = 2;
          if (s.flags['oneshot:' + v.id]) { v.route = null; delete s.flags['oneshot:' + v.id]; }
        }
      }
    }
    if (driver && v.path.length) {
      const hurt = v.hp < v.maxHp * 0.3 ? 0.7 : 1;
      this.step(v, def.speed * hurt * (v.cargo > def.cargo / 2 ? 0.9 : 1));
      const dx = v.path.length ? v.path[0].x - v.x : 0, dy = v.path.length ? v.path[0].y - v.y : 0;
      if (Math.abs(dx) + Math.abs(dy) > 0.01) v.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
      for (const id of v.seats) { const u = this.anyUnit(id); if (u) { u.x = v.x; u.y = v.y; } }
      if (!v.path.length) this.arrived(v);
    }
  }
  arrived(v: Vehicle) {
    // drop hostages at own buildings
    const s = this.s;
    if (s.flags['autoexit:' + v.id]) {
      delete s.flags['autoexit:' + v.id];
      for (const id of [...v.seats]) { const u = this.anyUnit(id); if (u && u.fam === v.fam) this.unboard(u); }
      return;
    }
    const own = s.buildings.find((b) => b.owner === v.fam && dist(b.door, v) < 2.2);
    if (!own) return;
    for (const id of [...v.seats]) {
      const u = this.anyUnit(id);
      if (u && u.heldBy === v.fam && u.fam !== v.fam) {
        v.seats = v.seats.filter((x) => x !== id);
        const hq = this.hqOf(v.fam) ?? own;
        u.loc = 'held'; u.bld = hq.id; u.car = -1;
        if (u.tag) s.flags['held:' + u.tag] = 1;
        this.toast(v.fam, `${u.name} is locked in the cellar at ${hq.name}. Open the building to deal with the hostage.`, hq.door);
      }
    }
  }
  cargoOp(v: Vehicle, b: Building, op: 'load' | 'unload', quiet = false) {
    const f = this.s.families[v.fam];
    const cap = VEHICLES[v.model].cargo;
    if (op === 'load') {
      const space = cap - v.cargo;
      if (space <= 0) { if (!quiet) this.toast(v.fam, `${v.name} is full.`, v); return; }
      if (b.owner === v.fam && b.racket === 'still') {
        const n = Math.min(space, b.stock);
        b.stock -= n; v.cargo += n;
        if (!quiet || n) this.toast(v.fam, `Loaded ${n} crates at ${b.name}.`, b.door);
      } else if (b.type === 'pier' && (!b.owner || b.owner === v.fam)) {
        if (!this.night()) { if (!quiet) this.toast(v.fam, 'The smugglers only deal after dark.', b.door); return; }
        const price = b.owner === v.fam ? 8 : 15;
        const n = Math.min(space, Math.floor(f.money / price));
        f.money -= n * price; v.cargo += n;
        this.toast(v.fam, `Bought ${n} crates for $${n * price}.`, b.door);
      } else if (!quiet) this.toast(v.fam, 'No liquor to load here. Try your distillery or the smugglers\' pier.', b.door);
    } else {
      if (b.owner !== v.fam || b.racket !== 'speakeasy') { if (!quiet) this.toast(v.fam, 'Crates go to one of your speakeasies.', b.door); return; }
      const n = v.cargo;
      b.stock += n; v.cargo = 0; f.delivered += n;
      if (n) this.toast(v.fam, `Delivered ${n} crates to ${b.name}.`, b.door);
    }
  }
  wreck(v: Vehicle) {
    v.dead = true;
    v.hp = this.s.time;
    this.ev({ k: 'death', x: v.x, y: v.y, fam: v.fam, name: v.name } as GameEvent);
    for (const id of [...v.seats]) {
      const u = this.anyUnit(id);
      if (!u) continue;
      v.seats = v.seats.filter((x) => x !== id);
      u.loc = 'street'; u.car = -1;
      if (u.heldBy && u.heldBy !== u.fam) u.heldBy = '';
      const p = this.pf.nearestWalkable(this.jitter(v, 0.8)); u.x = p.x; u.y = p.y;
      this.hurt(u, 20, null);
    }
    v.seats = [];
  }

  // ---------- kidnapping ----------
  tryGrab(u: Unit, t: Unit) {
    const s = this.s;
    const alone = !s.units.some((x) => x.fam === t.fam && x.id !== t.id && x.loc === 'street' && dist(x, t) < 3);
    const weak = t.hp < t.maxHp * (t.boss ? 0.25 : 0.45);
    if (!alone && !weak) return;
    const car = s.vehicles.find((v) => !v.dead && v.fam === u.fam && dist(v, t) < 5 && v.seats.length < VEHICLES[v.model].seats);
    if (!car) {
      if (s.tick % 20 === 0) this.toast(u.fam, 'Need one of our cars parked close by (with a free seat) to grab him.', t);
      return;
    }
    u.grab += DT;
    if (u.grab < 1.5) return;
    t.loc = 'car'; t.car = car.id; t.heldBy = u.fam; t.path = []; t.order = { k: 'idle' }; t.behavior = null; t.target = -1;
    car.seats.push(t.id);
    u.order = { k: 'idle' };
    grantXp(u, 40);
    u.heat = Math.min(MAX_HEAT, u.heat + 15 * this.heatMult(u));
    this.toast(u.fam, `${t.name} is in the car. Drive him to one of our buildings.`, car);
    this.news(`Witnesses report a man "bundled into a sedan" on ${this.nearestStreet(t)}`);
  }
  nearestStreet(p: Pt): string {
    const ry = Math.round((p.y - 1) / PERIOD), rx = Math.round((p.x - 1) / PERIOD);
    const dy = Math.abs(p.y - (ry * PERIOD + 1)), dx = Math.abs(p.x - (rx * PERIOD + 1));
    return dy < dx ? this.map.streetsH[Math.min(ry, this.map.streetsH.length - 1)] : this.map.streetsV[Math.min(rx, this.map.streetsV.length - 1)];
  }

  // ---------- combat ----------
  heatMult(u: Unit): number {
    return Math.max(0.3, 1 - u.stats.stealth * 0.06) * (this.night() ? 0.65 : 1);
  }
  /** How close an enemy must be to notice this unit. */
  detectRange(u: Unit): number {
    const base = this.night() ? NIGHT_SIGHT : SIGHT;
    if (this.s.time - u.lastShot < 3) return base + 2;
    let r = base;
    if (u.stance === 'passive' || u.spec === 'hitman') r = Math.max(1.6, base - u.stats.stealth * 0.6);
    if (u.loc === 'car') r = base;
    return r;
  }
  hostile(a: Unit, b: Unit): boolean {
    if (a.fam === b.fam) return false;
    if (b.loc === 'held' || b.loc === 'jail' || a.loc === 'held') return false;
    if (b.heldBy && b.heldBy === a.fam) return false;
    // cops arrest people; they only open fire on those who shoot at police or are armed, wanted and looking for trouble
    if (a.cop) return this.s.time - (this.s.flags['copshotu:' + b.id] ?? -99) < 20 || (b.heat >= HEAT_WANTED + 35 && b.stance === 'aggressive');
    if (b.cop) return a.lastAttacker >= 0 && this.unit(a.lastAttacker)?.cop === true && this.s.time - a.lastHurt < 6;
    return true;
  }
  combat() {
    const s = this.s;
    const fighters = s.units.filter((u) => (u.loc === 'street' || u.loc === 'car' || (u.loc === 'inside' && !u.task)) && !(u.heldBy && u.heldBy !== u.fam));
    for (const u of fighters) {
      if (u.reload > 0) { u.reload -= DT; if (u.reload <= 0) u.mag = WEAPONS[u.weapon].mag; }
      u.cd = Math.max(-DT, u.cd - DT);
    }
    for (const u of fighters) {
      const w = WEAPONS[u.weapon];
      const up = this.pos(u);
      const range = w.range + (u.loc === 'inside' ? 0.6 : 0);
      u.target = -1;
      if (u.loc === 'car') {
        const v = this.vehicle(u.car);
        if (!v || !v.driveBy) continue;
      }
      if (u.stance === 'passive' && u.order.k !== 'attack' && u.order.k !== 'kidnap') continue;
      // choose target
      let best: Unit | null = null, bestScore = 1e9;
      const ordered = u.order.k === 'attack' || u.order.k === 'kidnap' ? this.unit(u.order.id) : undefined;
      if (ordered && this.active(ordered) && (!u.cop || this.hostile(u, ordered)) && !(u.order.k === 'kidnap' && ordered.hp < ordered.maxHp * (ordered.boss ? 0.25 : 0.45))) {
        const tp = this.pos(ordered);
        if (dist(up, tp) <= range && this.pf.sight(up, tp) && (ordered.loc !== 'inside' || this.isDefender(ordered))) best = ordered;
      }
      if (!best && !(u.order.k === 'kidnap')) {
        const ai = !s.families[u.fam]?.human;
        for (const t of fighters) {
          if (!this.hostile(u, t)) continue;
          if (t.loc === 'inside' && !this.isDefender(t)) continue;
          const tp = this.pos(t);
          const d = dist(up, tp);
          if (d > range) continue;
          if (d > this.detectRange(t) && s.time - t.lastShot > 3) continue;
          if (u.stance === 'defensive' && !this.engaged(t, u)) continue;
          if (!this.pf.sight(up, tp)) continue;
          const score = ai ? t.hp + d * 4 : d * 10 + t.hp * 0.05;
          if (score < bestScore) { bestScore = score; best = t; }
        }
      }
      if (!best) continue;
      u.target = best.id;
      if (s.families[u.fam]?.human || s.families[best.fam]?.human) s.interrupt = s.time;
      while (u.cd <= 0 && u.mag > 0 && u.reload <= 0 && best.loc !== 'dead') {
        this.fire(u, best, up);
      }
      if (u.mag <= 0 && u.reload <= 0) u.reload = w.reload;
    }
    // aggressive auto-chase
    for (const u of fighters) {
      if (u.loc !== 'street' || u.target >= 0 || u.stance !== 'aggressive' || u.order.k !== 'idle' || u.cop) continue;
      if ((s.tick + u.id) % 8 !== 0) continue;
      const sight = this.night() ? NIGHT_SIGHT : SIGHT;
      let best: Unit | null = null, bd = sight;
      const aiFam = !s.families[u.fam]?.human;
      for (const t of fighters) {
        if (!this.hostile(u, t) || t.cop || (t.loc === 'inside' && !this.isDefender(t))) continue;
        // AI men do not wander off hunting: only chase intruders near their own turf, or people shooting at them
        if (aiFam && !u.behavior && !this.engaged(t, u) && !s.buildings.some((b) => b.owner === u.fam && dist(b.door, this.pos(t)) < 5)) continue;
        const d = dist(u, this.pos(t));
        if (d < bd && d < this.detectRange(t)) { bd = d; best = t; }
      }
      if (best) { const tp = this.pos(best); u.path = this.pf.find(u, tp).slice(0, 3); }
    }
  }
  isDefender(t: Unit): boolean {
    if (t.loc !== 'inside') return true;
    const b = this.s.buildings[t.bld];
    return !!b && b.owner === t.fam;
  }
  /** Does `t` pose an active threat to `u`'s family (used for the Defensive stance)? */
  engaged(t: Unit, u: Unit): boolean {
    const s = this.s;
    if (s.time - t.lastShot < 4) return true;
    if (u.lastAttacker === t.id && s.time - u.lastHurt < 8) return true;
    if (t.order.k === 'goto' && (t.order.act === 'takeover' || t.order.act === 'extort' || t.order.act === 'torch')) {
      const b = s.buildings[t.order.b];
      if (b && b.owner === u.fam) return true;
    }
    if (t.order.k === 'attack' || t.order.k === 'kidnap') { const v = this.unit(t.order.id); if (v && v.fam === u.fam) return true; }
    return false;
  }
  fire(u: Unit, t: Unit, up: Pt) {
    const s = this.s;
    const w = WEAPONS[u.weapon];
    const tp = this.pos(t);
    const d = dist(up, tp);
    u.cd += w.cd * this.rng.range(0.9, 1.2);
    u.mag--;
    u.lastShot = s.time;
    u.face = tp.x - tp.y >= up.x - up.y ? 1 : -1;
    let chance = w.acc * (0.55 + u.stats.aim * 0.07) * (1 - 0.35 * (d / Math.max(1, w.range)));
    const cover = t.loc === 'inside' ? 0.6 : t.loc === 'car' ? 0.2 : t.loc === 'street' && !t.moving ? this.pf.cover(t) : 0;
    chance *= 1 - cover;
    if (u.moving) chance *= 0.75;
    if (u.loc === 'car') { const v = this.vehicle(u.car); if (v && v.path.length) chance *= 0.65; }
    if (this.night()) chance *= 0.9;
    const unaware = s.time - t.lastHurt > 6 && d > this.detectRange(u) * 0.5 && t.target !== u.id;
    if (u.spec === 'hitman' && unaware) chance = Math.max(chance, 0.9);
    const hit = this.rng.chance(Math.min(0.97, chance));
    if (u.weapon !== 'tommy' || s.tick % 2 === 0 || hit) this.ev({ k: 'shot', x: up.x, y: up.y, tx: tp.x, ty: tp.y, w: u.weapon, hit, fam: u.fam } as GameEvent);
    if (!u.cop) {
      u.heat = Math.min(MAX_HEAT, u.heat + Math.max(0.25, w.noise * 2.2 * w.cd) * this.heatMult(u));
      if (t.cop) { u.heat = Math.min(MAX_HEAT, u.heat + 3); s.flags['copshot:' + u.fam] = s.time; s.flags['copshotu:' + u.id] = s.time; }
    }
    if (!hit) return;
    let dmg = w.dmg * (w.falloff ? 1 - 0.6 * (d / w.range) : 1) * this.rng.range(0.8, 1.2);
    if (u.boss) dmg *= 1.15;
    if (unaware && u.spec === 'hitman') dmg *= 3;
    else if (unaware && u.stats.stealth >= 6) dmg *= 1.3;
    if (t.loc === 'car') {
      const v = this.vehicle(t.car);
      if (v && this.rng.chance(0.6)) {
        v.hp -= dmg;
        if (v.hp <= 0) this.wreck(v);
        return;
      }
    }
    this.hurt(t, dmg, u);
  }
  hurt(t: Unit, dmg: number, by: Unit | null) {
    const s = this.s;
    t.hp -= dmg;
    t.lastHurt = s.time;
    if (by) t.lastAttacker = by.id;
    if (t.hp <= 0) { this.kill(t, by); return; }
    // retreat at low health
    if (t.retreat && t.loc === 'street' && t.hp < t.maxHp * 0.3 && t.order.k !== 'retreat' && !t.cop) {
      const own = s.buildings.filter((b) => b.owner === t.fam && !b.burned && this.defenders(b).length < 6)
        .sort((a, b) => dist(a.door, t) - dist(b.door, t))[0];
      if (own && dist(own.door, t) < 25) {
        this.order(t, { k: 'retreat', b: own.id });
        if (s.families[t.fam]?.human) this.toast(t.fam, `${t.name} is badly hurt and falls back to ${own.name}.`, t);
      }
    }
  }
  kill(t: Unit, by: Unit | null) {
    const s = this.s;
    if (t.loc === 'car') this.unboard(t);
    t.loc = 'dead';
    t.hp = 0;
    t.path = [];
    this.ev({ k: 'death', x: t.x, y: t.y, fam: t.fam, name: t.name } as GameEvent);
    if (t.tag) s.flags['killed:' + t.tag] = 1;
    if (by) {
      by.kills++;
      const lv = grantXp(by, t.boss ? 120 : t.cop ? 10 : 25);
      if (lv) this.ev({ k: 'levelup', unit: by.id, fam: by.fam } as GameEvent);
      if (!by.cop) by.heat = Math.min(MAX_HEAT, by.heat + (t.cop ? 45 : 14) * this.heatMult(by));
      if (t.cop && !by.cop) {
        for (const x of s.units) if (x.fam === by.fam && !x.cop) x.heat = Math.min(MAX_HEAT, x.heat + 10);
        this.news(`POLICE OFFICER GUNNED DOWN ON ${this.nearestStreet(t).toUpperCase()}`, true);
      }
    }
    const fam = s.families[t.fam];
    if (t.cop) return;
    if (t.boss && t.tag) this.news(`${t.name.toUpperCase()} FOUND DEAD ON ${this.nearestStreet(t).toUpperCase()}`, true);
    else if (fam?.human) {
      this.news(`${t.name} of the ${fam.short} crew killed in a shootout on ${this.nearestStreet(t)}`, true, t.fam);
      this.toast(t.fam, `${t.name} is dead.`, t, true);
    } else if (by && this.rng.chance(0.4)) this.news(`${fam ? fam.short : 'Rival'} gunman dropped on ${this.nearestStreet(t)}`);
    if (t.hero) {
      if (s.mode === 'campaign') this.lose(`${t.name} bled out on the cobblestones of ${this.nearestStreet(t)}. The Corrado name dies with him.`);
      else this.eliminate(t.fam, by ? by.fam : null);
    }
  }

  // ---------- police ----------
  police() {
    const s = this.s;
    const precinct = s.buildings.find((b) => b.type === 'precinct');
    if (!precinct) return;
    const cops = s.units.filter((u) => u.cop && u.loc === 'street');
    const wanted = s.units.filter((u) => !u.cop && (u.loc === 'street' || u.loc === 'car') && u.heat >= HEAT_WANTED && (s.families[u.fam]?.payroll.precinct ?? 0) <= 0 && !(u.heldBy && u.heldBy !== u.fam));
    const alarms = s.buildings.filter((b) => b.alarm > 0);
    const maxHeat = wanted.reduce((a, u) => Math.max(a, u.heat), 0);
    const want = Math.min(7, (wanted.length ? 1 + Math.floor((maxHeat - HEAT_WANTED) / 12) : 0) + alarms.length * 3);
    s.copTimer -= DT;
    if (cops.length < want && s.copTimer <= 0) {
      s.copTimer = 3;
      const c = this.addUnit({ fam: POLICE, name: `Officer ${this.rng.pick(LAST)}`, role: 'Patrolman', cop: true, stats: { muscle: 3, aim: 4, charm: 2, stealth: 1 }, weapon: this.rng.chance(0.2) ? 'shotgun' : 'revolver', stance: 'aggressive' }, this.jitter(precinct.door));
      c.retreat = false;
      if (!s.flags.crackdown) {
        s.flags.crackdown = 1;
        this.news('Police announce crackdown on "street violence"', true);
        this.ev({ k: 'siren', x: precinct.door.x, y: precinct.door.y } as GameEvent);
      }
    }
    if (!wanted.length && !alarms.length) s.flags.crackdown = 0;
    for (const c of cops) {
      let tgt = c.order.k === 'attack' ? this.unit(c.order.id) : undefined;
      if (tgt && (!(tgt.loc === 'street' || tgt.loc === 'car') || (tgt.heat < HEAT_WANTED && !alarms.length) || (s.families[tgt.fam]?.payroll.precinct ?? 0) > 0)) tgt = undefined;
      if (!tgt && (wanted.length)) {
        tgt = wanted.slice().sort((a, b) => dist(a, c) - dist(b, c) - (b.heat - a.heat) * 0.1)[0];
        if (tgt) this.order(c, { k: 'attack', id: tgt.id });
      }
      if (!tgt && alarms.length) {
        const a = alarms[0];
        if (dist(c, a.door) > 1.5 && !c.path.length) c.path = this.pf.find(c, a.door);
        continue;
      }
      if (!tgt) {
        if (c.order.k !== 'move') this.order(c, { k: 'move', x: precinct.door.x, y: precinct.door.y });
        if (dist(c, precinct.door) < 0.7) this.removeUnit(c);
        continue;
      }
      const d = dist(c, this.pos(tgt));
      if (d < 0.9 && tgt.loc === 'street') {
        c.grab += DT;
        if (c.grab > 1.3 - tgt.stats.stealth * 0.05) { this.arrest(tgt); c.grab = 0; this.order(c, { k: 'idle' }); }
      } else c.grab = Math.max(0, c.grab - DT);
    }
  }
  arrest(u: Unit) {
    const s = this.s;
    const f = s.families[u.fam];
    u.loc = 'jail';
    u.path = [];
    u.order = { k: 'idle' };
    u.task = null;
    u.target = -1;
    u.bail = Math.round(100 + u.heat * 4 + u.level * 25);
    u.heat = 15;
    if (f && f.payroll.judge > 0) { this.release(u); return; }
    this.ev({ k: 'arrest', x: u.x, y: u.y, fam: u.fam, name: u.name } as GameEvent);
    this.news(`Police nab ${u.name}; bail set at $${u.bail}`, u.hero, u.fam);
    if (f?.human) this.toast(u.fam, `${u.name} was arrested! Bail: $${u.bail}`, u, true);
  }

  // ---------- upkeep: heat decay, healing ----------
  upkeep() {
    const s = this.s;
    for (const u of s.units) {
      if (u.loc === 'dead' || u.cop) continue;
      if (u.loc === 'inside') {
        u.heat = Math.max(0, u.heat - 0.9 * DT);
        if (s.time - u.lastHurt > 3) u.hp = Math.min(u.maxHp, u.hp + 2.2 * DT);
        if (u.task && u.task.k === 'cards') this.playCards(u);
      } else if (u.loc === 'held') {
        u.hp = Math.min(u.maxHp, u.hp + 0.5 * DT);
      } else if (u.loc === 'street' || u.loc === 'car') {
        u.heat = Math.max(0, u.heat - 0.28 * DT);
        if (s.time - u.lastHurt > 10) u.hp = Math.min(u.maxHp, u.hp + 0.15 * DT);
      } else if (u.loc === 'jail') {
        const f = s.families[u.fam];
        if (f && !f.human && !u.hero && s.tick % 600 === 0 && f.money > u.bail) { f.money -= u.bail; this.release(u); }
      }
    }
  }
  playCards(u: Unit) {
    const s = this.s;
    const task = u.task!;
    task.t += DT;
    if (task.t < HOUR) return;
    task.t = 0;
    const b = s.buildings[u.bld];
    const f = s.families[u.fam];
    let win = (20 + u.stats.charm * 12 + u.level * 5) * this.rng.range(0.3, 1.5) * (this.night() ? 1.5 : 1);
    if (this.rng.chance(0.15)) win = -30;
    win = Math.round(win);
    f.money += win;
    if (b && b.owner && b.owner !== u.fam && s.families[b.owner]) s.families[b.owner].money -= Math.max(0, win);
    this.ev({ k: 'cash', x: b ? b.door.x : u.x, y: b ? b.door.y : u.y, amount: win, fam: u.fam } as GameEvent);
    f.reveal = Math.max(f.reveal, s.time + HOUR * 3);
    if (this.rng.chance(0.25)) {
      const rumours = ['The whole table is talking: rival crews are on the move. Their positions show on your map for a few hours.', 'A drunk dealer brags about his boss\'s rounds. Rival positions revealed.'];
      this.toast(u.fam, this.rng.pick(rumours), b ? b.door : u);
    }
  }

  // ---------- visibility (fog of war) ----------
  visibility(fam: FamId): Uint8Array {
    const { w, h } = this.map;
    const vis = new Uint8Array(w * h);
    const f = this.s.families[fam];
    if (!this.s.fog || (f && f.reveal > this.s.time)) { vis.fill(1); return vis; }
    const mark = (p: Pt, r: number) => {
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(p.x - r)), x1 = Math.min(w - 1, Math.ceil(p.x + r));
      const y0 = Math.max(0, Math.floor(p.y - r)), y1 = Math.min(h - 1, Math.ceil(p.y + r));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - p.x, dy = y + 0.5 - p.y;
        if (dx * dx + dy * dy <= r2) vis[y * w + x] = 1;
      }
    };
    const sight = this.night() ? NIGHT_SIGHT : SIGHT;
    for (const u of this.s.units) if (u.fam === fam && (u.loc === 'street' || u.loc === 'car' || u.loc === 'inside')) mark(this.pos(u), u.loc === 'inside' ? BUILDING_SIGHT : sight);
    for (const b of this.s.buildings) if (b.owner === fam) mark(b.door, BUILDING_SIGHT);
    return vis;
  }
  visibleTo(fam: FamId, vis: Uint8Array, p: Pt): boolean {
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return false;
    return vis[ty * this.map.w + tx] === 1;
  }

  // ---------- results ----------
  lose(text: string) { if (!this.s.result) this.s.result = { winner: null, text }; }
  win(fam: FamId, text: string) { if (!this.s.result) this.s.result = { winner: fam, text }; }

  // ---------- commands ----------
  /** Apply a player command. Returns an error message, or null on success. */
  command(fam: FamId, cmd: Command): string | null {
    const s = this.s;
    const f = s.families[fam];
    if (!f || f.eliminated || s.result) return 'Not possible now.';
    const mine = (ids: number[]) => ids.map((id) => this.unit(id)).filter((u): u is Unit => !!u && u.fam === fam && (u.loc === 'street' || u.loc === 'inside' || u.loc === 'car'));
    switch (cmd.c) {
      case 'move': {
        const us = mine(cmd.units);
        us.forEach((u, i) => {
          if (u.loc === 'car') this.unboard(u);
          const off = us.length > 1 ? { x: ((i % 3) - 1) * 0.45, y: (Math.floor(i / 3) - 0.5) * 0.45 } : { x: 0, y: 0 };
          this.order(u, { k: 'move', x: cmd.x + off.x, y: cmd.y + off.y });
        });
        return us.length ? null : 'Nobody selected.';
      }
      case 'attack': case 'kidnap': {
        const t = this.unit(cmd.target);
        if (!t || t.fam === fam) return 'No target.';
        if (cmd.c === 'kidnap' && (t.cop)) return 'Kidnapping a cop is a very bad idea.';
        for (const u of mine(cmd.units)) { if (u.loc === 'car' && cmd.c === 'kidnap') this.unboard(u); if (u.loc !== 'car') this.order(u, { k: cmd.c, id: t.id }); else u.order = { k: 'attack', id: t.id }; }
        return null;
      }
      case 'act': {
        const b = s.buildings[cmd.b];
        if (!b) return 'No building.';
        const us = mine(cmd.units);
        if (!us.length) return 'Nobody selected.';
        const errs = us.map((u) => this.canAct(u, b, cmd.act, cmd.arg));
        if (errs.every((e) => e) && cmd.act !== 'takeover') return errs[0];
        const takers = cmd.act === 'bribe' || cmd.act === 'buy' || cmd.act === 'arm' || cmd.act === 'spring' || cmd.act === 'crack' || cmd.act === 'torch' || cmd.act === 'cards'
          ? [us.find((u, i) => !errs[i])!] : us;
        for (const u of us) {
          if (u.loc === 'car') this.unboard(u);
          if (takers.includes(u)) this.order(u, { k: 'goto', b: b.id, act: cmd.act, arg: cmd.arg });
          else if (cmd.act === 'extort' || cmd.act === 'takeover') this.order(u, { k: 'goto', b: b.id, act: cmd.act });
          else this.order(u, { k: 'move', x: b.door.x + this.rng.range(-0.8, 0.8), y: b.door.y + this.rng.range(-0.6, 0.6) });
        }
        if (cmd.act === 'takeover' || cmd.act === 'torch') for (const u of us) if (u.stance === 'passive') u.stance = 'defensive';
        return null;
      }
      case 'stance': for (const u of mine(cmd.units)) u.stance = cmd.stance; return null;
      case 'retreat': for (const u of mine(cmd.units)) u.retreat = cmd.on; return null;
      case 'board': {
        const v = this.vehicle(cmd.v);
        if (!v || v.fam !== fam) return 'Not our car.';
        for (const u of mine(cmd.units)) if (u.loc !== 'car') this.order(u, { k: 'board', v: v.id });
        return null;
      }
      case 'drive': {
        const v = this.vehicle(cmd.v);
        if (!v || v.fam !== fam) return 'Not our car.';
        if (!v.seats.length) return 'Nobody is in the car to drive it.';
        v.route = null;
        v.path = this.pf.find(v, { x: cmd.x, y: cmd.y });
        return null;
      }
      case 'exit': {
        const v = this.vehicle(cmd.v);
        if (!v || v.fam !== fam) return 'Not our car.';
        for (const id of [...v.seats]) { const u = this.anyUnit(id); if (u && u.fam === fam) this.unboard(u); }
        v.route = null;
        return null;
      }
      case 'cargo': {
        const v = this.vehicle(cmd.v), b = s.buildings[cmd.b];
        if (!v || v.fam !== fam || !b) return 'Not possible.';
        if (dist(v, b.door) > 1.6) {
          if (!v.seats.length) return 'Nobody is in the car to drive it.';
          v.path = this.pf.find(v, b.door);
          v.route = { from: b.id, to: b.id, stage: cmd.op === 'load' ? 0 : 1, wait: 0.5 };
          // one-shot trip: emulate with route then clear after op
          s.flags['oneshot:' + v.id] = 1;
          return null;
        }
        this.cargoOp(v, b, cmd.op);
        return null;
      }
      case 'route': {
        const v = this.vehicle(cmd.v), a = s.buildings[cmd.from], b = s.buildings[cmd.to];
        if (!v || v.fam !== fam || !a || !b) return 'Not possible.';
        if (!v.seats.length) return 'Put a driver in the car first.';
        v.route = { from: a.id, to: b.id, stage: 0, wait: 1 };
        v.path = [];
        delete s.flags['oneshot:' + v.id];
        return null;
      }
      case 'stopRoute': { const v = this.vehicle(cmd.v); if (v && v.fam === fam) v.route = null; return null; }
      case 'driveBy': { const v = this.vehicle(cmd.v); if (v && v.fam === fam) v.driveBy = cmd.on; return null; }
      case 'hire': {
        const ad = s.ads.find((a) => a.id === cmd.ad);
        if (!ad) return 'That ad is gone.';
        if (f.money < ad.fee) return 'Not enough cash.';
        const hq = this.hqOf(fam);
        if (!hq) return 'You have no headquarters.';
        f.money -= ad.fee;
        s.ads = s.ads.filter((a) => a !== ad);
        const u = this.addUnit({ fam, name: ad.name, role: ad.role, spec: ad.spec, stats: ad.stats, weapon: ad.weapon, wage: ad.wage, stance: 'defensive' }, this.jitter(hq.door));
        u.rosterId = 'new:' + u.id;
        this.news(`New face seen around the ${f.short} place: "${ad.name}"`, false, fam);
        this.toast(fam, `${ad.name} joins the family.`, hq.door);
        return null;
      }
      case 'fire': {
        const u = this.unit(cmd.unit);
        if (!u || u.fam !== fam || u.hero) return 'Cannot fire that one.';
        this.removeUnit(u);
        return null;
      }
      case 'bail': {
        const u = this.unit(cmd.unit);
        if (!u || u.fam !== fam || u.loc !== 'jail') return 'Not in jail.';
        const hasFixer = s.units.some((x) => x.fam === fam && x.spec === 'fixer' && this.active(x));
        const cost = Math.round(u.bail * (hasFixer ? 0.5 : 1));
        if (f.money < cost) return 'Not enough cash for bail.';
        f.money -= cost;
        this.release(u);
        return null;
      }
      case 'manager': {
        const b = s.buildings[cmd.b];
        if (!b || b.owner !== fam) return 'Not your building.';
        const m = b.candidates[cmd.idx];
        if (!m) return 'Candidate gone.';
        const cost = Math.round(m.fee * (s.units.some((x) => x.fam === fam && x.spec === 'fixer' && this.active(x)) ? 0.6 : 1));
        if (f.money < cost) return 'Not enough cash.';
        f.money -= cost;
        b.manager = m;
        b.candidates = b.candidates.filter((c) => c !== m);
        this.toast(fam, `${m.name} now runs ${b.name}.`, b.door);
        return null;
      }
      case 'fireManager': { const b = s.buildings[cmd.b]; if (b && b.owner === fam) b.manager = null; return null; }
      case 'hireGuard': {
        const b = s.buildings[cmd.b];
        if (!b || b.owner !== fam) return 'Not your building.';
        if (f.money < 90) return 'A guard costs $90 up front.';
        if (this.s.units.filter((u) => u.guard && u.bld === b.id && u.loc === 'inside').length >= 3) return 'Three guards is the most this place can hold.';
        f.money -= 90;
        const g = this.addUnit({ ...soldierInit(this.rng, fam, 2, 3, this.rng.chance(0.5) ? 'shotgun' : 'revolver'), role: 'Hired Guard', guard: true, wage: 12, stance: 'defensive' }, b.door);
        g.name = `${this.rng.pick(FIRST)} ${this.rng.pick(LAST)}`;
        g.retreat = false;
        this.enterBuilding(g, b);
        g.behavior = { k: 'garrison', tag: '#' + b.id };
        return null;
      }
      case 'racket': {
        const b = s.buildings[cmd.b];
        if (!b || b.owner !== fam) return 'Not your building.';
        if (!BTYPES[b.type].front) return 'This place cannot hide a racket.';
        if (b.racket) return 'Already running a racket here.';
        if (!b.manager) return 'Hire a manager first: someone has to run it.';
        const r = RACKETS[cmd.kind];
        if (f.money < r.setup) return `Setting up costs $${r.setup}.`;
        f.money -= r.setup;
        b.racket = cmd.kind;
        b.stock = cmd.kind === 'speakeasy' ? 1 : 0;
        this.toast(fam, `${r.name} opened behind ${b.name}. Pays at night.`, b.door);
        return null;
      }
      case 'closeRacket': { const b = s.buildings[cmd.b]; if (b && b.owner === fam) b.racket = null; return null; }
      case 'buyCar': {
        const b = s.buildings[cmd.b];
        if (!b || b.type !== 'garage' || (b.owner && b.owner !== fam)) return 'Cars are sold at garages that are not in rival hands.';
        const def = VEHICLES[cmd.model];
        const price = Math.round(def.price * (b.owner === fam ? 0.75 : 1));
        if (f.money < price) return 'Not enough cash.';
        f.money -= price;
        const v = this.addVehicle(fam, cmd.model, this.pf.nearestWalkable(this.jitter(b.door, 0.8)));
        this.toast(fam, `A ${v.name} is waiting outside ${b.name}.`, v);
        return null;
      }
      case 'hostage': {
        const u = this.anyUnit(cmd.unit);
        if (!u || u.loc !== 'held' || u.heldBy !== fam) return 'No such hostage.';
        if (cmd.what === 'interrogate') {
          if (u.tag) s.flags['interrogated:' + u.tag] = 1;
          f.reveal = Math.max(f.reveal, s.time + HOUR * 24);
          this.toast(fam, `${u.name} talks. You now know where the rivals are for a day.`);
          this.s.flags['talked:' + u.id] = 1;
          return null;
        }
        const victim = s.families[u.fam];
        if (cmd.what === 'ransom') {
          const amount = Math.round(250 + u.level * 80 + (u.boss ? 600 : 0));
          const paid = victim && !victim.eliminated ? Math.min(amount, Math.max(0, victim.money)) : Math.round(amount * 0.3);
          if (victim) victim.money -= paid;
          f.money += paid;
          this.ev({ k: 'cash', x: u.x, y: u.y, amount: paid, fam } as GameEvent);
          this.news(`Envelope of cash changes hands; missing ${victim ? victim.short : ''} man returns home`, false);
        }
        u.heldBy = '';
        const home = this.hqOf(u.fam);
        if (home && victim && !victim.eliminated) { u.loc = 'street'; const p = this.pf.nearestWalkable(home.door); u.x = p.x; u.y = p.y; u.order = { k: 'idle' }; }
        else this.removeUnit(u);
        return null;
      }
      case 'skill': {
        const u = this.anyUnit(cmd.unit);
        if (!u || u.fam !== fam) return 'Not ours.';
        return spendSkillPoint(u, cmd.stat) ? null : 'No skill points (or stat maxed).';
      }
    }
    return 'Unknown command.';
  }
}

export function isCivic(type: string) {
  return type === 'precinct' || type === 'cityhall' || type === 'courthouse' || type === 'church' || type === 'bank';
}
export { HOUR };
