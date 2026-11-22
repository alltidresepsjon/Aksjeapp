// Procedural isometric building art. Each building gets a unique canvas (its sign carries its name),
// plus a matching "lit windows" overlay for night and a burned-out variant.

import type { Building } from '@bg/shared';
import { BTYPES } from '@bg/shared';
import { artRng, canvas, css, FLOOR_H, mix, shade } from '../iso';

export const BUILDING_RES = 1.5;
export const INSET = 0.14;

export interface BuildingArt {
  day: HTMLCanvasElement;
  lit: HTMLCanvasElement;
  /** Anchor: canvas pixel (in logical px) of the footprint's back corner at ground level. */
  ox: number;
  oy: number;
  w: number;
  h: number;
  /** Roof point (relative to anchor) where the ownership flag goes. */
  flag: { x: number; y: number };
  height: number;
}

const FACADES = [0x8a4b3a, 0x7b5a45, 0xb8a382, 0x9a6b4f, 0x6e7680, 0x8f3f36, 0xa58c6a, 0x5f6b5a];
const AWNINGS = [0xb23a3a, 0x2f7a4a, 0x2f5a9a, 0xc9a23a, 0x7a3a8a, 0x2a7a7a];
const NEON = [0xff4fa3, 0x4fd2ff, 0x7dff8a, 0xffb347];

type P3 = (bx: number, by: number, z: number) => [number, number];
type Ctx = CanvasRenderingContext2D;

function poly(ctx: Ctx, pts: [number, number][], fill?: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

interface Face {
  /** point on the face: u along the wall (0..len), z height */
  at: (u: number, z: number) => [number, number];
  len: number;
  /** skew for text drawn flat on the face */
  skew: number;
  /** outward direction for awnings: point slightly in front of the wall */
  out: (u: number, z: number, d: number) => [number, number];
}

function box(ctx: Ctx, P: P3, x0: number, y0: number, z0: number, dx: number, dy: number, dz: number, top: number, left: number, right: number, edge = true) {
  const x1 = x0 + dx, y1 = y0 + dy, z1 = z0 + dz;
  poly(ctx, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], css(left));
  poly(ctx, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], css(right));
  poly(ctx, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], css(top));
  if (edge) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const a = P(x1, y1, z0), b = P(x1, y1, z1);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

function clipFace(ctx: Ctx, f: Face, z0: number, z1: number) {
  ctx.beginPath();
  const pts = [f.at(0, z0), f.at(f.len, z0), f.at(f.len, z1), f.at(0, z1)];
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.clip();
}

