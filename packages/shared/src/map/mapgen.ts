// Turns a compact block layout into a tile map plus a list of building lots.
//
// The city is a grid of square blocks (6×6 tiles) separated by 2-tile streets.
// A block is either one big lot ("f:bank") or four 3×3 lots ("q:a,b,c,d" in NW, NE, SW, SE order).
// Lot spec: type[@owner][#tag][*floors][!Custom Name], e.g. "bakery@P#hq*2!Corrado Bakery".

import { BLOCK, PERIOD, ROAD, TILE_LOT, TILE_PARK, TILE_PLAZA, TILE_ROAD, TILE_WATER } from '../constants';
import { Rng } from '../rng';
import type { BType, Pt } from '../types';
import { BTYPES } from '../data/buildings';

export interface LotInfo {
  type: BType;
  owner: string | null;
  tag: string;
  floors: number;
  name: string;
  x: number;
  y: number;
  size: number;
  side: 'N' | 'S' | 'E' | 'W';
  door: Pt;
  street: string;
}

export interface MapData {
  w: number;
  h: number;
  bw: number;
  bh: number;
  tiles: number[];
  streetsH: string[];
  streetsV: string[];
  lamps: Pt[];
  trees: Pt[];
  lots: LotInfo[];
}

export interface Layout {
  blocks: string[][];
  streetsH: string[];
  streetsV: string[];
  seed: number;
}

const LOT_RE = /^([a-z-]+)(?:@(\w+))?(?:#([\w-]+))?(?:\*(\d))?(?:!(.+))?$/;

export function parseLot(spec: string): { type: BType; owner: string | null; tag: string; floors: number; name: string } {
  const m = LOT_RE.exec(spec.trim());
  if (!m) throw new Error('Bad lot spec: ' + spec);
  let t = m[1] === '-' ? 'tenement' : m[1];
  if (!(t in BTYPES)) throw new Error('Unknown building type: ' + t);
  return { type: t as BType, owner: m[2] ?? null, tag: m[3] ?? '', floors: m[4] ? +m[4] : 0, name: m[5] ?? '' };
}

export function generateMap(layout: Layout): MapData {
  const bh = layout.blocks.length;
  const bw = layout.blocks[0].length;
  const w = bw * PERIOD + ROAD;
  const h = bh * PERIOD + ROAD;
  const tiles = new Array<number>(w * h).fill(TILE_ROAD);
  const lots: LotInfo[] = [];
  const rng = new Rng(layout.seed);
  const streetH = (i: number) => layout.streetsH[i % layout.streetsH.length];
  const streetV = (i: number) => layout.streetsV[i % layout.streetsV.length];

  const fill = (x: number, y: number, s: number, v: number) => {
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) tiles[(y + j) * w + x + i] = v;
  };

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const spec = layout.blocks[by][bx].trim();
      const ox = bx * PERIOD + ROAD;
      const oy = by * PERIOD + ROAD;
      const place = (lotSpec: string, x: number, y: number, size: number, sides: ('N' | 'S' | 'E' | 'W')[]) => {
        const p = parseLot(lotSpec);
        if (p.type === 'park') { fill(x, y, size, TILE_PARK); return; }
        if (p.type === 'plaza') { fill(x, y, size, TILE_PLAZA); return; }
        if (p.type === 'water') { fill(x, y, size, TILE_WATER); return; }
        fill(x, y, size, TILE_LOT);
        const pref: ('S' | 'E' | 'W' | 'N')[] = ['S', 'E', 'W', 'N'];
        const side = pref.find((s) => sides.includes(s))!;
        const mid = size / 2;
        let door: Pt;
        let street: string;
        if (side === 'S') { door = { x: x + mid, y: y + size + 0.5 }; street = streetH(by + 1); }
        else if (side === 'N') { door = { x: x + mid, y: y - 0.5 }; street = streetH(by); }
        else if (side === 'E') { door = { x: x + size + 0.5, y: y + mid }; street = streetV(bx + 1); }
        else { door = { x: x - 0.5, y: y + mid }; street = streetV(bx); }
        const def = BTYPES[p.type];
        const floors = p.floors || rng.int(def.floors[0], def.floors[1]) + (size === 6 ? 1 : 0);
        lots.push({ ...p, floors, x, y, size, side, door, street });
      };
      if (spec === 'park' || spec === 'water' || spec === 'plaza') {
        fill(ox, oy, BLOCK, spec === 'park' ? TILE_PARK : spec === 'water' ? TILE_WATER : TILE_PLAZA);
      } else if (spec.startsWith('f:')) {
        place(spec.slice(2), ox, oy, BLOCK, ['N', 'S', 'E', 'W']);
      } else if (spec.startsWith('q:')) {
        const parts = spec.slice(2).split(',');
        if (parts.length !== 4) throw new Error('Quad block needs 4 lots: ' + spec);
        const half = BLOCK / 2;
        place(parts[0], ox, oy, half, ['N', 'W']);
        place(parts[1], ox + half, oy, half, ['N', 'E']);
        place(parts[2], ox, oy + half, half, ['S', 'W']);
        place(parts[3], ox + half, oy + half, half, ['S', 'E']);
      } else {
        throw new Error('Bad block spec: ' + spec);
      }
    }
  }

  // Water blocks swallow the streets that only border water or the map edge, so harbors look right.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tiles[y * w + x] !== TILE_ROAD) continue;
      let water = 0, land = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = tiles[ny * w + nx];
        if (t === TILE_WATER) water++;
        else if (t !== TILE_ROAD) land++;
      }
      if (water >= 6 && land === 0) tiles[y * w + x] = -1;
    }
  }
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === -1) tiles[i] = TILE_WATER;

  const lamps: Pt[] = [];
  for (let by = 0; by <= bh; by++) {
    for (let bx = 0; bx <= bw; bx++) {
      const cx = bx * PERIOD + 1, cy = by * PERIOD + 1;
      for (const [dx, dy] of [[-0.85, -0.85], [0.85, 0.85]] as const) {
        const x = cx + 0.0 + dx + 0.0, y = cy + dy;
        const tx = Math.floor(x), ty = Math.floor(y);
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        if (tiles[ty * w + tx] !== TILE_ROAD) continue;
        if ((bx + by) % 2 === 0 || dx > 0) lamps.push({ x, y });
      }
    }
  }
  const trees: Pt[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (tiles[y * w + x] === TILE_PARK && rng.chance(0.45)) trees.push({ x: x + rng.range(0.2, 0.8), y: y + rng.range(0.2, 0.8) });
  }

  return { w, h, bw, bh, tiles, streetsH: layout.streetsH, streetsV: layout.streetsV, lamps, trees, lots };
}

