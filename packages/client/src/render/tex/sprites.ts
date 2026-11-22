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

/** dir: 0 = +x, 1 = +y, 2 = -x, 3 = -y. A late-1920s motor car: long hood, fenders, running boards. */
export function carFrame(look: CarLook, dir: number): { cv: HTMLCanvasElement; ox: number; oy: number } {
  const W = 128, H = 96;
  const [cv, ctx] = canvas(W * SPRITE_RES, H * SPRITE_RES);
  ctx.scale(SPRITE_RES, SPRITE_RES);
  ctx.lineJoin = 'round';
  const ox = W / 2, oy = H * 0.68;
  const P = (a: number, b: number, z: number): [number, number] => {
    // a = along the car (front positive), b = across; converted to world dx, dy
    let dx: number, dy: number;
    if (dir === 0) { dx = a; dy = b; } else if (dir === 2) { dx = -a; dy = -b; } else if (dir === 1) { dx = -b; dy = a; } else { dx = b; dy = -a; }
    return [ox + (dx - dy) * 32, oy + (dx + dy) * 16 - z];
  };
  const m = look.model;
  const len = m === 'truck' ? 0.8 : m === 'roadster' ? 0.62 : m === 'armored' ? 0.78 : 0.74;
  const wid = m === 'truck' ? 0.32 : m === 'roadster' ? 0.26 : 0.3;
  const body = look.body;
  const chrome = 0xd8d8d0;
  // which side of the car faces the viewer (larger screen y)
  const nearB = P(0, wid, 0)[1] > P(0, -wid, 0)[1] ? wid : -wid;
  const frontVisible = P(len, 0, 0)[1] > P(-len, 0, 0)[1];
  const box = (a0: number, a1: number, b0: number, b1: number, z0: number, z1: number, col: number, topCol?: number) => {
    const corners = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]] as const;
    const faces: { pts: [number, number][]; y: number; c: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const [a, b] = corners[i], [c, d] = corners[(i + 1) % 4];
      const fp: [number, number][] = [P(a, b, z0), P(c, d, z0), P(c, d, z1), P(a, b, z1)];
      const y = (fp[0][1] + fp[1][1]) / 2;
      faces.push({ pts: fp, y, c: shade(col, fp[1][0] - fp[0][0] > 0 ? 0.72 : 0.92) });
    }
    faces.sort((p, q) => p.y - q.y);
    for (const f of faces.slice(2)) poly(ctx, f.pts, css(f.c));
    poly(ctx, corners.map(([a, b]) => P(a, b, z1)), css(topCol ?? shade(col, 1.1)));
  };
  const wheel = (a: number, b: number) => {
    const p = P(a, b, 5.5);
    ctx.fillStyle = '#0e0e0e'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 6.2, 5.2, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e8e4da'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(p[0], p[1], 4.2, 3.4, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = css(chrome); ctx.beginPath(); ctx.ellipse(p[0], p[1], 1.6, 1.3, 0, 0, 7); ctx.fill();
  };
  const fender = (a: number, b: number) => {
    // a curved mudguard over the wheel, in body colour
    ctx.strokeStyle = css(shade(body, 0.8)); ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) { const t = -0.16 + (0.32 * k) / 8; const q = P(a + t, b, 6 + Math.cos((t / 0.16) * (Math.PI / 2)) * 6); if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke();
  };
  // shadow
  poly(ctx, [P(-len - 0.08, -wid - 0.1, 0), P(len + 0.1, -wid - 0.1, 0), P(len + 0.1, wid + 0.12, 0), P(-len - 0.08, wid + 0.12, 0)], 'rgba(0,0,0,0.4)');
  const wa = [-len * 0.62, len * 0.6];
  // far wheels
  for (const a of wa) wheel(a, -nearB);
  // running boards + chassis
  box(-len * 0.7, len * 0.6, -wid - 0.06, wid + 0.06, 4.5, 6, 0x1e1e1e);
  if (m === 'truck') {
    box(-len, -len * 0.05, -wid, wid, 6, 30, 0xe6dcc0, 0xd8ccb0);          // bakery box
    box(-len * 0.05, len * 0.35, -wid * 0.92, wid * 0.92, 6, 24, body);   // cab
    poly(ctx, [P(len * 0.3, nearB * 0.93, 15), P(-len * 0.0, nearB * 0.93, 15), P(-len * 0.0, nearB * 0.93, 22), P(len * 0.3, nearB * 0.93, 22)], 'rgba(40,52,64,0.9)');
    box(len * 0.35, len, -wid * 0.6, wid * 0.6, 6, 15, body);            // hood
    // lettering on the box side
    const q = P(-len * 0.52, nearB + 0.001, 19);
    ctx.save(); ctx.translate(q[0], q[1]); ctx.transform(1, (P(1, nearB, 0)[1] - P(0, nearB, 0)[1]) / (P(1, nearB, 0)[0] - P(0, nearB, 0)[0] || 1), 0, 1, 0, 0);
    ctx.fillStyle = '#7a2a1a'; ctx.font = '900 7px "Libre Franklin"'; ctx.textAlign = 'center'; ctx.fillText('FRESH BREAD', 0, 0);
    ctx.font = '700 4.5px "Libre Franklin"'; ctx.fillText('CORRADO & SON', 0, 6); ctx.restore();
  } else {
    box(-len * 0.95, len * 0.32, -wid, wid, 6, 15, body);                     // body tub
    box(len * 0.32, len * 0.98, -wid * 0.6, wid * 0.6, 6, 14, shade(body, 1.05)); // long hood
    // hood louvres
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 5; k++) { const a = len * (0.45 + k * 0.1); const q1 = P(a, nearB * 0.6, 8), q2 = P(a, nearB * 0.6, 12.5); ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke(); }
    if (m === 'roadster') {
      box(-len * 0.1, -len * 0.02, -wid * 0.9, wid * 0.9, 15, 21, 0x9ab0c0, 0x9ab0c0); // windshield
      box(-len * 0.7, -len * 0.2, -wid * 0.8, wid * 0.8, 15, 18, 0x5a2a1a, 0x6a3a26); // leather seats
    } else {
      const roofCol = m === 'armored' ? shade(body, 0.75) : 0x1c1c1c;
      box(-len * 0.8, len * 0.3, -wid * 0.94, wid * 0.94, 15, 29, m === 'armored' ? shade(body, 0.85) : shade(body, 0.95), roofCol);
      // windows on the near side and the front/back
      const wz0 = 18, wz1 = m === 'armored' ? 22 : 27;
      const nb = nearB * 0.95;
      const panes = m === 'armored' ? [[-0.6, -0.2], [0, 0.22]] : [[-0.72, -0.34], [-0.28, 0.05], [0.09, 0.26]];
      for (const [a0, a1] of panes) poly(ctx, [P(len * a0, nb, wz0), P(len * a1, nb, wz0), P(len * a1, nb, wz1), P(len * a0, nb, wz1)], 'rgba(44,58,72,0.92)');
      const fa = frontVisible ? len * 0.3 + 0.001 : -len * 0.8 - 0.001;
      poly(ctx, [P(fa, -wid * 0.75, wz0), P(fa, wid * 0.75, wz0), P(fa, wid * 0.75, wz1), P(fa, -wid * 0.75, wz1)], 'rgba(44,58,72,0.92)');
      // a highlight on the glass
      const g0 = P(len * -0.2, nb, wz1 - 1), g1 = P(len * -0.05, nb, wz0 + 1);
      ctx.strokeStyle = 'rgba(200,220,240,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]); ctx.stroke();
      if (m === 'armored') { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; for (let k = -0.7; k < 0.3; k += 0.18) { const a = P(len * k, nearB, 7), b = P(len * k, nearB, 15); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
      if (m === 'taxi') {
        const q = P(-len * 0.25, 0, 31); ctx.fillStyle = '#f0e0a0'; ctx.fillRect(q[0] - 5, q[1] - 4, 10, 4);
        for (let k = 0; k < 8; k++) { const c = P(-len * 0.9 + k * len * 0.15, nearB, 10); ctx.fillStyle = k % 2 ? '#111' : '#f0d040'; ctx.fillRect(c[0] - 1.5, c[1] - 1.5, 3, 3); }
      }
    }
    // pinstripe along the body
    const s0 = P(-len * 0.95, nearB, 12), s1 = P(len * 0.98, nearB * 0.6, 12);
    ctx.strokeStyle = css(shade(body, 1.5), 0.6); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
    // spare wheel on the back
    const sp = P(-len * 0.98, 0, 13);
    if (!frontVisible) { ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.ellipse(sp[0], sp[1], 5, 4.4, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#e8e4da'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sp[0], sp[1], 3.2, 2.8, 0, 0, 7); ctx.stroke(); }
  }
  // near wheels and fenders
  for (const a of wa) { wheel(a, nearB); fender(a, nearB * 1.02); }
  // radiator grille, bumpers and lamps
  if (frontVisible) {
    const ga = len * 0.98 + 0.002;
    poly(ctx, [P(ga, -wid * 0.42, 6), P(ga, wid * 0.42, 6), P(ga, wid * 0.42, 14), P(ga, -wid * 0.42, 14)], css(chrome));
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.7;
    for (let k = -3; k <= 3; k++) { const a = P(ga, (wid * 0.4 * k) / 3, 7), b = P(ga, (wid * 0.4 * k) / 3, 13); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    const bl = P(len + 0.08, -wid * 0.9, 5), br = P(len + 0.08, wid * 0.9, 5);
    ctx.strokeStyle = css(chrome); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bl[0], bl[1]); ctx.lineTo(br[0], br[1]); ctx.stroke();
    for (const b of [-wid * 0.78, wid * 0.78]) {
      const lamp = P(len * 0.92, b, 15);
      ctx.fillStyle = css(chrome); ctx.beginPath(); ctx.arc(lamp[0], lamp[1], 2.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(lamp[0], lamp[1], 1.9, 0, 7); ctx.fill();
    }
  } else {
    const bl = P(-len - 0.06, -wid * 0.9, 5), br = P(-len - 0.06, wid * 0.9, 5);
    ctx.strokeStyle = css(chrome); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bl[0], bl[1]); ctx.lineTo(br[0], br[1]); ctx.stroke();
    for (const b of [-wid * 0.7, wid * 0.7]) { const q = P(-len * 0.96, b, 10); ctx.fillStyle = '#c0302a'; ctx.beginPath(); ctx.arc(q[0], q[1], 1.6, 0, 7); ctx.fill(); }
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
