// Procedural sprites: people (4 frames), cars (4 directions), lamps, trees, glows.

import { canvas, css, shade } from '../iso';

export const SPRITE_RES = 2;

export interface PersonLook {
  coat: number;
  hat: number;
  pants: number;
  skin: number;
  kind: 'gangster' | 'cop' | 'civ' | 'boss' | 'woman';
}

/** Frames: 0 idle, 1 walk A, 2 walk B, 3 aiming. Facing right; mirror for left. */
export function personFrames(look: PersonLook): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f++) {
    const W = 24, H = 40;
    const [cv, ctx] = canvas(W * SPRITE_RES, H * SPRITE_RES);
    ctx.scale(SPRITE_RES, SPRITE_RES);
    const cx = 12, foot = 37;
    const leg = f === 1 ? 2.5 : f === 2 ? -2.5 : 0;
    // legs
    ctx.fillStyle = css(look.pants);
    if (look.kind === 'woman') {
      ctx.fillStyle = css(look.coat);
      ctx.beginPath(); ctx.moveTo(cx - 5, foot - 12); ctx.lineTo(cx + 5, foot - 12); ctx.lineTo(cx + 6, foot - 4); ctx.lineTo(cx - 6, foot - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = css(look.skin);
      ctx.fillRect(cx - 3 + leg * 0.5, foot - 4, 1.8, 4); ctx.fillRect(cx + 1 - leg * 0.5, foot - 4, 1.8, 4);
    } else {
      ctx.fillRect(cx - 3.5 + leg, foot - 12, 3, 12);
      ctx.fillRect(cx + 0.5 - leg, foot - 12, 3, 12);
    }
    ctx.fillStyle = '#141414';
    ctx.fillRect(cx - 4 + leg, foot - 1.5, 4, 2);
    ctx.fillRect(cx + 0.5 - leg, foot - 1.5, 4, 2);
    // coat / body
    const coat = look.coat;
    const bodyTop = foot - 26;
    ctx.fillStyle = css(coat);
    ctx.beginPath();
    ctx.moveTo(cx - 5.5, bodyTop + 2);
    ctx.lineTo(cx + 5.5, bodyTop + 2);
    ctx.lineTo(cx + 6.5, foot - (look.kind === 'cop' ? 11 : 9));
    ctx.lineTo(cx - 6.5, foot - (look.kind === 'cop' ? 11 : 9));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = css(shade(coat, 0.7));
    ctx.fillRect(cx + 2, bodyTop + 2, 3.5, foot - 9 - bodyTop - 2);
    // lapel / tie
    if (look.kind !== 'woman') {
      ctx.fillStyle = '#e8e2d4';
      ctx.beginPath(); ctx.moveTo(cx - 1.5, bodyTop + 2); ctx.lineTo(cx + 1.5, bodyTop + 2); ctx.lineTo(cx, bodyTop + 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = look.kind === 'cop' ? '#1a2240' : look.kind === 'boss' ? '#c9a23a' : '#6a1a1a';
      ctx.fillRect(cx - 0.6, bodyTop + 3, 1.2, 5);
    }
    if (look.kind === 'cop') {
      ctx.fillStyle = '#d8c070';
      ctx.fillRect(cx - 4, bodyTop + 5, 1.6, 1.6); // badge
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx - 6, foot - 13, 12.5, 1.6); // belt
    }
    // arms
    ctx.fillStyle = css(shade(coat, 0.85));
    if (f === 3) {
      ctx.fillRect(cx + 1, bodyTop + 5, 9, 3);
      ctx.fillStyle = css(look.skin); ctx.fillRect(cx + 9.5, bodyTop + 5, 2.2, 3);
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(cx + 10.5, bodyTop + 4.2, 5, 2);
    } else {
      const sw = f === 1 ? 1.5 : f === 2 ? -1.5 : 0;
      ctx.fillRect(cx - 7.5 + sw * 0.4, bodyTop + 3, 2.6, 11);
      ctx.fillRect(cx + 5 - sw * 0.4, bodyTop + 3, 2.6, 11);
      ctx.fillStyle = css(look.skin);
      ctx.fillRect(cx - 7.4 + sw * 0.4, bodyTop + 13.5, 2.4, 2.2);
      ctx.fillRect(cx + 5.1 - sw * 0.4, bodyTop + 13.5, 2.4, 2.2);
    }
    // head
    ctx.fillStyle = css(look.skin);
    ctx.beginPath(); ctx.arc(cx, bodyTop - 2.5, 4, 0, 7); ctx.fill();
    ctx.fillStyle = css(shade(look.skin, 0.75));
    ctx.fillRect(cx + 1.5, bodyTop - 3, 1.2, 1.2);
    // hat
    if (look.kind === 'woman') {
      ctx.fillStyle = css(look.hat);
      ctx.beginPath(); ctx.ellipse(cx, bodyTop - 5.5, 5.5, 2.8, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 6, bodyTop - 5.5, 12, 1.4);
    } else if (look.kind === 'cop') {
      ctx.fillStyle = '#1a2240';
      ctx.fillRect(cx - 4.5, bodyTop - 9.5, 9, 4.5);
      ctx.fillStyle = '#0e1428'; ctx.fillRect(cx - 2, bodyTop - 5.5, 8, 1.5);
      ctx.fillStyle = '#d8c070'; ctx.fillRect(cx - 1, bodyTop - 8.5, 2, 2);
    } else {
      ctx.fillStyle = css(look.hat);
      ctx.fillRect(cx - 6.5, bodyTop - 5.8, 13, 1.8); // brim
      ctx.fillRect(cx - 4, bodyTop - 10, 8, 4.5); // crown
      ctx.fillStyle = look.kind === 'boss' ? '#c9a23a' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(cx - 4, bodyTop - 7, 8, 1.2); // band
    }
    out.push(cv);
  }
  return out;
}

