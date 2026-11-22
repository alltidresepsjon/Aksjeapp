// Chapter objectives, scripted triggers and win/lose checks.

import { BTYPES } from '../data/buildings';
import { VEHICLES } from '../data/vehicles';
import type { GameEvent, Objective } from '../types';
import { soldierInit } from './units';
import type { World } from './world';

const PLAYER = 'P';

function reached(w: World, day: number, hour: number) {
  return w.s.day > day || (w.s.day === day && w.s.hour >= hour);
}

function evaluate(w: World, o: Objective): boolean {
  const s = w.s;
  const fam = s.families[PLAYER];
  const d = o.def;
  const owned = s.buildings.filter((b) => b.owner === PLAYER);
  switch (d.k) {
    case 'control': {
      const n = owned.filter((b) => b.type !== 'hq' && BTYPES[b.type].business).length;
      o.progress = `${Math.min(n, d.n)}/${d.n}`;
      return n >= d.n;
    }
    case 'defend': {
      const bs = w.byTag(d.tag).filter((b) => b.tag === d.tag);
      if (bs.some((b) => b.owner !== PLAYER)) { o.failed = true; return false; }
      o.progress = `until day ${d.untilDay}, ${String(Math.floor(d.untilHour)).padStart(2, '0')}:00`;
      return reached(w, d.untilDay, d.untilHour);
    }
    case 'kidnap': return !!s.flags['held:' + d.tag];
    case 'interrogate': return !!s.flags['interrogated:' + d.tag];
    case 'kill': return !!s.flags['killed:' + d.tag];
    case 'racket': {
      const n = owned.filter((b) => b.racket === d.kind).length;
      o.progress = `${Math.min(n, d.n)}/${d.n}`;
      return n >= d.n;
    }
    case 'deliver': o.progress = `${Math.min(fam.delivered, d.n)}/${d.n}`; return fam.delivered >= d.n;
    case 'cash': {
      const earned = Math.max(0, fam.money - (s.flags.startMoney ?? 0));
      o.progress = `$${Math.round(earned).toLocaleString('en-US')} / $${d.n.toLocaleString('en-US')}`;
      return earned >= d.n;
    }
    case 'destroy': {
      const bs = w.byTag(d.tag);
      o.progress = `${bs.filter((b) => b.burned).length}/${bs.length}`;
      return bs.length > 0 && bs.every((b) => b.burned);
    }
    case 'capture': {
      const bs = w.byTag(d.tag);
      o.progress = bs.length > 1 ? `${bs.filter((b) => b.owner === PLAYER).length}/${bs.length}` : '';
      return bs.length > 0 && bs.every((b) => b.owner === PLAYER);
    }
    case 'crack': return !!s.flags['cracked:' + d.tag];
    case 'free': return !!s.flags['freed:' + d.tag];
    case 'rob': o.progress = `$${fam.robbed.toLocaleString('en-US')} / $${d.n.toLocaleString('en-US')}`; return fam.robbed >= d.n;
    case 'car': return s.vehicles.some((v) => !v.dead && v.fam === PLAYER);
  }
  return false;
}

export function checkObjectives(w: World) {
  const s = w.s;
  if (s.result) return;
  if (s.mode === 'turf') { checkTurf(w); return; }
  const fam = s.families[PLAYER];
  if (!fam) return;
  for (const o of s.objectives) {
    if (o.done || o.failed) continue;
    if (o.after && !s.objectives.find((x) => x.id === o.after)?.done) continue;
    if (evaluate(w, o)) {
      o.done = true;
      w.toast(PLAYER, `Objective complete: ${o.text}`);
      s.flags['obj:' + o.id] = 1;
    } else if (o.failed) {
      if (!o.optional) { w.lose(`You failed: ${o.text.toLowerCase()}. Without it the family's name means nothing on these streets.`); return; }
    }
  }
  const required = s.objectives.filter((o) => !o.optional);
  if (required.length && required.every((o) => o.done)) { w.win(PLAYER, 'All objectives complete.'); return; }
  // out of people and money
  const crew = s.units.filter((u) => u.fam === PLAYER && !u.cop);
  const active = crew.filter((u) => w.active(u));
  if (!active.length) {
    const bailable = crew.some((u) => u.loc === 'jail' && u.bail <= fam.money);
    if (!bailable && fam.money < 100) w.lose('No crew, no cash, no friends. The Corrado name fades into the city\'s long memory.');
  }
}

function checkTurf(w: World) {
  const s = w.s;
  const alive = Object.values(s.families).filter((f) => !f.eliminated);
  const humansAlive = alive.filter((f) => f.human);
  if (alive.length === 1) { w.win(alive[0].id, `${alive[0].name} rules Port Halloran.`); return; }
  if (!humansAlive.length) { w.win(alive[0]?.id ?? '', 'The machines of the underworld have won.'); return; }
  if (s.timeLimitDay && s.day > s.timeLimitDay) {
    let best = alive[0], bestWorth = -1e9;
    for (const f of alive) {
      const worth = f.money + s.buildings.filter((b) => b.owner === f.id).reduce((a, b) => a + (BTYPES[b.type].income * 8 + (b.racket ? 600 : 0)), 0);
      if (worth > bestWorth) { bestWorth = worth; best = f; }
    }
    w.win(best.id, `Time is up. ${best.name} is the richest family in town ($${Math.round(bestWorth).toLocaleString('en-US')} in cash and property).`);
  }
}

export function runScript(w: World) {
  const s = w.s;
  for (const t of s.script) {
    if (t.fired) continue;
    let go = false;
    if (t.at && reached(w, t.at.day, t.at.hour)) go = true;
    if (t.on && s.flags['obj:' + t.on]) go = true;
    if (!go) continue;
    t.fired = true;
    for (const a of t.do) {
      if (a.k === 'news') w.news(a.text, !!a.big);
      else if (a.k === 'toast') w.toast(PLAYER, a.text, undefined, true);
      else if (a.k === 'flag') s.flags[a.name] = 1;
      else if (a.k === 'wave') {
        const fam = s.families[a.fam];
        if (!fam || fam.eliminated) continue;
        const at = w.edgePoint(a.edge);
        const units = [];
        for (let i = 0; i < a.n; i++) {
          const u = w.addUnit(soldierInit(w.rng, a.fam, fam.statLo, fam.statHi, a.weapon), w.jitter(at, 1));
          u.behavior = { k: 'raid', tag: a.tag };
          u.stance = 'aggressive';
          u.retreat = false;
          units.push(u);
        }
        if (a.car) {
          let left = units.slice();
          while (left.length) {
            const v = w.addVehicle(a.fam, 'sedan', w.pf.nearestWalkable(w.jitter(at, 1)));
            const group = left.slice(0, VEHICLES.sedan.seats);
            left = left.slice(VEHICLES.sedan.seats);
            for (const u of group) w.board(u, v);
            const tgt = w.byTag(a.tag)[0];
            if (tgt) v.path = w.pf.find(v, tgt.door);
            s.flags['autoexit:' + v.id] = 1;
          }
        }
        const tgt = w.byTag(a.tag)[0];
        if (tgt) w.ev({ k: 'toast', text: `${fam.short} gunmen spotted heading for ${tgt.name}!`, fam: PLAYER, x: at.x, y: at.y, urgent: true } as GameEvent);
      }
    }
  }
}
