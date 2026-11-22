// Turf War: 2–4 families in one city, played online.

import { turfLayout } from './map/mapgen';
import { World } from './sim/world';
import type { UnitInit } from './sim/units';
import { Rng } from './rng';
import { FIRST, LAST } from './data/names';

export const TURF_FAMILIES = [
  { id: 'A', name: 'Corrado Family', short: 'Corrado', color: '#3fbf8a' },
  { id: 'B', name: 'Doyle Gang', short: 'Doyle', color: '#e09a3c' },
  { id: 'C', name: 'Kessler Outfit', short: 'Kessler', color: '#e0505f' },
  { id: 'D', name: 'Moretti Clan', short: 'Moretti', color: '#a77be0' },
];

export interface TurfSlot { fam: string; player: string; name: string; human: boolean }

export function buildTurfWorld(slots: TurfSlot[], seed: number, days = 8): World {
  const rng = new Rng(seed);
  const layout = turfLayout(seed, slots.length);
  const families = slots.map((sl) => {
    const base = TURF_FAMILIES.find((f) => f.id === sl.fam)!;
    return {
      ...base, name: sl.human && sl.name ? `${sl.name}'s ${base.short}s` : base.name,
      human: sl.human, player: sl.player, money: 900, aggression: 0.45, cap: 9, statLo: 2, statHi: 4,
    };
  });
  const crew: Record<string, UnitInit[]> = {};
  for (const sl of slots) {
    const don: UnitInit = { fam: sl.fam, name: sl.human && sl.name ? sl.name : `Don ${rng.pick(LAST)}`, role: 'The Don', stats: { muscle: 3, aim: 3, charm: 4, stealth: 3 }, hero: true, weapon: 'revolver', stance: 'defensive' };
    const mk = (role: string, stats: UnitInit['stats'], weapon: UnitInit['weapon'], wage: number): UnitInit => ({ fam: sl.fam, name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`, role, stats, weapon, wage, stance: 'defensive' });
    crew[sl.fam] = [
      don,
      mk('Bruiser', { muscle: 5, aim: 3, charm: 1, stealth: 2 }, 'shotgun', 14),
      mk('Talker', { muscle: 2, aim: 2, charm: 5, stealth: 3 }, 'revolver', 12),
      mk('Gunman', { muscle: 3, aim: 5, charm: 1, stealth: 2 }, 'revolver', 14),
    ];
  }
  return new World({
    mode: 'turf', chapter: 'turf', layout, families, crew, vehicles: slots.map((s) => ({ fam: s.fam, model: 'sedan' as const })),
    npcs: [], objectives: [], script: [], startHour: 8, seed, fog: true, bribeMult: 1,
    news: ['Four families, one city: Port Halloran braces for war'], timeLimitDay: days,
  });
}