/** A body lying on the ground. */
export function corpse(coat: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(40 * SPRITE_RES, 20 * SPRITE_RES);
  ctx.scale(SPRITE_RES, SPRITE_RES);
  ctx.fillStyle = 'rgba(110,10,10,0.75)';
  ctx.beginPath(); ctx.ellipse(22, 13, 12, 4.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = css(coat);
  ctx.fillRect(10, 9, 16, 5);
  ctx.fillStyle = '#222'; ctx.fillRect(26, 9.5, 8, 4);
  ctx.fillStyle = '#d8b090'; ctx.beginPath(); ctx.arc(7, 11.5, 3, 0, 7); ctx.fill();
  ctx.fillStyle = '#151515'; ctx.fillRect(2, 13, 6, 1.6);
  return cv;
}

// ---------- vehicles ----------
export interface CarLook { body: number; model: 'roadster' | 'sedan' | 'truck' | 'armored' | 'taxi' }

/** dir: 0 = +x, 1 = +y, 2 = -x, 3 = -y */
export function carFrame(look: CarLook, dir: number): { cv: HTMLCanvasElement; ox: number; oy: number } {
  const W = 96, H = 72;
  const [cv, ctx] = canvas(W * SPRITE_RES, H * SPRITE_RES);
  ctx.scale(SPRITE_RES, SPRITE_RES);
  const ox = W / 2, oy = H * 0.66;
  const along = dir === 0 || dir === 2;
  const P = (a: number, b: number, z: number): [number, number] => {
    // a = along car length (front positive), b = across; convert to world dx, dy
    let dx: number, dy: number;
    if (dir === 0) { dx = a; dy = b; } else if (dir === 2) { dx = -a; dy = -b; } else if (dir === 1) { dx = -b; dy = a; } else { dx = b; dy = -a; }
    return [ox + (dx - dy) * 32, oy + (dx + dy) * 16 - z];
  };
  void along;
  const len = look.model === 'truck' ? 0.62 : look.model === 'roadster' ? 0.5 : 0.56;
  const wid = look.model === 'truck' ? 0.27 : 0.24;
  const body = look.body;
  const drawBox = (a0: number, a1: number, b0: number, b1: number, z0: number, z1: number, col: number, glass = false) => {
    const corners = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]] as const;
    const pts = corners.map(([a, b]) => P(a, b, z1));
    // side faces: draw all 4 sides, back-to-front by screen y
    const faces: { pts: [number, number][]; y: number; c: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const [a, b] = corners[i], [c, d] = corners[(i + 1) % 4];
      const fp: [number, number][] = [P(a, b, z0), P(c, d, z0), P(c, d, z1), P(a, b, z1)];
      const y = (fp[0][1] + fp[1][1]) / 2;
      const nx = fp[1][0] - fp[0][0];
      faces.push({ pts: fp, y, c: shade(col, nx > 0 ? 0.7 : 0.9) });
    }
    faces.sort((p, q) => p.y - q.y);
    for (const f of faces.slice(2)) poly(ctx, f.pts, glass ? css(0x34404c) : css(f.c));
    poly(ctx, pts, css(shade(col, 1.08)));
  };
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  poly(ctx, [P(-len - 0.05, -wid - 0.05, 0), P(len + 0.08, -wid - 0.05, 0), P(len + 0.08, wid + 0.08, 0), P(-len - 0.05, wid + 0.08, 0)], 'rgba(0,0,0,0.35)');
  // wheels
  ctx.fillStyle = '#111';
  for (const a of [-len * 0.6, len * 0.6]) for (const b of [-wid, wid]) { const p = P(a, b, 3); ctx.beginPath(); ctx.ellipse(p[0], p[1], 4, 3, 0, 0, 7); ctx.fill(); }
  if (look.model === 'truck') {
    drawBox(-len, len * 0.25, -wid, wid, 4, 26, 0xd8cfb8);
    drawBox(len * 0.25, len, -wid * 0.9, wid * 0.9, 4, 14, body);
    drawBox(len * 0.3, len * 0.85, -wid * 0.85, wid * 0.85, 14, 22, shade(body, 0.9));
  } else {
    drawBox(-len, len, -wid, wid, 4, 12, body);
    if (look.model === 'roadster') drawBox(-len * 0.55, len * 0.05, -wid * 0.85, wid * 0.85, 12, 17, 0x2a2a2a);
    else drawBox(-len * 0.6, len * 0.3, -wid * 0.9, wid * 0.9, 12, 21, look.model === 'armored' ? shade(body, 0.8) : shade(body, 0.95));
    if (look.model === 'armored') { ctx.strokeStyle = 'rgba(255,255,255,0.15)'; for (let k = -0.5; k < 0.6; k += 0.25) { const a = P(k, wid, 6), b = P(k, wid, 11); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
    if (look.model === 'taxi') { const p = P(-len * 0.15, 0, 23); ctx.fillStyle = '#222'; ctx.fillRect(p[0] - 4, p[1] - 3, 8, 3); }
  }
  // windows: dark strip on the cabin
  if (look.model !== 'truck' && look.model !== 'roadster') {
    for (const b of [-wid * 0.91, wid * 0.91]) {
      poly(ctx, [P(-len * 0.5, b, 13.5), P(len * 0.22, b, 13.5), P(len * 0.22, b, 19.5), P(-len * 0.5, b, 19.5)], 'rgba(40,52,64,0.85)');
    }
  }
  // headlights / taillights on the front/back
  const hl = P(len + 0.01, -wid * 0.6, 8), hr = P(len + 0.01, wid * 0.6, 8);
  ctx.fillStyle = '#ffe9a8';
  for (const p of [hl, hr]) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.8, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#c0302a';
  for (const p of [P(-len - 0.01, -wid * 0.6, 8), P(-len - 0.01, wid * 0.6, 8)]) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.3, 0, 7); ctx.fill(); }
  if (look.model === 'truck') {
    const p = P(-len * 0.4, wid + 0.001, 16);
    ctx.save(); ctx.translate(p[0], p[1]); ctx.transform(1, dir === 0 || dir === 2 ? 0.5 : -0.5, 0, 1, 0, 0);
    ctx.fillStyle = '#7a2a1a'; ctx.font = '800 6px "Libre Franklin"'; ctx.textAlign = 'center'; ctx.fillText('FRESH BREAD', 0, 0); ctx.restore();
  }
  return { cv, ox, oy };
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------- props ----------
export function lampPost(): HTMLCanvasElement {
  const [cv, ctx] = canvas(16 * SPRITE_RES, 60 * SPRITE_RES);
  ctx.scale(SPRITE_RES, SPRITE_RES);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(8, 57, 5, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1d2226';
  ctx.fillRect(6.8, 14, 2.4, 44);
  ctx.fillRect(5, 54, 6, 4);
  ctx.fillStyle = '#2a3036';
  ctx.beginPath(); ctx.moveTo(3, 12); ctx.lineTo(13, 12); ctx.lineTo(11, 6); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f5e3a0'; ctx.fillRect(5, 7, 6, 5);
  return cv;
}

export function tree(seed: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(44 * SPRITE_RES, 64 * SPRITE_RES);
  ctx.scale(SPRITE_RES, SPRITE_RES);
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(22, 60, 13, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a3424'; ctx.fillRect(20, 38, 4, 22);
  const greens = [0x2f5a32, 0x3a6a3a, 0x4a7a42, 0x2a4a2c];
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = css(greens[Math.floor(r() * greens.length)]);
    ctx.beginPath(); ctx.arc(22 + (r() - 0.5) * 20, 26 + (r() - 0.5) * 20, 7 + r() * 6, 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,220,0.12)';
  ctx.beginPath(); ctx.arc(17, 20, 7, 0, 7); ctx.fill();
  return cv;
}

export function glow(color: string, size = 128): HTMLCanvasElement {
  const [cv, ctx] = canvas(size, size / 2);
  const g = ctx.createRadialGradient(size / 2, size / 4, 0, size / 2, size / 4, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.scale(1, 0.5);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, 7); ctx.fill();
  ctx.restore();
  return cv;
}

export function dot(size = 32): HTMLCanvasElement {
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return cv;
}

export function flag(): HTMLCanvasElement {
  const [cv, ctx] = canvas(20 * SPRITE_RES, 30 * SPRITE_RES);
  ctx.scale(SPRITE_RES, SPRITE_RES);
  ctx.fillStyle = '#222'; ctx.fillRect(1, 2, 1.6, 28);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(2.6, 3); ctx.lineTo(18, 5); ctx.lineTo(15, 9); ctx.lineTo(18, 13); ctx.lineTo(2.6, 13); ctx.closePath(); ctx.fill();
  return cv;
}
