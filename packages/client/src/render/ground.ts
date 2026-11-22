// Static ground layer: streets, sidewalks, lane markings, parks, plazas and harbor water.

import { Graphics } from 'pixi.js';
import { PERIOD, ROAD, BLOCK, TILE_LOT, TILE_PARK, TILE_PLAZA, TILE_ROAD, TILE_WATER, type MapData } from '@bg/shared';
import { artRng, shade, toScreen } from './iso';

function diamond(g: Graphics, x0: number, y0: number, x1: number, y1: number) {
  const a = toScreen(x0, y0), b = toScreen(x1, y0), c = toScreen(x1, y1), d = toScreen(x0, y1);
  g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
}

/** A whole block of park (all four corners green). */
export function isParkBlock(map: MapData, bx: number, by: number): boolean {
  const x0 = bx * PERIOD + ROAD, y0 = by * PERIOD + ROAD;
  return [[1, 1], [4, 1], [1, 4], [4, 4], [3, 3]].every(([dx, dy]) => map.tiles[(y0 + dy) * map.w + x0 + dx] === TILE_PARK);
}

export function drawGround(map: MapData): Graphics {
  const g = new Graphics();
  const rnd = artRng(map.w * 7919 + map.h);
  const { w, h, tiles } = map;
  // base: asphalt everywhere
  diamond(g, 0, 0, w, h);
  g.fill({ color: 0x24262a });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = tiles[y * w + x];
    if (t === TILE_ROAD) {
      if (rnd() < 0.35) { diamond(g, x, y, x + 1, y + 1); g.fill({ color: shade(0x2b2d31, 0.92 + rnd() * 0.16) }); }
    } else if (t === TILE_WATER) {
      diamond(g, x, y, x + 1, y + 1); g.fill({ color: shade(0x1d3a4a, 0.95 + rnd() * 0.1) });
    }
  }
  // blocks: sidewalk ring, then lots / parks / plazas
  for (let by = 0; by < map.bh; by++) for (let bx = 0; bx < map.bw; bx++) {
    const x0 = bx * PERIOD + ROAD, y0 = by * PERIOD + ROAD;
    const allWater = tiles[(y0 + 2) * w + x0 + 2] === TILE_WATER && tiles[(y0 + 4) * w + x0 + 4] === TILE_WATER && tiles[y0 * w + x0] === TILE_WATER;
    if (allWater) continue;
    const m = 0.38;
    diamond(g, x0 - m, y0 - m, x0 + BLOCK + m, y0 + BLOCK + m);
    g.fill({ color: 0x6b6962 });
    diamond(g, x0 - m, y0 - m, x0 + BLOCK + m, y0 + BLOCK + m);
    g.stroke({ width: 1.5, color: 0x3a3936, alpha: 0.9 });
    // sidewalk slabs
    for (let i = 0; i <= BLOCK; i++) {
      for (const [ax, ay, bx2, by2] of [[x0 + i, y0 - m, x0 + i, y0], [x0 + i, y0 + BLOCK, x0 + i, y0 + BLOCK + m], [x0 - m, y0 + i, x0, y0 + i], [x0 + BLOCK, y0 + i, x0 + BLOCK + m, y0 + i]]) {
        const a = toScreen(ax, ay), b = toScreen(bx2, by2);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      }
    }
    g.stroke({ width: 1, color: 0x55534d, alpha: 0.8 });
    for (let y = y0; y < y0 + BLOCK; y++) for (let x = x0; x < x0 + BLOCK; x++) {
      const t = tiles[y * w + x];
      if (t === TILE_LOT) { diamond(g, x, y, x + 1, y + 1); g.fill({ color: 0x3a3833 }); }
      else if (t === TILE_PARK) {
        diamond(g, x, y, x + 1, y + 1); g.fill({ color: shade(0x3d5a32, 0.9 + rnd() * 0.2) });
        if (rnd() < 0.3) { const p = toScreen(x + rnd(), y + rnd()); g.ellipse(p.x, p.y, 6 + rnd() * 6, 3 + rnd() * 2).fill({ color: 0x4a6a3a, alpha: 0.7 }); }
      } else if (t === TILE_PLAZA) {
        diamond(g, x, y, x + 1, y + 1); g.fill({ color: (x + y) % 2 ? 0x8a8270 : 0x7e7766 });
      } else if (t === TILE_WATER) {
        diamond(g, x, y, x + 1, y + 1); g.fill({ color: 0x1d3a4a });
      }
    }
    // park paths and fountain on plazas
    const cx = x0 + BLOCK / 2, cy = y0 + BLOCK / 2;
    if (isParkBlock(map, bx, by)) {
      // hedge around the park, a gravel ring walk, paths to the four gates and flower beds
      const circle = (r: number, n = 40) => { const pts: number[] = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const q = toScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r); pts.push(q.x, q.y); } return pts; };
      for (const [a0, a1, b0, b1] of [[x0, cx - 0.28, cy - 0.28, cy + 0.28], [cx + 0.28, x0 + BLOCK, cy - 0.28, cy + 0.28]] as const) { diamond(g, a0, b0, a1, b1); g.fill({ color: 0xa8956a }); }
      for (const [a0, a1, b0, b1] of [[cx - 0.28, cx + 0.28, y0, cy - 0.28], [cx - 0.28, cx + 0.28, cy + 0.28, y0 + BLOCK]] as const) { diamond(g, a0, b0, a1, b1); g.fill({ color: 0xa8956a }); }
      g.poly(circle(2.25)).fill({ color: 0xa8956a });
      g.poly(circle(1.7)).fill({ color: 0x46683a });
      g.poly(circle(0.95)).fill({ color: 0xb8a57a });
      for (const [dx, dy] of [[1.25, 1.25], [-1.25, 1.25], [1.25, -1.25], [-1.25, -1.25]]) {
        const q = toScreen(cx + dx * 0.95, cy + dy * 0.95);
        g.ellipse(q.x, q.y, 16, 8).fill({ color: 0x3a5a2a });
        for (let k = 0; k < 14; k++) g.circle(q.x + (rnd() - 0.5) * 26, q.y + (rnd() - 0.5) * 12, 1.6).fill({ color: [0xd84a5a, 0xf0d060, 0xe890b0, 0xf4f0e8][k % 4] });
      }
      diamond(g, x0 + 0.05, y0 + 0.05, x0 + BLOCK - 0.05, y0 + BLOCK - 0.05);
      g.stroke({ width: 5, color: 0x2a4422, alpha: 0.95 });
    }
    if (tiles[Math.floor(cy) * w + Math.floor(cx)] === TILE_PLAZA) {
      const p = toScreen(cx, cy);
      g.ellipse(p.x, p.y, 46, 23).fill({ color: 0x6a665a });
      g.ellipse(p.x, p.y, 40, 20).fill({ color: 0x3a6a8a });
      g.ellipse(p.x, p.y - 4, 8, 4).fill({ color: 0x9a9480 });
      g.rect(p.x - 3, p.y - 22, 6, 18).fill({ color: 0x9a9480 });
      g.ellipse(p.x, p.y - 22, 9, 4).fill({ color: 0xbfe0ff, alpha: 0.6 });
    }
  }
  // water edge (quay)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (tiles[y * w + x] !== TILE_WATER) continue;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (tiles[ny * w + nx] === TILE_WATER) continue;
      const a = dx === 1 ? toScreen(x + 1, y) : dx === -1 ? toScreen(x, y) : dy === 1 ? toScreen(x, y + 1) : toScreen(x, y);
      const b = dx === 1 ? toScreen(x + 1, y + 1) : dx === -1 ? toScreen(x, y + 1) : dy === 1 ? toScreen(x + 1, y + 1) : toScreen(x + 1, y);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
  }
  g.stroke({ width: 4, color: 0x5a4a3a });
  for (let i = 0; i < w * h * 0.08; i++) {
    const x = rnd() * w, y = rnd() * h;
    if (tiles[Math.floor(y) * w + Math.floor(x)] !== TILE_WATER) continue;
    const p = toScreen(x, y);
    g.moveTo(p.x - 7, p.y).quadraticCurveTo(p.x, p.y - 3, p.x + 7, p.y);
  }
  g.stroke({ width: 1.2, color: 0x6a9ab0, alpha: 0.45 });

  // lane markings and crosswalks
  for (let by = 0; by <= map.bh; by++) {
    const yy = by * PERIOD + 1;
    for (let bx = 0; bx < map.bw; bx++) {
      const xa = bx * PERIOD + ROAD, xb = xa + BLOCK;
      if (tiles[Math.floor(yy) * w + xa + 1] !== TILE_ROAD) continue;
      for (let x = xa + 0.3; x < xb - 0.3; x += 0.7) {
        const a = toScreen(x, yy), b = toScreen(x + 0.35, yy);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      }
    }
  }
  for (let bx = 0; bx <= map.bw; bx++) {
    const xx = bx * PERIOD + 1;
    for (let by = 0; by < map.bh; by++) {
      const ya = by * PERIOD + ROAD, yb = ya + BLOCK;
      if (tiles[(ya + 1) * w + Math.floor(xx)] !== TILE_ROAD) continue;
      for (let y = ya + 0.3; y < yb - 0.3; y += 0.7) {
        const a = toScreen(xx, y), b = toScreen(xx, y + 0.35);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      }
    }
  }
  g.stroke({ width: 1.6, color: 0xc9b46a, alpha: 0.55 });
  for (let by = 0; by <= map.bh; by++) for (let bx = 0; bx <= map.bw; bx++) {
    const ix = bx * PERIOD, iy = by * PERIOD;
    if (tiles[(iy + 1) * w + ix + 1] !== TILE_ROAD) continue;
    for (let k = 0; k < 5; k++) {
      const t = ix + 0.2 + k * 0.38;
      if (iy + ROAD + 0.1 < h) { diamond(g, t, iy + ROAD + 0.05, t + 0.2, iy + ROAD + 0.45); }
      if (iy - 0.45 > 0) { diamond(g, t, iy - 0.45, t + 0.2, iy - 0.05); }
      const u = iy + 0.2 + k * 0.38;
      if (ix + ROAD + 0.1 < w) { diamond(g, ix + ROAD + 0.05, u, ix + ROAD + 0.45, u + 0.2); }
      if (ix - 0.45 > 0) { diamond(g, ix - 0.45, u, ix - 0.05, u + 0.2); }
    }
  }
  g.fill({ color: 0xd8d4c8, alpha: 0.35 });
  // manholes
  for (let i = 0; i < map.w * 0.6; i++) {
    const x = rnd() * w, y = rnd() * h;
    if (tiles[Math.floor(y) * w + Math.floor(x)] !== TILE_ROAD) continue;
    const p = toScreen(x, y);
    g.ellipse(p.x, p.y, 6, 3).fill({ color: 0x1a1b1d, alpha: 0.8 });
  }
  return g;
}
