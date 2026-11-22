// Rival family AI: hires, guards its turf, answers threats, retreats the wounded
// and attacks in gathered squads instead of trickling men in one at a time.

import { isOpen, SIGHT } from '../constants';
import { BTYPES, RACKETS } from '../data/buildings';
import type { Building, FamId, Family, Pt, Unit } from '../types';
import { soldierInit } from './units';
import type { World } from './world';

export interface AiMemory {
  squad: number[];
  target: number;
  stage: 'none' | 'gather' | 'attack';
  since: number;
  rally: Pt;
  revenge: FamId;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const HIRE_COST = 160;

export function runAi(w: World, f: Family) {
  const s = w.s;
  let mem = w.ai.get(f.id);
  if (!mem) { mem = { squad: [], target: -1, stage: 'none', since: 0, rally: { x: 0, y: 0 }, revenge: '' }; w.ai.set(f.id, mem); }
  const hq = w.hqOf(f.id);
  const mine = s.units.filter((u) => u.fam === f.id && w.active(u) && !u.guard && !u.cop && !(u.heldBy && u.heldBy !== u.fam));
  const free = mine.filter((u) => !u.behavior && !(u.boss && u.tag));
  const own = s.buildings.filter((b) => b.owner === f.id);

  // remember who hurt us last
  for (const e of s.events.slice(-80)) if (e.k === 'capture' && e.prev === f.id && e.fam !== f.id) mem.revenge = e.fam;

  // --- hire ---
  if (f.money >= HIRE_COST && free.length < f.cap) {
    f.money -= HIRE_COST;
    const at = hq ? hq.door : w.edgePoint(w.rng.pick(['N', 'E'] as const));
    const u = w.addUnit(soldierInit(w.rng, f.id, f.statLo, f.statHi, s.day >= 4 && w.rng.chance(0.25) ? 'tommy' : undefined), w.jitter(at));
    free.push(u);
  }
  // --- side business: AI opens gambling dens in fronts ---
  if (f.money > 900 && w.rng.chance(0.2)) {
    const front = own.find((b) => BTYPES[b.type].front && !b.racket && !b.burned);
    if (front) { front.racket = 'gambling'; f.money -= RACKETS.gambling.setup; }
  }

  // --- wounded fall back ---
  for (const u of free) {
    if (u.loc === 'street' && u.hp < u.maxHp * 0.35 && u.order.k !== 'retreat') {
      const b = own.filter((x) => !x.burned).sort((a, c) => dist(a.door, u) - dist(c.door, u))[0];
      if (b) w.order(u, { k: 'retreat', b: b.id });
    }
  }

  // --- what do we know about enemies? ---
  const enemies = s.units.filter((t) => t.fam !== f.id && !t.cop && (t.loc === 'street' || t.loc === 'car') && !(t.heldBy && t.heldBy !== t.fam));
  const known = enemies.filter((t) =>
    f.reveal > s.time ||
    mine.some((u) => dist(w.pos(u), t) < Math.min(SIGHT, w.detectRange(t) + 1)) ||
    own.some((b) => dist(b.door, t) < 5));

  // --- defend threatened buildings ---
  const busy = new Set<number>(mem.stage !== 'none' ? mem.squad : []);
  const hqGarrison = hq ? Math.min(4, 1 + Math.floor(f.cap / 5)) : 0;
  const inHq = hq ? free.filter((u) => u.loc === 'inside' && u.bld === hq.id) : [];
  const available = () => free.filter((u) => !busy.has(u.id) && u.order.k !== 'retreat' && u.hp > u.maxHp * 0.4 &&
    !(hq && u.loc === 'inside' && u.bld === hq.id && inHq.indexOf(u) < hqGarrison));
  for (const b of own) {
    const attackers = known.filter((t) => dist(t, b.door) < 4.5);
    const prog = Object.entries(b.prog).some(([fid, v]) => fid !== f.id && v > 3);
    if (!attackers.length && !prog) continue;
    const need = Math.min(5, attackers.length + 1);
    const pool = available().sort((a, c) => dist(w.pos(a), b.door) - dist(w.pos(c), b.door)).slice(0, need);
    for (const u of pool) {
      busy.add(u.id);
      u.stance = 'aggressive';
      const t = attackers.sort((a, c) => dist(a, u) - dist(c, u))[0];
      if (t) { if (u.order.k !== 'attack') w.order(u, { k: 'attack', id: t.id }); }
      else if (u.order.k !== 'goto') w.order(u, { k: 'goto', b: b.id, act: 'enter' });
    }
  }

  // --- keep the headquarters garrisoned ---
  if (hq && inHq.length < hqGarrison) {
    const idle = available().filter((u) => u.loc === 'street' && u.order.k === 'idle')
      .sort((a, c) => dist(a, hq.door) - dist(c, hq.door));
    for (const u of idle.slice(0, hqGarrison - inHq.length)) { w.order(u, { k: 'goto', b: hq.id, act: 'enter' }); busy.add(u.id); }
  }

  // --- squad attacks ---
  mem.since += 2;
  const squad = mem.squad.map((id) => w.unit(id)).filter((u): u is Unit => !!u && w.active(u));
  if (mem.stage !== 'none') {
    const tgt = s.buildings[mem.target];
    if (!tgt || tgt.owner === f.id || tgt.burned || !squad.length || mem.since > 100) {
      mem.stage = 'none'; mem.squad = [];
      for (const u of squad) if (u.order.k === 'goto') u.order = { k: 'idle' };
    } else if (mem.stage === 'gather') {
      const ready = squad.every((u) => dist(w.pos(u), mem!.rally) < 2.8) || mem.since > 14;
      if (ready) {
        mem.stage = 'attack';
        const act = !tgt.owner && isOpen(s.hour) ? 'extort' : 'takeover';
        for (const u of squad) { u.stance = 'aggressive'; w.order(u, { k: 'goto', b: tgt.id, act }); }
      } else {
        for (const u of squad) if (u.order.k === 'idle' && u.loc === 'street' && dist(u, mem.rally) > 2.8) w.order(u, { k: 'move', x: mem.rally.x, y: mem.rally.y });
      }
    } else {
      const act = !tgt.owner && isOpen(s.hour) ? 'extort' : 'takeover';
      for (const u of squad) if (u.order.k === 'idle' && u.target < 0 && u.loc === 'street') w.order(u, { k: 'goto', b: tgt.id, act });
    }
  }
  if (mem.stage === 'none') {
    const pool = available().filter((u) => u.order.k === 'idle' && u.target < 0);
    const size = 2 + (s.day >= 2 ? 1 : 0) + (f.cap >= 10 ? 1 : 0);
    if (pool.length >= size && w.rng.chance(Math.min(0.9, f.aggression * 1.6))) {
      const c = centroid(pool.map((u) => w.pos(u)));
      const target = pickTarget(w, f, c, pool.length, mem.revenge);
      if (target) {
        const members = pool.sort((a, b) => dist(w.pos(a), target.door) - dist(w.pos(b), target.door)).slice(0, size + 1);
        mem.squad = members.map((u) => u.id);
        mem.target = target.id;
        mem.stage = 'gather';
        mem.since = 0;
        const mc = centroid(members.map((u) => w.pos(u)));
        const toward = { x: mc.x + (target.door.x - mc.x) * 0.35, y: mc.y + (target.door.y - mc.y) * 0.35 };
        mem.rally = w.pf.nearestWalkable(toward);
        for (const u of members) { if (u.loc === 'inside') w.exitBuilding(u); w.order(u, { k: 'move', x: mem.rally.x, y: mem.rally.y }); }
      }
    }
  }

  // --- lone collectors: quietly extort nearby independents by day ---
  if (isOpen(s.hour) && w.rng.chance(0.35)) {
    const loner = available().find((u) => u.order.k === 'idle' && u.loc === 'street' && u.stats.charm >= 2 && !mem!.squad.includes(u.id));
    const home = hq ? hq.door : own[0]?.door;
    if (loner && home) {
      const n = s.buildings.filter((b) => !b.owner && !b.burned && BTYPES[b.type].business && b.type !== 'hq' && dist(b.door, home) < 16)
        .sort((a, b) => dist(a.door, loner) - dist(b.door, loner))[0];
      if (n) w.order(loner, { k: 'goto', b: n.id, act: 'extort' });
    }
  }
  // idle units drift home
  for (const u of free) {
    if (u.loc === 'street' && u.order.k === 'idle' && u.target < 0 && !busy.has(u.id) && !mem.squad.includes(u.id) && w.rng.chance(0.08)) {
      const b = own.length ? w.rng.pick(own) : null;
      if (b) w.order(u, { k: 'move', x: b.door.x + w.rng.range(-1, 1), y: b.door.y + w.rng.range(-0.5, 0.5) });
    }
  }
}

function centroid(ps: Pt[]): Pt {
  const n = Math.max(1, ps.length);
  return { x: ps.reduce((a, p) => a + p.x, 0) / n, y: ps.reduce((a, p) => a + p.y, 0) / n };
}

function pickTarget(w: World, f: Family, from: Pt, strength: number, revenge: FamId): Building | null {
  const s = w.s;
  let best: Building | null = null, bestScore = -1e9;
  for (const b of s.buildings) {
    if (b.owner === f.id || b.burned) continue;
    const def = BTYPES[b.type];
    if (!def.business) continue;
    const owner = b.owner ? s.families[b.owner] : null;
    if (b.type === 'hq') {
      if (!owner || strength < 5 || f.aggression < 0.4 || s.day < 2) continue;
    }
    if (owner && owner.human && s.mode === 'campaign' && s.day < 2 && s.hour < 18 && f.aggression < 0.4) continue;
    const defenders = w.defenders(b).length;
    let value = def.income + (b.racket ? RACKETS[b.racket].income : 0);
    if (owner) value *= 1.2;
    if (owner && owner.human) value += 60;
    if (b.owner === revenge) value += 80;
    if (b.type === 'hq') value += 300;
    const score = value - defenders * 70 - dist(b.door, from) * 6;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}
