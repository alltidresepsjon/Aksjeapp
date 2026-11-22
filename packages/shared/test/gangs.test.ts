import { describe, expect, it } from 'vitest';
import { CHAPTERS, DT, HOUR, buildChapterWorld, newCampaign, type World } from '../src';

const run = (w: World, seconds: number) => { for (let i = 0; i < seconds / DT; i++) w.tick(); };
const make = () => { const s = newCampaign(12); return buildChapterWorld(CHAPTERS[0], s, s.roster.map((r) => r.id), 12); };

describe('lieutenants, orders, trials and the paper', () => {
  it('men follow their lieutenant into a building', () => {
    const w = make();
    const nico = w.s.units.find((u) => u.hero)!;
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    expect(w.command('P', { c: 'lieutenant', units: [lou.id], leader: nico.id })).toBeNull();
    expect(lou.leader).toBe(nico.id);
    const hq = w.hqOf('P')!;
    w.command('P', { c: 'move', units: [nico.id], x: hq.door.x + 4, y: hq.door.y });
    run(w, 8);
    expect(Math.hypot(lou.x - nico.x, lou.y - nico.y)).toBeLessThan(2.5);
    w.command('P', { c: 'act', units: [nico.id], b: hq.id, act: 'enter' });
    run(w, 10);
    expect(nico.loc).toBe('inside');
    expect(lou.loc).toBe('inside');
  });
  it('a low-level man cannot lead', () => {
    const w = make();
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    const rosie = w.s.units.find((u) => u.name === 'Rosie Ricci')!;
    expect(w.command('P', { c: 'lieutenant', units: [rosie.id], leader: lou.id })).toMatch(/level 2/);
  });
  it('patrol walks between points, guard holds a spot, tail shadows a rival', () => {
    const w = make();
    const [nico, lou, rosie] = ['Nico Corrado', 'Lou Brennan', 'Rosie Ricci'].map((n) => w.s.units.find((u) => u.name === n)!);
    const hq = w.hqOf('P')!;
    const a = { x: hq.door.x + 3, y: hq.door.y }, b = { x: hq.door.x + 8, y: hq.door.y };
    w.command('P', { c: 'patrol', units: [lou.id], pts: [a, b] });
    w.command('P', { c: 'guard', units: [nico.id], x: hq.door.x, y: hq.door.y });
    const doyle = w.s.units.find((u) => u.fam === 'D')!;
    w.command('P', { c: 'tail', units: [rosie.id], target: doyle.id });
    let visitedB = false;
    for (let i = 0; i < 30 / DT; i++) { w.tick(); if (Math.hypot(lou.x - b.x, lou.y - b.y) < 1) visitedB = true; }
    expect(visitedB).toBe(true);
    expect(lou.order.k).toBe('patrol');
    expect(Math.hypot(nico.x - hq.door.x, nico.y - hq.door.y)).toBeLessThan(1.5);
    expect(rosie.order.k).toBe('tail');
    expect(rosie.stance).toBe('passive');
  });
  it('an arrest leads to a trial with a verdict', () => {
    const w = make();
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    w.arrest(lou);
    expect(lou.trial?.day).toBe(w.s.day + 2);
    w.s.families.P.money = 1000;
    expect(w.command('P', { c: 'lawyer', unit: lou.id })).toBeNull();
    lou.trial!.day = w.s.day; lou.trial!.hour = w.s.hour; // bring the trial forward
    run(w, 3);
    expect(w.s.verdicts.length).toBeGreaterThan(0);
    expect(['street', 'inside', 'jail']).toContain(lou.loc);
  });
  it('deaths reach the obituaries and money the ledger', () => {
    const w = make();
    const d = w.s.units.find((u) => u.fam === 'D')!;
    w.kill(d, w.s.units.find((u) => u.hero)!);
    expect(w.s.obits[0].name).toBe(d.name);
    w.s.families.P.money = 1000;
    expect(w.command('P', { c: 'rumor', fam: 'D' })).toBeNull();
    expect(w.s.families.P.reveal).toBeGreaterThan(w.s.time);
    expect(w.s.ledger.P[0].other).toBeGreaterThan(0);
  });
});
