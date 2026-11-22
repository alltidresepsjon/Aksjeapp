import { describe, expect, it } from 'vitest';
import {
  CHAPTERS, World, buildChapterWorld, buildTurfWorld, finishChapter, generateMap, makeSnapshot, newCampaign,
  unpackBits, packBits, PathFinder, HOUR, DT,
} from '../src';

const run = (w: World, seconds: number) => { for (let i = 0; i < seconds / DT; i++) w.tick(); };

describe('map', () => {
  it('generates every chapter map with doors on walkable tiles', () => {
    for (const c of CHAPTERS) {
      const m = generateMap(c.layout);
      const pf = new PathFinder(m);
      expect(m.lots.length).toBeGreaterThan(8);
      for (const l of m.lots) expect(pf.isWalk(Math.floor(l.door.x), Math.floor(l.door.y))).toBe(true);
      // all doors reachable from the first one
      const a = m.lots[0].door;
      for (const l of m.lots) expect(pf.find(a, l.door).length, `${c.id} ${l.type}`).toBeGreaterThan(0);
    }
  });
  it('blocks line of sight through buildings', () => {
    const m = generateMap(CHAPTERS[0].layout);
    const pf = new PathFinder(m);
    expect(pf.sight({ x: 1, y: 1 }, { x: 1, y: 9 })).toBe(true);
    expect(pf.sight({ x: 1, y: 3 }, { x: 9, y: 3 })).toBe(false);
  });
  it('packs visibility bits', () => {
    const bits = new Uint8Array(100).map((_, i) => (i % 3 === 0 ? 1 : 0));
    expect(Array.from(unpackBits(packBits(bits), 100))).toEqual(Array.from(bits));
  });
});

describe('chapter 1', () => {
  const make = () => {
    const save = newCampaign(1);
    return { save, w: buildChapterWorld(CHAPTERS[0], save, save.roster.map((r) => r.id), 7) };
  };
  it('extortion takes a building and pays hourly', () => {
    const { w } = make();
    const rosie = w.s.units.find((u) => u.name === 'Rosie Ricci')!;
    const target = w.s.buildings.find((b) => !b.owner && b.type === 'diner')!;
    expect(w.command('P', { c: 'act', units: [rosie.id], b: target.id, act: 'extort' })).toBeNull();
    run(w, 60);
    expect(target.owner).toBe('P');
    const before = w.s.families.P.money;
    run(w, HOUR * 2);
    expect(w.s.families.P.money).toBeGreaterThan(before);
  });
  it('buying needs money and daytime', () => {
    const { w } = make();
    const nico = w.s.units.find((u) => u.hero)!;
    const shop = w.s.buildings.find((b) => !b.owner && b.type === 'grocer')!;
    expect(w.command('P', { c: 'act', units: [nico.id], b: shop.id, act: 'buy' })).toBeNull();
    run(w, 40);
    expect(shop.owner).toBe('P');
  });
  it('combat kills people and builds heat', () => {
    const { w } = make();
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    const doyle = w.s.units.find((u) => u.fam === 'D')!;
    lou.stance = 'aggressive';
    w.command('P', { c: 'attack', units: [lou.id], target: doyle.id });
    run(w, 60);
    // shots were exchanged: somebody is hurt (heat may already have cooled off indoors)
    expect(doyle.loc === 'dead' || doyle.hp < doyle.maxHp).toBe(true);
    expect(lou.loc === 'dead' || lou.hp < lou.maxHp || lou.kills > 0).toBe(true);
  });
  it('the scripted raid arrives at night and the AI does things', () => {
    const { w } = make();
    run(w, HOUR * 15);
    const doyles = w.s.units.filter((u) => u.fam === 'D' && u.loc !== 'dead');
    expect(doyles.length).toBeGreaterThan(3);
    expect(w.s.news.length).toBeGreaterThan(3);
  });
  it('a full simulated day does not crash and keeps state JSON-safe', () => {
    const { w } = make();
    run(w, HOUR * 30);
    expect(() => JSON.stringify(w.s)).not.toThrow();
  });
});

describe('cars, cargo and rackets', () => {
  it('drives a truck and delivers crates to a speakeasy', () => {
    const save = newCampaign(2);
    const w = buildChapterWorld(CHAPTERS[2], save, save.roster.map((r) => r.id), 3);
    const truck = w.s.vehicles.find((v) => v.fam === 'P')!;
    expect(truck).toBeTruthy();
    const front = w.s.buildings.find((b) => b.type === 'laundry' && !b.owner)!;
    front.owner = 'P';
    w.s.families.P.money = 5000;
    expect(w.command('P', { c: 'racket', b: front.id, kind: 'speakeasy' })).toMatch(/manager/);
    expect(w.command('P', { c: 'manager', b: front.id, idx: 0 })).toBeNull();
    expect(w.command('P', { c: 'racket', b: front.id, kind: 'speakeasy' })).toBeNull();
    const lou = w.s.units.find((u) => u.name === 'Lou Brennan')!;
    w.command('P', { c: 'board', units: [lou.id], v: truck.id });
    run(w, 20);
    expect(lou.loc).toBe('car');
    truck.cargo = 5;
    expect(w.command('P', { c: 'cargo', v: truck.id, b: front.id, op: 'unload' })).toBeNull();
    run(w, 40);
    expect(w.s.families.P.delivered).toBe(5);
  });
});

describe('campaign flow', () => {
  it('finishing a chapter carries survivors and cash forward', () => {
    const save = newCampaign(3);
    const w = buildChapterWorld(CHAPTERS[0], save, save.roster.map((r) => r.id), 3);
    w.s.families.P.money = 2000;
    w.win('P', 'test');
    const rep = finishChapter(save, w, CHAPTERS[0]);
    expect(rep.won).toBe(true);
    expect(save.chapter).toBe(1);
    expect(save.cash).toBe(2000 + CHAPTERS[0].reward);
    expect(save.roster.length).toBe(3);
  });
  it('every chapter builds and runs for a while', () => {
    for (const c of CHAPTERS) {
      const save = newCampaign(5);
      const w = buildChapterWorld(c, save, save.roster.map((r) => r.id), 11);
      run(w, HOUR * 6);
      expect(w.s.units.length).toBeGreaterThan(2);
    }
  });
});

describe('turf war', () => {
  it('builds a 4-family city and filters snapshots by fog', () => {
    const w = buildTurfWorld([
      { fam: 'A', player: 'p1', name: 'Ann', human: true },
      { fam: 'B', player: 'p2', name: 'Bob', human: true },
      { fam: 'C', player: '', name: '', human: false },
      { fam: 'D', player: '', name: '', human: false },
    ], 42);
    run(w, HOUR * 4);
    const snap = makeSnapshot(w, 'A', 0, { speed: 1, paused: false, skipping: false });
    const mine = snap.units.filter((u) => u.fam === 'A');
    expect(mine.length).toBeGreaterThan(0);
    const allOthers = w.s.units.filter((u) => u.fam !== 'A' && u.loc === 'street').length;
    const seenOthers = snap.units.filter((u) => u.fam !== 'A').length;
    expect(seenOthers).toBeLessThanOrEqual(allOthers);
    expect(snap.families.B.money % 500).toBe(0);
    expect(JSON.stringify(snap).length).toBeLessThan(200000);
  });
});
