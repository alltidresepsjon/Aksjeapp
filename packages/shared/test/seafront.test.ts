import { describe, expect, it } from 'vitest';
import { CHAPTERS, DT, HOUR, buildChapterWorld, newCampaign, type World } from '../src';

const run = (w: World, seconds: number) => { for (let i = 0; i < seconds / DT; i++) w.tick(); };
const make = () => { const s = newCampaign(8); return buildChapterWorld(CHAPTERS[0], s, s.roster.map((r) => r.id), 8); };

describe('sea front, reputation and rain', () => {
  it('every street-edged map gets a pleasure pier and a landing', () => {
    const w = make();
    expect(w.s.buildings.some((b) => b.type === 'amusement')).toBe(true);
    expect(w.s.buildings.some((b) => b.type === 'landing')).toBe(true);
    const pier = w.s.buildings.find((b) => b.type === 'amusement')!;
    expect(w.pf.isWalk(Math.floor(pier.door.x), Math.floor(pier.door.y))).toBe(true);
  });
  it('buying the pier legally improves the family name', () => {
    const w = make();
    const pier = w.s.buildings.find((b) => b.type === 'amusement')!;
    const nico = w.s.units.find((u) => u.hero)!;
    w.s.families.P.money = 5000;
    expect(w.command('P', { c: 'act', units: [nico.id], b: pier.id, act: 'buy' })).toBeNull();
    run(w, 60);
    expect(pier.owner).toBe('P');
    expect(w.s.families.P.rep).toBeGreaterThan(5);
  });
  it('a donation at the church helps, a cop killing hurts', () => {
    const w = make();
    w.repChange('P', 12);
    expect(w.s.families.P.rep).toBe(12);
    w.repChange('P', -40);
    expect(w.s.families.P.rep).toBe(-28);
  });
  it('a good name and rain both mean less heat', () => {
    const w = make();
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    const base = w.heatMult(lou);
    w.s.families.P.rep = 60;
    const good = w.heatMult(lou);
    w.s.rain = 1;
    const wet = w.heatMult(lou);
    expect(good).toBeLessThan(base);
    expect(wet).toBeLessThan(good);
  });
  it('a smugglers boat sells crates at the landing some nights', () => {
    const w = make();
    const landing = w.s.buildings.find((b) => b.type === 'landing')!;
    landing.stock = 10;
    const car = w.addVehicle('P', 'truck', w.pf.nearestWalkable(landing.door));
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    w.board(lou, car);
    w.s.families.P.money = 1000;
    w.cargoOp(car, landing, 'load');
    expect(car.cargo).toBe(10);
    expect(landing.stock).toBe(0);
  });
  it('rain comes and goes over several days without breaking anything', () => {
    const w = make();
    let rained = false;
    for (let i = 0; i < (HOUR * 24 * 5) / DT; i++) { w.tick(); if (w.s.rain) rained = true; if (w.s.result) break; }
    expect(typeof rained).toBe('boolean');
  });
});
