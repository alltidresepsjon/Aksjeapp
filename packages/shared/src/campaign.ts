// Campaign persistence: the roster, cash and cars that carry over between chapters.

import { CHAPTERS, CORRADO, type ChapterDef } from './data/chapters';
import type { Ad, Spec, Stats, VModel, WeaponId } from './types';
import { World } from './sim/world';
import type { UnitInit } from './sim/units';
import { genAd } from './sim/units';
import { Rng } from './rng';

export interface RosterMember {
  id: string;
  name: string;
  role: string;
  spec: Spec;
  stats: Stats;
  level: number;
  xp: number;
  sp: number;
  weapon: WeaponId;
  wage: number;
  hero: boolean;
  kills: number;
  chapters: number;
}

export interface CampaignSave {
  version: 1;
  chapter: number;
  cash: number;
  roster: RosterMember[];
  cars: VModel[];
  completed: string[];
  ads: Ad[];
  seed: number;
  lastReport: ChapterReport | null;
}

export interface ChapterReport {
  chapter: string;
  won: boolean;
  text: string;
  earned: number;
  dead: string[];
  levelUps: { name: string; level: number }[];
  xp: { name: string; xp: number }[];
  hired: string[];
}

let idCounter = 0;
const rid = () => 'r' + Date.now().toString(36) + (idCounter++).toString(36);

export function newCampaign(seed = Date.now()): CampaignSave {
  const rng = new Rng(seed);
  return {
    version: 1, chapter: 0, cash: 600, cars: [], completed: [], seed, lastReport: null,
    ads: [0, 1, 2, 3, 4].map(() => genAd(rng, 1)),
    roster: [
      { id: 'nico', name: 'Nico Corrado', role: 'The Son', spec: 'none', stats: { muscle: 3, aim: 3, charm: 4, stealth: 3 }, level: 1, xp: 0, sp: 1, weapon: 'revolver', wage: 0, hero: true, kills: 0, chapters: 0 },
      { id: 'lou', name: 'Lou Brennan', role: 'Bruiser', spec: 'none', stats: { muscle: 5, aim: 3, charm: 1, stealth: 2 }, level: 1, xp: 0, sp: 0, weapon: 'shotgun', wage: 14, hero: false, kills: 0, chapters: 0 },
      { id: 'rosie', name: 'Rosie Ricci', role: 'Talker', spec: 'none', stats: { muscle: 1, aim: 2, charm: 5, stealth: 3 }, level: 1, xp: 0, sp: 0, weapon: 'revolver', wage: 10, hero: false, kills: 0, chapters: 0 },
    ],
  };
}

export function refreshSafehouseAds(save: CampaignSave) {
  const rng = new Rng(save.seed + save.chapter * 977 + save.roster.length);
  save.ads = [0, 1, 2, 3, 4].map(() => genAd(rng, 2 + save.chapter * 2));
}

export function hireFromAd(save: CampaignSave, adId: string): string | null {
  const ad = save.ads.find((a) => a.id === adId);
  if (!ad) return 'That ad is gone.';
  if (save.cash < ad.fee) return 'Not enough cash.';
  save.cash -= ad.fee;
  save.ads = save.ads.filter((a) => a !== ad);
  save.roster.push({ id: rid(), name: ad.name, role: ad.role, spec: ad.spec, stats: { ...ad.stats }, level: 1, xp: 0, sp: 0, weapon: ad.weapon, wage: ad.wage, hero: false, kills: 0, chapters: 0 });
  return null;
}

export function chapterFor(save: CampaignSave): ChapterDef | undefined {
  return CHAPTERS[save.chapter];
}

export function buildChapterWorld(def: ChapterDef, save: CampaignSave, crewIds: string[], seed = Date.now()): World {
  const crew: UnitInit[] = save.roster.filter((r) => crewIds.includes(r.id) || r.hero).map((r) => ({
    fam: 'P', name: r.name, role: r.role, spec: r.spec, stats: { ...r.stats }, level: r.level, xp: r.xp, sp: r.sp,
    weapon: r.weapon, wage: r.wage, hero: r.hero, rosterId: r.id, stance: 'defensive',
  }));
  const families = def.families.map((f) => (f.id === 'P' ? { ...f, money: Math.max(save.cash, def.minCash) } : f));
  const cars = [...save.cars.slice(0, 3), ...def.gift].map((model) => ({ fam: 'P', model }));
  const w = new World({
    mode: 'campaign', chapter: def.id, layout: def.layout, families, crew: { P: crew }, vehicles: cars,
    npcs: def.npcs, objectives: def.objectives, script: def.script, startHour: def.startHour, seed,
    fog: def.num >= 2, bribeMult: def.bribeMult, news: def.news,
  });
  return w;
}

/** Copies the outcome of a chapter back into the save. */
export function finishChapter(save: CampaignSave, w: World, def: ChapterDef): ChapterReport {
  const s = w.s;
  const won = !!s.result && s.result.winner === 'P';
  const fam = s.families.P;
  const report: ChapterReport = { chapter: def.id, won, text: s.result?.text ?? '', earned: 0, dead: [], levelUps: [], xp: [], hired: [] };
  if (!won) { save.lastReport = report; return report; }
  const start = save.cash;
  const byRoster = new Map(s.units.filter((u) => u.fam === 'P' && u.rosterId).map((u) => [u.rosterId, u]));
  const next: RosterMember[] = [];
  for (const r of save.roster) {
    if (w.fired.includes(r.id)) continue;
    const u = byRoster.get(r.id);
    if (!u) { next.push(r); continue; } // stayed home
    if (u.loc === 'dead') { report.dead.push(r.name); continue; }
    const before = r.level;
    u.xp += 0;
    const bonus = 40;
    r.xp = u.xp; r.level = u.level; r.sp = u.sp; r.stats = { ...u.stats }; r.weapon = u.weapon; r.kills += u.kills; r.chapters++;
    // survival bonus
    r.xp += bonus;
    while (r.xp >= r.level * 100) { r.xp -= r.level * 100; r.level++; r.sp++; }
    report.xp.push({ name: r.name, xp: u.xpGain + bonus });
    if (r.level > before) report.levelUps.push({ name: r.name, level: r.level });
    next.push(r);
  }
  for (const u of s.units) {
    if (u.fam !== 'P' || !u.rosterId.startsWith('new:') || u.loc === 'dead') continue;
    next.push({ id: rid(), name: u.name, role: u.role, spec: u.spec, stats: { ...u.stats }, level: u.level, xp: u.xp + 40, sp: u.sp, weapon: u.weapon, wage: u.wage, hero: false, kills: u.kills, chapters: 1 });
    report.hired.push(u.name);
  }
  save.roster = next;
  save.cash = Math.max(0, Math.round(fam.money)) + def.reward;
  report.earned = save.cash - start;
  save.cars = s.vehicles.filter((v) => !v.dead && v.fam === 'P').map((v) => v.model).slice(0, 4);
  save.completed.push(def.id);
  save.chapter++;
  refreshSafehouseAds(save);
  save.lastReport = report;
  return report;
}

export const PLAYER_FAMILY = CORRADO;