function brick(ctx: Ctx, f: Face, H: number, base: number, rnd: () => number, kind: 'brick' | 'stone' | 'metal' | 'wood') {
  ctx.save();
  clipFace(ctx, f, 0, H);
  if (kind === 'metal' || kind === 'wood') {
    for (let u = 0; u < f.len; u += kind === 'metal' ? 0.09 : 0.16) {
      const a = f.at(u, 0), b = f.at(u, H);
      ctx.strokeStyle = css(shade(base, rnd() < 0.5 ? 0.85 : 1.08), 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  } else {
    const step = kind === 'brick' ? 3 : 6;
    for (let z = 2; z < H; z += step) {
      const a = f.at(0, z), b = f.at(f.len, z);
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const n = Math.floor(f.len * H * (kind === 'brick' ? 1.6 : 0.4));
    for (let i = 0; i < n; i++) {
      const u = rnd() * f.len, z = rnd() * H;
      const p = f.at(u, z), q = f.at(u + 0.08, z);
      ctx.strokeStyle = css(shade(base, 0.75 + rnd() * 0.45), 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
  }
  ctx.restore();
}

function quad(ctx: Ctx, f: Face, u0: number, u1: number, z0: number, z1: number, fill: string, stroke?: string) {
  poly(ctx, [f.at(u0, z0), f.at(u1, z0), f.at(u1, z1), f.at(u0, z1)], fill, stroke);
}

function windowsOn(ctx: Ctx, lit: Ctx, f: Face, floors: number, startFloor: number, rnd: () => number, frame: number, tall = 1, litChance = 0.55) {
  const n = Math.max(2, Math.round(f.len * 1.55));
  for (let fl = startFloor; fl < floors; fl++) {
    const z0 = 4 + fl * FLOOR_H + 3, z1 = z0 + 11 * tall;
    for (let i = 0; i < n; i++) {
      const u0 = ((i + 0.22) / n) * f.len, u1 = ((i + 0.78) / n) * f.len;
      quad(ctx, f, u0 - 0.03, u1 + 0.03, z0 - 1.5, z1 + 1.5, css(shade(frame, 1.15)));
      quad(ctx, f, u0, u1, z0, z1, css(0x27313d));
      // sky reflection
      const a = f.at(u0 + (u1 - u0) * 0.15, z1 - 1), b = f.at(u0 + (u1 - u0) * 0.55, z0 + 2);
      ctx.strokeStyle = 'rgba(180,200,220,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      if (rnd() < 0.2) quad(ctx, f, u0, u1, z1 - 4, z1, css(rnd() < 0.5 ? 0xd8cfb8 : 0x9a3a3a)); // curtains
      if (rnd() < litChance) {
        const warm = rnd() < 0.85 ? 0xffd27a : 0xbfe0ff;
        quad(lit, f, u0, u1, z0, z1, css(warm, 0.95));
        quad(lit, f, u0 - 0.06, u1 + 0.06, z0 - 2, z1 + 2, css(warm, 0.18));
      }
    }
  }
}

function sign(ctx: Ctx, lit: Ctx | null, f: Face, u0: number, u1: number, z0: number, z1: number, text: string, bg: number, fg: string, glow?: number) {
  quad(ctx, f, u0, u1, z0, z1, css(bg), 'rgba(0,0,0,0.5)');
  const mid = f.at((u0 + u1) / 2, (z0 + z1) / 2);
  const widthPx = Math.abs(f.at(u1, 0)[0] - f.at(u0, 0)[0]);
  const draw = (c: Ctx, color: string) => {
    c.save();
    c.translate(mid[0], mid[1]);
    c.transform(1, f.skew, 0, 1, 0, 0);
    let size = Math.min(z1 - z0 - 1, 9);
    c.font = `800 ${size}px "Libre Franklin", sans-serif`;
    while (c.measureText(text).width > widthPx * 0.92 && size > 4) { size -= 0.5; c.font = `800 ${size}px "Libre Franklin", sans-serif`; }
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 0, 0.5);
    c.restore();
  };
  draw(ctx, fg);
  if (lit && glow !== undefined) {
    lit.save();
    lit.shadowColor = css(glow);
    lit.shadowBlur = 8;
    draw(lit, css(glow));
    lit.restore();
  }
}

function awning(ctx: Ctx, f: Face, u0: number, u1: number, z: number, color: number) {
  const stripes = Math.max(3, Math.round((u1 - u0) * 8));
  for (let i = 0; i < stripes; i++) {
    const a = u0 + ((u1 - u0) * i) / stripes, b = u0 + ((u1 - u0) * (i + 1)) / stripes;
    const c = i % 2 ? 0xe9e1cc : color;
    poly(ctx, [f.at(a, z), f.at(b, z), f.out(b, z - 7, 0.32), f.out(a, z - 7, 0.32)], css(c));
  }
  poly(ctx, [f.out(u0, z - 7, 0.32), f.out(u1, z - 7, 0.32), f.out(u1, z - 9, 0.32), f.out(u0, z - 9, 0.32)], css(shade(color, 0.7)));
}

function shortName(b: Building): string {
  const n = b.name.toUpperCase();
  return n.length > 22 ? n.replace(/ & .*$/, '').replace(/^THE /, '') : n;
}

export function buildingArt(b: Building): BuildingArt {
  const rnd = artRng(b.seed);
  const def = BTYPES[b.type];
  const look = def.look;
  const s = b.size - INSET * 2;
  const floors = Math.max(1, b.floors);
  const steeple = look === 'church' ? 70 : 0;
  const H = floors * FLOOR_H + 6;
  const top = 70 + steeple;
  const W = s * 64 + 30;
  const Hc = s * 32 + H + top + 8;
  const ox = s * 32 + 15, oy = H + top;
  const [cv, ctx] = canvas(W * BUILDING_RES, Hc * BUILDING_RES);
  const [lcv, lit] = canvas(W * BUILDING_RES, Hc * BUILDING_RES);
  ctx.scale(BUILDING_RES, BUILDING_RES);
  lit.scale(BUILDING_RES, BUILDING_RES);
  ctx.lineJoin = 'round';
  const P: P3 = (bx, by, z) => [ox + (bx - by) * 32, oy + (bx + by) * 16 - z];
  const south: Face = { at: (u, z) => P(u, s, z), len: s, skew: 0.5, out: (u, z, d) => P(u, s + d, z) };
  const east: Face = { at: (u, z) => P(s, s - u, z), len: s, skew: -0.5, out: (u, z, d) => P(s + d, s - u, z) };
  const doorFace = b.side === 'E' ? east : south;
  const otherFace = doorFace === east ? south : east;

  let base = FACADES[b.style % FACADES.length];
  let material: 'brick' | 'stone' | 'metal' | 'wood' = base === 0xb8a382 || base === 0x6e7680 || base === 0xa58c6a ? 'stone' : 'brick';
  let roof = 0x3b3836;
  let trim = shade(base, 1.25);
  if (look === 'hq') { base = 0x6b2f2a; trim = 0xc9a65a; material = 'brick'; }
  if (look === 'bank' || look === 'civic') { base = 0xc9c2b0; trim = 0xe8e2d2; material = 'stone'; roof = 0x6a6a68; }
  if (look === 'precinct') { base = 0x4c5a6e; trim = 0x9fb0c4; material = 'brick'; }
  if (look === 'club') { base = 0x2e2a36; trim = 0x5a4a6a; material = 'stone'; }
  if (look === 'hotel') { base = 0xc7b48e; trim = 0xe9dcc0; material = 'stone'; }
  if (look === 'warehouse') { base = 0x6b6258; trim = 0x8a8076; material = 'metal'; roof = 0x4a4744; }
  if (look === 'garage') { base = 0x9b8b70; trim = 0xc8b898; material = 'brick'; }
  if (look === 'diner') { base = 0xb5c9c4; trim = 0x4f9a94; material = 'metal'; roof = 0x8a9a98; }
  if (look === 'church') { base = 0x8e8a80; trim = 0xb0aca0; material = 'stone'; }
  if (look === 'pier') { base = 0x7a5a3a; trim = 0x9a7a5a; material = 'wood'; roof = 0x5a4a3a; }
  if (look === 'tenement') { base = FACADES[(b.style + 3) % FACADES.length]; material = 'brick'; }

  // shadow on the ground
  ctx.save();
  ctx.globalAlpha = 0.35;
  poly(ctx, [P(0, 0, 0), P(s + 0.35, 0, 0), P(s + 0.35, s + 0.35, 0), P(0, s + 0.35, 0)], '#000');
  ctx.restore();
  if (look === 'pier') {
    const m = INSET;
    poly(ctx, [P(-m, -m, 1), P(s + m, -m, 1), P(s + m, s + m, 1), P(-m, s + m, 1)], css(0x6a4e32));
    for (let u = -m; u < s + m; u += 0.18) {
      const a = P(u, -m, 1), c = P(u, s + m, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    }
  }

  const bodyS = look === 'pier' ? s * 0.6 : s;
  const off = look === 'pier' ? s * 0.2 : 0;
  const leftC = shade(base, 0.92), rightC = shade(base, 0.68);
  if (look === 'pier') {
    box(ctx, P, off, off, 0, bodyS, bodyS, H, roof, leftC, rightC);
  } else {
    box(ctx, P, 0, 0, 0, s, s, H, roof, leftC, rightC);
    brick(ctx, south, H, leftC, rnd, material);
    brick(ctx, east, H, rightC, rnd, material);
  }

  // cornice + base course
  if (look !== 'pier' && look !== 'diner') {
    for (const f of [south, east]) {
      quad(ctx, f, 0, f.len, H - 4, H, css(shade(trim, f === south ? 0.95 : 0.72)));
      quad(ctx, f, 0, f.len, 0, 3, css(shade(base, f === south ? 0.6 : 0.45)));
      if (floors > 1) quad(ctx, f, 0, f.len, FLOOR_H + 2, FLOOR_H + 4, css(shade(trim, f === south ? 0.85 : 0.65), 0.9));
    }
  }

  const frame = shade(trim, 0.9);
  // ---- facades by look ----
  if (look === 'pier') {
    const f: Face = { at: (u, z) => P(off + u, off + bodyS, z), len: bodyS, skew: 0.5, out: (u, z, d) => P(off + u, off + bodyS + d, z) };
    quad(ctx, f, bodyS * 0.35, bodyS * 0.65, 0, 14, css(0x2a1e14));
    sign(ctx, lit, f, 0.05, bodyS - 0.05, 15, 22, b.name.toUpperCase(), 0x2a2016, '#e8d8a8', 0xffd27a);
    quad(lit, f, bodyS * 0.38, bodyS * 0.62, 4, 12, css(0xffc060, 0.7));
  } else {
    windowsOn(ctx, lit, otherFace, floors, look === 'warehouse' || look === 'garage' ? floors : 1, rnd, frame, look === 'hotel' ? 0.9 : 1);
    windowsOn(ctx, lit, doorFace, floors, 1, rnd, frame, look === 'hotel' ? 0.9 : 1);
    if (look !== 'warehouse' && look !== 'garage') windowsOn(ctx, lit, otherFace, 1, 0, rnd, frame, 1, 0.4);
    const f = doorFace;
    const L = f.len;
    const mid = L / 2;
    const gz = FLOOR_H; // ground floor height
    if (look === 'shop' || look === 'tenement' || look === 'hq') {
      // display windows + door
      quad(ctx, f, 0.15, mid - 0.3, 3, gz - 6, css(0x2c3844), css(frame));
      quad(ctx, f, mid + 0.3, L - 0.15, 3, gz - 6, css(0x2c3844), css(frame));
      quad(lit, f, 0.15, mid - 0.3, 3, gz - 6, css(0xffd890, 0.85));
      quad(lit, f, mid + 0.3, L - 0.15, 3, gz - 6, css(0xffd890, 0.85));
      quad(ctx, f, mid - 0.2, mid + 0.2, 0, gz - 4, css(0x3a2418), css(frame));
      if (look === 'hq') {
        quad(ctx, f, mid - 0.32, mid - 0.26, 0, gz + 2, css(trim));
        quad(ctx, f, mid + 0.26, mid + 0.32, 0, gz + 2, css(trim));
        sign(ctx, lit, f, 0.12, L - 0.12, gz - 3, gz + 4, shortName(b), 0x2a1410, '#e8c870', 0xffd27a);
      } else if (look === 'shop') {
        awning(ctx, f, 0.1, L - 0.1, gz - 4, AWNINGS[(b.style + b.id) % AWNINGS.length]);
        sign(ctx, lit, f, 0.1, L - 0.1, gz - 2, gz + 5, shortName(b), shade(base, 0.45), '#f0e6cc', 0xffe0a0);
      }
    } else if (look === 'club') {
      const neon = NEON[b.style % NEON.length];
      quad(ctx, f, mid - 0.3, mid + 0.3, 0, gz - 3, css(0x1a0f18), css(0x8a6a3a));
      quad(lit, f, mid - 0.3, mid + 0.3, 0, gz - 3, css(neon, 0.35));
      sign(ctx, lit, f, 0.1, L - 0.1, gz - 1, gz + 8, shortName(b), 0x15101a, css(neon), neon);
      for (let u = 0.15; u < L - 0.1; u += 0.12) { const p = f.at(u, gz + 9); ctx.fillStyle = '#e8d8a0'; ctx.fillRect(p[0] - 0.8, p[1] - 0.8, 1.6, 1.6); lit.fillStyle = '#fff2b0'; lit.beginPath(); lit.arc(p[0], p[1], 1.6, 0, 7); lit.fill(); }
    } else if (look === 'hotel') {
      quad(ctx, f, mid - 0.35, mid + 0.35, 0, gz - 4, css(0x2c2018), css(trim));
      quad(lit, f, mid - 0.35, mid + 0.35, 0, gz - 4, css(0xffd890, 0.8));
      awning(ctx, f, mid - 0.5, mid + 0.5, gz - 2, 0x7a2a2a);
      // vertical blade sign
      const p0 = f.at(L * 0.85, H - 6), p1 = f.out(L * 0.85, H - 6, 0.25), p2 = f.out(L * 0.85, gz + 8, 0.25), p3 = f.at(L * 0.85, gz + 8);
      poly(ctx, [p0, p1, p2, p3], css(0x6a1a1a));
      ctx.save(); ctx.fillStyle = '#f5e3b0'; ctx.font = '700 7px "Libre Franklin"'; ctx.textAlign = 'center';
      const letters = 'HOTEL';
      for (let i = 0; i < letters.length; i++) { const t = (i + 0.7) / letters.length; ctx.fillText(letters[i], (p1[0] + p0[0]) / 2, p0[1] + (p3[1] - p0[1]) * t); }
      ctx.restore();
      lit.save(); lit.globalAlpha = 0.5; poly(lit, [p0, p1, p2, p3], css(0xff6a4a)); lit.restore();
    } else if (look === 'bank' || look === 'civic') {
      const cols = Math.round(L * 2.2);
      quad(ctx, f, 0.05, L - 0.05, gz * 1.6, gz * 1.6 + 5, css(shade(trim, 0.9)));
      for (let i = 0; i < cols; i++) {
        const u = 0.15 + (i * (L - 0.3)) / (cols - 1);
        quad(ctx, f, u - 0.06, u + 0.06, 2, gz * 1.6, css(shade(trim, i % 2 ? 1 : 0.92)));
      }
      quad(ctx, f, mid - 0.22, mid + 0.22, 0, gz, css(0x2a2620), css(0x8a7a5a));
      const label = b.type === 'courthouse' ? 'HALL OF JUSTICE' : b.type === 'cityhall' ? 'CITY HALL' : shortName(b);
      sign(ctx, null, f, 0.15, L - 0.15, gz * 1.6 + 6, gz * 1.6 + 13, label, 0xd8d0bc, '#3a3226');
      // steps
      for (let k = 0; k < 3; k++) poly(ctx, [f.out(0.1 + k * 0.05, k * 1.5, 0.3 - k * 0.1), f.out(L - 0.1 - k * 0.05, k * 1.5, 0.3 - k * 0.1), f.out(L - 0.1 - k * 0.05, k * 1.5 + 1.5, 0.3 - k * 0.1), f.out(0.1 + k * 0.05, k * 1.5 + 1.5, 0.3 - k * 0.1)], css(shade(0xbab2a0, 1 - k * 0.06)));
    } else if (look === 'precinct') {
      quad(ctx, f, mid - 0.3, mid + 0.3, 0, gz - 2, css(0x1e2430), css(0x9fb0c4));
      sign(ctx, lit, f, 0.2, L - 0.2, gz, gz + 7, 'POLICE', 0x1a2a44, '#dfe9ff', 0x9fd0ff);
      for (const u of [mid - 0.45, mid + 0.45]) { const p = f.at(u, gz - 4); ctx.fillStyle = '#4fc27a'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); lit.fillStyle = 'rgba(120,255,160,0.9)'; lit.beginPath(); lit.arc(p[0], p[1], 3.5, 0, 7); lit.fill(); }
    } else if (look === 'warehouse') {
      quad(ctx, f, mid - 0.8, mid + 0.8, 0, gz * 1.3, css(0x4a4038), css(0x2a2420));
      for (let z = 3; z < gz * 1.3; z += 3) quad(ctx, f, mid - 0.8, mid + 0.8, z, z + 0.6, 'rgba(0,0,0,0.25)');
      sign(ctx, null, f, 0.1, L - 0.1, H - 13, H - 5, shortName(b), 0xd8cfb8, '#3a2a20');
      quad(lit, f, mid - 0.15, mid + 0.15, gz * 1.3 + 2, gz * 1.3 + 6, css(0xffd27a, 0.9));
    } else if (look === 'garage') {
      quad(ctx, f, 0.2, L * 0.65, 0, gz - 4, css(0x3a3a3a), css(0x222222));
      for (let z = 2; z < gz - 4; z += 2.5) quad(ctx, f, 0.2, L * 0.65, z, z + 0.6, 'rgba(255,255,255,0.08)');
      sign(ctx, lit, f, 0.1, L - 0.1, gz - 2, gz + 5, 'GARAGE · ' + shortName(b), 0xb23a3a, '#fff', 0xffa060);
      // gas pump
      const p = f.out(L * 0.82, 0, 0.35);
      ctx.fillStyle = '#c23a2a'; ctx.fillRect(p[0] - 3, p[1] - 13, 6, 13);
      ctx.fillStyle = '#f0e0c0'; ctx.beginPath(); ctx.arc(p[0], p[1] - 15, 3.2, 0, 7); ctx.fill();
    } else if (look === 'diner') {
      for (const ff of [south, east]) {
        quad(ctx, ff, 0, ff.len, 5, 7, css(trim));
        quad(ctx, ff, 0.1, ff.len - 0.1, 8, gz - 3, css(0x2c3844), css(0xd8e0e0));
        quad(lit, ff, 0.1, ff.len - 0.1, 8, gz - 3, css(0xffe8b0, 0.85));
        quad(ctx, ff, 0, ff.len, gz - 1, gz + 1, css(trim));
      }
      sign(ctx, lit, f, 0.1, L - 0.1, H, H + 9, shortName(b), 0xc23a3a, '#fff', 0xff8080);
    } else if (look === 'church') {
      quad(ctx, f, mid - 0.25, mid + 0.25, 0, gz + 6, css(0x3a2a20), css(0x6a5a40));
      const c = f.at(mid, H - 14);
      ctx.fillStyle = '#5a3a6a'; ctx.beginPath(); ctx.ellipse(c[0], c[1], 6, 6, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#d8c070'; ctx.lineWidth = 1; ctx.stroke();
      lit.fillStyle = 'rgba(255,200,120,0.8)'; lit.beginPath(); lit.ellipse(c[0], c[1], 6, 6, 0, 0, 7); lit.fill();
    }
  }

  // ---- roof details ----
  if (look !== 'pier') {
    // parapet
    const pz = H;
    ctx.strokeStyle = css(shade(trim, 0.8));
    ctx.lineWidth = 2;
    ctx.beginPath();
    const r = [P(0.04, 0.04, pz), P(s - 0.04, 0.04, pz), P(s - 0.04, s - 0.04, pz), P(0.04, s - 0.04, pz)];
    ctx.moveTo(r[0][0], r[0][1]); for (const p of r.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.stroke();
    // tar patches
    for (let i = 0; i < 6; i++) { const x = rnd() * s * 0.8 + 0.1, y = rnd() * s * 0.8 + 0.1; poly(ctx, [P(x, y, pz), P(x + 0.3, y, pz), P(x + 0.3, y + 0.2, pz), P(x, y + 0.2, pz)], css(shade(roof, 0.85 + rnd() * 0.3))); }
    if (look === 'warehouse') {
      for (let i = 0; i < 3; i++) {
        const y0 = (i * s) / 3;
        poly(ctx, [P(0.1, y0 + 0.1, pz), P(s - 0.1, y0 + 0.1, pz), P(s - 0.1, y0 + 0.1, pz + 10), P(0.1, y0 + 0.1, pz + 10)], css(0x9ab0c0, 0.8));
        poly(ctx, [P(0.1, y0 + 0.1, pz + 10), P(s - 0.1, y0 + 0.1, pz + 10), P(s - 0.1, y0 + s / 3, pz), P(0.1, y0 + s / 3, pz)], css(shade(roof, 1.15)));
      }
    }
    const chimneys = look === 'diner' ? 0 : 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < chimneys; i++) {
      const x = 0.2 + rnd() * (s - 0.6), y = 0.15 + rnd() * 0.5;
      box(ctx, P, x, y, pz, 0.22, 0.22, 10 + rnd() * 6, 0x2a2624, shade(0x8a4b3a, 0.9), shade(0x8a4b3a, 0.65));
    }
    if (floors >= 4 && look !== 'church') {
      // water tower
      const x = s * 0.25, y = s * 0.25;
      for (const [lx, ly] of [[0, 0], [0.45, 0], [0, 0.45], [0.45, 0.45]]) box(ctx, P, x + lx, y + ly, pz, 0.05, 0.05, 12, 0x3a2a1a, 0x3a2a1a, 0x2a1e12, false);
      box(ctx, P, x - 0.05, y - 0.05, pz + 12, 0.6, 0.6, 16, 0x5a4030, 0x8a6040, 0x6a4a30);
      const t = P(x + 0.25, y + 0.25, pz + 34);
      poly(ctx, [P(x - 0.08, y + 0.55, pz + 28), P(x + 0.58, y + 0.55, pz + 28), t], css(0x4a3424));
      poly(ctx, [P(x + 0.58, y - 0.08, pz + 28), P(x + 0.58, y + 0.55, pz + 28), t], css(0x3a2818));
    }
    if (look === 'tenement') {
      // fire escape zigzag
      const f = east;
      ctx.strokeStyle = 'rgba(20,20,20,0.85)';
      ctx.lineWidth = 1.2;
      for (let fl = 1; fl < floors; fl++) {
        const z = 4 + fl * FLOOR_H;
        const a = f.out(0.3, z, 0.18), c = f.out(1.2, z, 0.18);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
        const d = f.out(fl % 2 ? 0.35 : 1.15, z, 0.18), e = f.out(fl % 2 ? 1.15 : 0.35, z + FLOOR_H, 0.18);
        if (fl < floors - 1) { ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); }
      }
      // laundry line
      const l0 = south.out(0.2, H - 10, 0.15), l1 = south.out(s - 0.2, H - 12, 0.15);
      ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.beginPath(); ctx.moveTo(l0[0], l0[1]); ctx.quadraticCurveTo((l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2 + 6, l1[0], l1[1]); ctx.stroke();
      for (let i = 1; i < 6; i++) { const t = i / 6; ctx.fillStyle = css([0xe8e0d0, 0x9a3a3a, 0x3a5a9a, 0xd8c070][i % 4]); ctx.fillRect(l0[0] + (l1[0] - l0[0]) * t - 2, l0[1] + (l1[1] - l0[1]) * t + Math.sin(t * Math.PI) * 6, 4, 5); }
    }
    if (look === 'church') {
      const x = s * 0.35, y = s * 0.35, w = s * 0.3;
      box(ctx, P, x, y, pz, w, w, 34, 0x6a665e, shade(base, 0.95), shade(base, 0.7));
      const t = P(x + w / 2, y + w / 2, pz + 34 + 40);
      poly(ctx, [P(x, y + w, pz + 34), P(x + w, y + w, pz + 34), t], css(0x4a5a5a));
      poly(ctx, [P(x + w, y, pz + 34), P(x + w, y + w, pz + 34), t], css(0x3a4848));
      ctx.strokeStyle = '#d8c070'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0], t[1] - 9); ctx.moveTo(t[0] - 3, t[1] - 6); ctx.lineTo(t[0] + 3, t[1] - 6); ctx.stroke();
    }
    if (b.type === 'cityhall') {
      const c = P(s / 2, s / 2, pz);
      ctx.fillStyle = css(0x7a9a8a); ctx.beginPath(); ctx.ellipse(c[0], c[1] - 6, s * 14, s * 10, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = css(0xc9c2b0); ctx.fillRect(c[0] - s * 14, c[1] - 6, s * 28, 6);
    }
    if (look === 'hq') {
      // grand cornice ornaments
      for (const f of [south, east]) for (let u = 0.3; u < f.len; u += 0.6) { const p = f.at(u, H + 2); ctx.fillStyle = css(trim); ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, 7); ctx.fill(); }
    }
  }
  const flagP = P(s * 0.75, s * 0.25, H);
  return { day: cv, lit: lcv, ox, oy, w: W, h: Hc, flag: { x: flagP[0] - ox, y: flagP[1] - oy }, height: H };
}

/** Darkened, sooty copy of the art for burned buildings. */
export function burnedArt(art: BuildingArt): HTMLCanvasElement {
  const [cv, ctx] = canvas(art.day.width, art.day.height);
  ctx.filter = 'grayscale(0.7) brightness(0.45) contrast(1.2)';
  ctx.drawImage(art.day, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-atop';
  const rnd = artRng(art.w * 31 + art.h);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.4})`;
    const x = rnd() * cv.width, y = rnd() * cv.height;
    ctx.beginPath(); ctx.ellipse(x, y, 8 + rnd() * 20, 14 + rnd() * 30, 0, 0, 7); ctx.fill();
  }
  return cv;
}

export { mix };
