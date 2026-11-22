import { describe, expect, it } from 'vitest';
import { CHAPTERS, DT, HOUR, buildChapterWorld, newCampaign, type World } from '../src';

const run = (w: World, seconds: number, each?: () => void) => {
  for (let i = 0; i < seconds / DT; i++) { each?.(); w.tick(); if (w.s.result) break; }
};
const make = (ch: number, seed = 9) => {
  const save = newCampaign(seed);
  return buildChapterWorld(CHAPTERS[ch], save, save.roster.map((r) => r.id), seed);
};

describe('specialists and crimes', () => {
  it('kidnaps the bagman, drives him home and interrogates him', () => {
    const w = make(1);
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    const runner = w.s.units.find((u) => u.tag === 'runner')!;
    // keep the bagman's bodyguard out of the way and weaken the target
    for (const u of w.s.units) if (u.fam === 'D' && u.id !== runner.id) w.removeUnit(u);
    runner.hp = runner.maxHp * 0.3;
    runner.behavior = null;
    const car = w.addVehicle('P', 'sedan', w.pf.nearestWalkable({ x: runner.x + 1, y: runner.y }));
    lou.x = runner.x + 0.5; lou.y = runner.y;
    expect(w.command('P', { c: 'kidnap', units: [lou.id], target: runner.id })).toBeNull();
    run(w, 5);
    expect(runner.loc).toBe('car');
    w.command('P', { c: 'board', units: [lou.id], v: car.id });
    run(w, 3);
    const hq = w.hqOf('P')!;
    expect(w.command('P', { c: 'drive', v: car.id, x: hq.door.x, y: hq.door.y })).toBeNull();
    run(w, 40);
    expect(runner.loc).toBe('held');
    expect(w.command('P', { c: 'hostage', unit: runner.id, what: 'interrogate' })).toBeNull();
    run(w, 1);
    expect(w.s.objectives.find((o) => o.id === 'o3')!.done).toBe(true);
  });

  it('a safecracker robs the bank at night', () => {
    const w = make(5);
    const bank = w.s.buildings.find((b) => b.type === 'bank')!;
    const s = w.addUnit({ fam: 'P', name: 'Tumbler Lund', role: 'Safecracker', spec: 'safecracker', stats: { muscle: 2, aim: 2, charm: 2, stealth: 9 } }, bank.door);
    expect(w.canAct(s, bank, 'crack')).toMatch(/after dark/);
    run(w, HOUR * 13); // until 21:00
    s.hp = s.maxHp; s.x = bank.door.x; s.y = bank.door.y; s.loc = 'street';
    const before = w.s.families.P.money;
    w.command('P', { c: 'act', units: [s.id], b: bank.id, act: 'crack' });
    run(w, 60);
    expect(w.s.families.P.robbed).toBeGreaterThan(0);
    expect(w.s.families.P.money).toBeGreaterThan(before);
  });

  it('an arsonist burns a rival warehouse', () => {
    const w = make(4);
    const wh = w.byTag('dwh')[0];
    for (const u of w.s.units) if (u.fam === 'D' && !u.boss) w.removeUnit(u);
    const a = w.addUnit({ fam: 'P', name: 'Matches Keene', role: 'Arsonist', spec: 'arsonist', stats: { muscle: 3, aim: 2, charm: 1, stealth: 5 } }, wh.door);
    w.command('P', { c: 'act', units: [a.id], b: wh.id, act: 'torch' });
    run(w, 40);
    expect(wh.burned).toBe(true);
    expect(wh.owner).toBeNull();
  });

  it('a card sharp wins money at a casino', () => {
    const w = make(3);
    const casino = w.byTag('casino')[0];
    const c = w.addUnit({ fam: 'P', name: 'Deuce Flynn', role: 'Card Sharp', spec: 'cardsharp', stats: { muscle: 1, aim: 1, charm: 8, stealth: 3 } }, casino.door);
    w.command('P', { c: 'act', units: [c.id], b: casino.id, act: 'cards' });
    run(w, HOUR * 5);
    expect(c.loc).toBe('inside');
    expect(w.s.families.P.reveal).toBeGreaterThan(w.s.time);
  });

  it('police arrest wanted gangsters and bail works', () => {
    const w = make(0);
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    lou.heat = 95; lou.stance = 'passive'; lou.retreat = false;
    run(w, 60, () => { if (lou.loc === 'street') lou.heat = Math.max(lou.heat, 70); });
    expect(lou.loc).toBe('jail');
    w.s.families.P.money = 5000;
    expect(w.command('P', { c: 'bail', unit: lou.id })).toBeNull();
    expect(lou.loc).toBe('street');
  });
});
