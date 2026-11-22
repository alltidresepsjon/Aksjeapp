// Cosmetic city life: pedestrians on the sidewalks and traffic on the streets.
// Purely client-side; they scatter when shots are fired.

import { PathFinder, type MapData, type Pt, nightFactor } from '@bg/shared';

export interface Walker { id: number; x: number; y: number; path: Pt[]; face: number; look: number; speed: number; wait: number; panic: number; car: boolean; dir: number; moving: boolean }

export class Ambient {
  walkers: Walker[] = [];
  private pf: PathFinder;
  private n = 0;
  constructor(private map: MapData, people = 26, cars = 7) {
    this.pf = new PathFinder(map);
    for (let i = 0; i < people; i++) this.walkers.push(this.spawn(false));
    for (let i = 0; i < cars; i++) this.walkers.push(this.spawn(true));
  }
  private randomRoad(): Pt {
    for (let k = 0; k < 50; k++) {
      const x = Math.floor(Math.random() * this.map.w), y = Math.floor(Math.random() * this.map.h);
      if (this.pf.isWalk(x, y)) return { x: x + 0.5, y: y + 0.5 };
    }
    return { x: 1, y: 1 };
  }
  private laneTarget(): Pt {
    // traffic keeps to road centre lines
    const p = this.randomRoad();
    const k = 8;
    if (Math.random() < 0.5) return { x: p.x, y: Math.round((p.y - 1) / k) * k + 1 + (Math.random() < 0.5 ? -0.45 : 0.45) };
    return { x: Math.round((p.x - 1) / k) * k + 1 + (Math.random() < 0.5 ? -0.45 : 0.45), y: p.y };
  }
  private spawn(car: boolean): Walker {
    const p = car ? this.laneTarget() : this.randomRoad();
    return { id: -1 - this.n++, x: p.x, y: p.y, path: [], face: 1, look: Math.floor(Math.random() * 8), speed: car ? 3 + Math.random() * 1.5 : 0.7 + Math.random() * 0.5, wait: Math.random() * 3, panic: 0, car, dir: 0, moving: false };
  }
  scare(x: number, y: number) {
    for (const w of this.walkers) {
      if (w.car) continue;
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < 7) {
        w.panic = 6;
        const ax = w.x + (w.x - x) / Math.max(0.5, d) * 6, ay = w.y + (w.y - y) / Math.max(0.5, d) * 6;
        w.path = this.pf.find(w, { x: ax, y: ay });
      }
    }
  }
  update(dt: number, hour: number) {
    const night = nightFactor(hour);
    for (const w of this.walkers) {
      if (w.panic > 0) w.panic -= dt;
      w.moving = false;
      if (!w.path.length) {
        w.wait -= dt;
        if (w.wait > 0) continue;
        // fewer people out at night
        if (!w.car && Math.random() < night * 0.5) { w.wait = 4; continue; }
        const t = w.car ? this.laneTarget() : this.randomRoad();
        w.path = this.pf.find(w, t).slice(0, 12);
        w.wait = w.car ? 0.5 : 1 + Math.random() * 6;
        continue;
      }
      let step = w.speed * (w.panic > 0 ? 2.4 : 1) * dt;
      while (step > 0 && w.path.length) {
        const p = w.path[0];
        const dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy);
        if (d > 1e-4) {
          w.face = dx - dy >= 0 ? 1 : -1;
          w.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
        }
        if (d <= step) { w.x = p.x; w.y = p.y; w.path.shift(); step -= d; }
        else { w.x += (dx / d) * step; w.y += (dy / d) * step; step = 0; }
        w.moving = true;
      }
    }
  }
}