export function tileAt(map: MapData, x: number, y: number): number {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return TILE_LOT;
  return map.tiles[ty * map.w + tx];
}

export function walkable(t: number): boolean {
  return t === TILE_ROAD || t === TILE_PARK || t === TILE_PLAZA;
}

/** Random-ish city layout for Turf War. Families' HQs go in the corners. */
export function turfLayout(seed: number, players: number): Layout {
  const rng = new Rng(seed);
  const N = 6;
  const shops = ['bakery', 'barber', 'laundry', 'diner', 'tailor', 'grocer', 'pawn', 'garage', '-', '-'];
  const big = ['warehouse', 'club', 'hotel', 'casino'];
  const blocks: string[][] = [];
  const fams = ['A', 'B', 'C', 'D'].slice(0, Math.max(2, players));
  const corners: Record<string, [number, number]> = { A: [0, N - 1], B: [N - 1, 0], C: [0, 0], D: [N - 1, N - 1] };
  for (let by = 0; by < N; by++) {
    const row: string[] = [];
    for (let bx = 0; bx < N; bx++) {
      const fam = fams.find((f) => corners[f][0] === bx && corners[f][1] === by);
      if (fam) {
        row.push(`q:hq@${fam}#hq-${fam},${rng.pick(shops)}@${fam},${rng.pick(shops)}@${fam},garage`);
        continue;
      }
      if (bx === 2 && by === 2) { row.push('f:precinct'); continue; }
      if (bx === 3 && by === 3) { row.push('f:bank#bank'); continue; }
      if (bx === 3 && by === 2) { row.push('q:cityhall,courthouse,casino,club'); continue; }
      if (bx === 2 && by === 3) { row.push('park'); continue; }
      if (rng.chance(0.12)) { row.push('f:' + rng.pick(big)); continue; }
      if (by === N - 1 && bx === 2) { row.push('q:pier,water,warehouse,water'); continue; }
      const q = [0, 1, 2, 3].map(() => (rng.chance(0.12) ? rng.pick(big) : rng.pick(shops)));
      if (rng.chance(0.15)) q[rng.int(0, 3)] = 'park';
      row.push('q:' + q.join(','));
    }
    blocks.push(row);
  }
  return {
    blocks,
    seed,
    streetsH: ['Canal St', 'Mercer St', 'Larkin Ave', 'Orchard St', 'Foundry St', 'Dockside Rd', 'Bishop St'],
    streetsV: ['1st Ave', 'Kettle Ln', 'Market St', 'Harbor Way', 'Union Ave', 'Elm St', 'Quarry Rd'],
  };
}
