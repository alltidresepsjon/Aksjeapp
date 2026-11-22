// A* path finding on the walkable tile grid, with line-of-sight smoothing.

import { TILE_LOT } from '../constants';
import type { Pt } from '../types';
import { walkable, type MapData } from './mapgen';

class Heap {
  items: number[] = [];
  pri: number[] = [];
  push(item: number, p: number) {
    const a = this.items, q = this.pri;
    a.push(item); q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (q[par] <= q[i]) break;
      [a[par], a[i]] = [a[i], a[par]];
      [q[par], q[i]] = [q[i], q[par]];
      i = par;
    }
  }
  pop(): number {
    const a = this.items, q = this.pri;
    const top = a[0];
    const li = a.pop()!, lp = q.pop()!;
    if (a.length) {
      a[0] = li; q[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && q[l] < q[m]) m = l;
        if (r < a.length && q[r] < q[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [q[m], q[i]] = [q[i], q[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
}

export class PathFinder {
  map: MapData;
  walk: Uint8Array;
  private g: Float32Array;
  private from: Int32Array;
  private seen: Uint32Array;
  private stamp = 0;

  constructor(map: MapData) {
    this.map = map;
    const n = map.w * map.h;
    this.walk = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.walk[i] = walkable(map.tiles[i]) ? 1 : 0;
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.seen = new Uint32Array(n);
  }

  isWalk(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return false;
    return this.walk[ty * this.map.w + tx] === 1;
  }

  /** Nearest walkable tile centre to a point. */
  nearestWalkable(p: Pt): Pt {
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (this.isWalk(tx, ty)) return p;
    for (let r = 1; r < 12; r++) {
      let best: Pt | null = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!this.isWalk(tx + dx, ty + dy)) continue;
        const c = { x: tx + dx + 0.5, y: ty + dy + 0.5 };
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) return best;
    }
    return p;
  }

  /** Straight walkable line between two points (used for smoothing). */
  clearLine(a: Pt, b: Pt): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(d / 0.2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      // keep a small margin from walls so units do not clip corners
      for (const [ox, oy] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) {
        if (!this.isWalk(Math.floor(x + ox), Math.floor(y + oy))) return false;
      }
    }
    return true;
  }

  find(start: Pt, goal: Pt): Pt[] {
    const { w } = this.map;
    const s = this.nearestWalkable(start);
    const gl = this.nearestWalkable(goal);
    const sx = Math.floor(s.x), sy = Math.floor(s.y), gx = Math.floor(gl.x), gy = Math.floor(gl.y);
    if (sx === gx && sy === gy) return [this.isWalk(Math.floor(goal.x), Math.floor(goal.y)) ? { x: goal.x, y: goal.y } : gl];
    this.stamp++;
    const stamp = this.stamp;
    const heap = new Heap();
    const si = sy * w + sx, gi = gy * w + gx;
    this.g[si] = 0; this.from[si] = -1; this.seen[si] = stamp;
    heap.push(si, 0);
    const h = (i: number) => {
      const x = i % w, y = (i / w) | 0;
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    let found = false;
    let iter = 0;
    while (heap.size && iter++ < 20000) {
      const cur = heap.pop();
      if (cur === gi) { found = true; break; }
      const cx = cur % w, cy = (cur / w) | 0;
      const cg = this.g[cur];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!this.isWalk(nx, ny)) continue;
        if (dx && dy && (!this.isWalk(cx + dx, cy) || !this.isWalk(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        const ng = cg + (dx && dy ? 1.414 : 1);
        if (this.seen[ni] === stamp && this.g[ni] <= ng) continue;
        this.seen[ni] = stamp; this.g[ni] = ng; this.from[ni] = cur;
        heap.push(ni, ng + h(ni));
      }
    }
    if (!found) return [];
    const cells: Pt[] = [];
    for (let i = gi; i !== -1; i = this.from[i]) cells.push({ x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5 });
    cells.reverse();
    const endPt = this.isWalk(Math.floor(goal.x), Math.floor(goal.y)) ? { x: goal.x, y: goal.y } : gl;
    cells[cells.length - 1] = endPt;
    // string pulling
    const out: Pt[] = [];
    let anchor: Pt = start;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clearLine(anchor, cells[j])) j--;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    return out;
  }

  /** Line of sight for shooting: blocked by buildings only. */
  sight(a: Pt, b: Pt): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(d / 0.25);
    const { w, h, tiles } = this.map;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const tx = Math.floor(a.x + (b.x - a.x) * t), ty = Math.floor(a.y + (b.y - a.y) * t);
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
      if (tiles[ty * w + tx] === TILE_LOT) return false;
    }
    return true;
  }

  /** How much cover a spot gives: walls next to you. 0..0.5 */
  cover(p: Pt): number {
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = tx + dx, y = ty + dy;
      if (x >= 0 && y >= 0 && x < this.map.w && y < this.map.h && this.map.tiles[y * this.map.w + x] === TILE_LOT) n++;
    }
    return Math.min(0.45, n * 0.25);
  }
}
