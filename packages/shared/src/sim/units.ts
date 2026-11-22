// Unit creation, derived stats and levelling.

import { STAT_CAP, XP_PER_LEVEL } from '../constants';
import { WEAPONS } from '../data/weapons';
import { ROLES } from '../data/roles';
import { FIRST, LAST, NICK } from '../data/names';
import type { Ad, FamId, Spec, Stance, Stats, Unit, WeaponId } from '../types';
import type { Rng } from '../rng';

export interface UnitInit {
  fam: FamId;
  name: string;
  role: string;
  spec?: Spec;
  stats: Stats;
  level?: number;
  xp?: number;
  sp?: number;
  weapon?: WeaponId;
  wage?: number;
  hero?: boolean;
  boss?: boolean;
  cop?: boolean;
  guard?: boolean;
  tag?: string;
  hpBonus?: number;
  stance?: Stance;
  rosterId?: string;
}

export function maxHpFor(stats: Stats, level: number, bonus = 0): number {
  return Math.round(100 + stats.muscle * 12 + (level - 1) * 8 + bonus);
}

export function makeUnit(id: number, init: UnitInit, x: number, y: number): Unit {
  const level = init.level ?? 1;
  const hp = maxHpFor(init.stats, level, (init.hero ? 80 : 0) + (init.hpBonus ?? 0));
  const weapon = init.weapon ?? 'revolver';
  return {
    id, fam: init.fam, name: init.name, role: init.role, spec: init.spec ?? 'none',
    stats: { ...init.stats }, level, xp: init.xp ?? 0, sp: init.sp ?? 0,
    hp, maxHp: hp, weapon, mag: WEAPONS[weapon].mag, reload: 0, cd: 0,
    x, y, face: 1, path: [], moving: false,
    stance: init.stance ?? 'defensive', retreat: !init.boss && !init.cop,
    order: { k: 'idle' }, task: null, loc: 'street', bld: -1, car: -1,
    heat: 0, wage: init.wage ?? 0, hero: !!init.hero, boss: !!init.boss, cop: !!init.cop, guard: !!init.guard,
    tag: init.tag ?? '', target: -1, lastHurt: -99, lastShot: -99, lastAttacker: -1, bail: 0,
    rosterId: init.rosterId ?? '', kills: 0, xpGain: 0, repath: 0, behavior: null, heldBy: '', intel: 0, grab: 0, leader: -1, trial: null,
  };
}

export function randomStats(rng: Rng, lo: number, hi: number): Stats {
  return { muscle: rng.int(lo, hi), aim: rng.int(lo, hi), charm: rng.int(1, Math.max(1, hi - 1)), stealth: rng.int(1, hi) };
}

export function soldierInit(rng: Rng, fam: FamId, lo: number, hi: number, weapon?: WeaponId): UnitInit {
  const stats = randomStats(rng, lo, hi);
  const w: WeaponId = weapon ?? (rng.chance(0.08 + hi * 0.04) ? rng.pick(['shotgun', 'dual', 'rifle'] as WeaponId[]) : 'revolver');
  return { fam, name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, role: 'Soldier', stats, weapon: w, level: Math.max(1, Math.floor((lo + hi) / 3)), stance: 'aggressive' };
}

export function genAd(rng: Rng, day: number): Ad {
  const total = ROLES.reduce((a, r) => a + r.weight, 0);
  let roll = rng.next() * total;
  let role = ROLES[0];
  for (const r of ROLES) { roll -= r.weight; if (roll <= 0) { role = r; break; } }
  const bump = Math.min(2, Math.floor(day / 4));
  const st = (k: keyof Stats) => Math.min(STAT_CAP, rng.int(role.ranges[k][0], role.ranges[k][1]) + (rng.chance(0.3) ? bump : 0));
  const stats: Stats = { muscle: st('muscle'), aim: st('aim'), charm: st('charm'), stealth: st('stealth') };
  const sum = stats.muscle + stats.aim + stats.charm + stats.stealth;
  const specBonus = role.spec === 'none' ? 0 : 60;
  return {
    id: Math.floor(rng.next() * 1e9).toString(36),
    name: `${rng.pick(NICK)} ${rng.pick(LAST)}`,
    role: role.role, spec: role.spec, blurb: rng.pick(role.blurb), stats, weapon: role.weapon,
    fee: Math.round((40 + sum * 14 + specBonus) / 5) * 5,
    wage: Math.round(4 + sum * 1.6 + specBonus / 15),
  };
}

/** Adds xp and handles level-ups. Returns number of levels gained. */
export function grantXp(u: Unit, amount: number): number {
  u.xp += amount;
  u.xpGain += amount;
  let gained = 0;
  while (u.xp >= u.level * XP_PER_LEVEL) {
    u.xp -= u.level * XP_PER_LEVEL;
    u.level++;
    u.sp++;
    u.maxHp += 6;
    u.hp = Math.min(u.maxHp, u.hp + 6);
    gained++;
  }
  return gained;
}

export function spendSkillPoint(u: { sp: number; stats: Stats; maxHp?: number }, stat: keyof Stats): boolean {
  if (u.sp <= 0 || u.stats[stat] >= STAT_CAP) return false;
  u.sp--;
  u.stats[stat]++;
  if (stat === "muscle" && u.maxHp !== undefined) u.maxHp += 12;
  return true;
}
