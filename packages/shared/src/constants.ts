// Tuning constants shared by client, server and tests.

/** Seconds of simulated time per tick. */
export const DT = 0.1;
/** Simulated seconds per in-game hour (1× speed). A full day is 4 minutes. */
export const HOUR = 10;
export const NIGHT_START = 20;
export const NIGHT_END = 6;
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;

export const WALK_SPEED = 1.7;
export const COP_SPEED = 1.9;
export const SIGHT = 7.5;
export const NIGHT_SIGHT = 5.5;
export const BUILDING_SIGHT = 4.5;

export const HEAT_WANTED = 50;
export const MAX_HEAT = 100;

/** Map geometry: every block is BLOCK tiles wide, separated by ROAD-wide streets. */
export const BLOCK = 6;
export const ROAD = 2;
export const PERIOD = BLOCK + ROAD;

export const XP_PER_LEVEL = 100;
export const STAT_CAP = 10;

export const TILE_ROAD = 0;
export const TILE_LOT = 1;
export const TILE_PARK = 2;
export const TILE_WATER = 3;
export const TILE_PLAZA = 4;

export function isNight(hour: number): boolean {
  return hour >= NIGHT_START || hour < NIGHT_END;
}
export function isOpen(hour: number): boolean {
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}
/** 0 at noon, 1 at midnight, smooth dusk/dawn. Used for lighting. */
export function nightFactor(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h <= 18.5) return 0;
  if (h > 18.5 && h < 21) return (h - 18.5) / 2.5;
  if (h >= 21 || h <= 5) return 1;
  return 1 - (h - 5) / 2; // 5..7 dawn
}
