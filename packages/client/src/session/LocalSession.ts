// Runs the simulation in the browser (campaign).

import { DT, HOUR, type Command, type MapData, type ViewState, type World } from '@bg/shared';
import type { Session } from './Session';

export class LocalSession implements Session {
  readonly isNet = false;
  readonly fam = 'P';
  readonly map: MapData;
  speed = 1;
  paused = false;
  skipping = false;
  private acc = 0;
  private skipUntil = 0;
  private skipInterrupt = 0;
  private visCache: Uint8Array | null = null;
  private visTick = -1;

  constructor(public world: World) {
    this.map = world.map;
  }
  view(): ViewState { return this.world.s; }
  vis(): Uint8Array | null {
    if (!this.world.s.fog) return null;
    if (this.visTick !== this.world.s.tick) {
      if (this.visCache === null || this.world.s.tick - this.visTick >= 2 || this.visTick < 0) {
        this.visCache = this.world.visibility(this.fam);
        this.visTick = this.world.s.tick;
      }
    }
    return this.visCache;
  }
  lerpPos(_id: number, x: number, y: number) { return { x, y }; }
  command(cmd: Command): string | null { return this.world.command(this.fam, cmd); }
  setSpeed(n: number) { this.speed = n; this.paused = false; this.skipping = false; }
  togglePause() { this.paused = !this.paused; this.skipping = false; }
  /** Fast-forward to the next dusk (20:00) or dawn (6:00), stopping early if something happens. */
  skip() {
    const s = this.world.s;
    if (this.skipping) { this.skipping = false; return; }
    const night = s.hour >= 20 || s.hour < 6;
    const abs = this.world.absHour();
    let target = Math.floor(abs / 24) * 24 + (night ? 6 : 20);
    if (target <= abs) target += 24;
    if (night && s.hour >= 20) target = Math.floor(abs / 24) * 24 + 24 + 6;
    this.skipUntil = target;
    this.skipInterrupt = s.interrupt;
    this.skipping = true;
    this.paused = false;
  }
  update(dtReal: number) {
    const w = this.world;
    if (this.paused || w.s.result) return;
    if (this.skipping) {
      for (let i = 0; i < 14; i++) {
        w.tick();
        if (w.absHour() >= this.skipUntil || w.s.interrupt !== this.skipInterrupt || w.s.result) { this.skipping = false; break; }
      }
      return;
    }
    this.acc += Math.min(0.1, dtReal) * this.speed;
    let n = 0;
    while (this.acc >= DT && n < 12) { w.tick(); this.acc -= DT; n++; }
    void HOUR;
  }
  destroy() {}
}
