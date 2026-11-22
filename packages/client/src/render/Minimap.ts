// HTML-canvas minimap: the whole district as a diamond, owners, visible units and the camera frame.

import { TILE_LOT, TILE_PARK, TILE_PLAZA, TILE_WATER, type MapData } from '@bg/shared';
import type { Session } from '../session/Session';
import type { WorldRenderer } from './WorldRenderer';

export class Minimap {
  cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private scale = 1;
  private t = 0;

  constructor(private map: MapData, private sess: Session, private r: WorldRenderer, host: HTMLElement) {
    this.cv = document.createElement('canvas');
    this.cv.className = 'minimap';
    host.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    const size = 168;
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = size * dpr;
    this.cv.height = (size / 2 + 8) * dpr;
    this.cv.style.width = size + 'px';
    this.cv.style.height = size / 2 + 8 + 'px';
    this.scale = (size * dpr) / (map.w + map.h);
    this.base = document.createElement('canvas');
    this.base.width = this.cv.width; this.base.height = this.cv.height;
    const b = this.base.getContext('2d')!;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const t = map.tiles[y * map.w + x];
      b.fillStyle = t === TILE_LOT ? '#3c3a36' : t === TILE_PARK ? '#2f4a2a' : t === TILE_WATER ? '#163040' : t === TILE_PLAZA ? '#5a5548' : '#202226';
      this.diamond(b, x, y, 1);
      b.fill();
    }
    const down = (e: PointerEvent) => { e.stopPropagation(); this.jump(e); };
    this.cv.addEventListener('pointerdown', (e) => { down(e); this.cv.setPointerCapture(e.pointerId); });
    this.cv.addEventListener('pointermove', (e) => { if (e.buttons) this.jump(e); });
  }
  private P(x: number, y: number) { return { x: (x - y + this.map.h) * this.scale, y: (x + y) * this.scale * 0.5 + 4 }; }
  private diamond(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const a = this.P(x, y), b = this.P(x + s, y), d = this.P(x + s, y + s), e = this.P(x, y + s);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath();
  }
  private jump(e: PointerEvent) {
    const rect = this.cv.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * this.cv.width;
    const py = ((e.clientY - rect.top) / rect.height) * this.cv.height;
    const a = px / this.scale - this.map.h, b = ((py - 4) / this.scale) * 2;
    this.r.centerOnTile((a + b) / 2, (b - a) / 2);
  }
  update(dt: number) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.25;
    const c = this.ctx, view = this.sess.view();
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this.base, 0, 0);
    for (const b of view.buildings) {
      const f = b.owner ? view.families[b.owner] : null;
      if (!f && b.type !== 'precinct') continue;
      c.fillStyle = b.type === 'precinct' ? '#4d8cff' : f!.color;
      c.globalAlpha = 0.75;
      this.diamond(c, b.x + 0.4, b.y + 0.4, b.size - 0.8);
      c.fill();
    }
    c.globalAlpha = 1;
    const vis = this.sess.vis();
    if (vis) {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      for (let y = 0; y < this.map.h; y += 1) for (let x = 0; x < this.map.w; x += 1) if (!vis[y * this.map.w + x]) { this.diamond(c, x, y, 1); c.fill(); }
    }
    for (const u of view.units) {
      if (u.loc !== 'street' && u.loc !== 'car') continue;
      const p = this.P(u.x, u.y);
      c.fillStyle = u.cop ? '#9fc0ff' : view.families[u.fam]?.color ?? '#fff';
      c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      if (u.hero || u.boss) { c.strokeStyle = '#ffd36b'; c.strokeRect(p.x - 2.5, p.y - 2.5, 5, 5); }
    }
    for (const v of view.vehicles) {
      if (v.dead) continue;
      const p = this.P(v.x, v.y);
      c.fillStyle = view.families[v.fam]?.color ?? '#ddd';
      c.fillRect(p.x - 3, p.y - 2, 6, 4);
      c.strokeStyle = '#000'; c.lineWidth = 1; c.strokeRect(p.x - 3, p.y - 2, 6, 4);
    }
    const corners = this.r.viewCorners().map((p) => this.P(p.x, p.y));
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(corners[0].x, corners[0].y); for (const p of corners.slice(1)) c.lineTo(p.x, p.y); c.closePath(); c.stroke();
  }
  destroy() { this.cv.remove(); }
}
