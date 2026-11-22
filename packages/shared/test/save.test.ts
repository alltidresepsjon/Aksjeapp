import { describe, expect, it } from 'vitest';
import { CHAPTERS, DT, HOUR, buildChapterWorld, newCampaign } from '../src';

describe('saving and difficulty', () => {
  it('a chapter can be saved mid-way and continued', () => {
    const save = newCampaign(4);
    const w = buildChapterWorld(CHAPTERS[0], save, save.roster.map((r) => r.id), 4);
    for (let i = 0; i < (HOUR * 5) / DT; i++) w.tick();
    const snap = JSON.parse(JSON.stringify(w.save()));
    const w2 = buildChapterWorld(CHAPTERS[0], save, save.roster.map((r) => r.id), 99);
    w2.restore(snap);
    expect(w2.s.time).toBeCloseTo(w.s.time);
    expect(w2.s.units.length).toBe(w.s.units.length);
    expect(w2.unit(w.s.units[0].id)?.name).toBe(w.s.units[0].name);
    for (let i = 0; i < (HOUR * 5) / DT; i++) w2.tick();
    expect(w2.s.time).toBeGreaterThan(w.s.time);
  });
  it('difficulty changes the rivals and the start money', () => {
    const easy = newCampaign(1, 'easy'), hard = newCampaign(1, 'hard');
    expect(easy.cash).toBeGreaterThan(hard.cash);
    const we = buildChapterWorld(CHAPTERS[2], easy, easy.roster.map((r) => r.id), 1);
    const wh = buildChapterWorld(CHAPTERS[2], hard, hard.roster.map((r) => r.id), 1);
    expect(we.s.families.K.money).toBeLessThan(wh.s.families.K.money);
    expect(we.s.families.K.aggression).toBeLessThan(wh.s.families.K.aggression);
  });
});
