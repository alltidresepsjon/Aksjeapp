// What lies beyond the playable district: the boardwalk, the beach and the ocean on the south and east,
// and the rest of the city fading into the dark on the north and west. Purely decorative.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { PERIOD, ROAD, BLOCK, type MapData } from '@bg/shared';
import { artRng, canvas, css, shade, toScreen } from './iso';
import { SPRITE_RES } from './tex/sprites';

const SEA = 34;

function quad(g: Graphics, a: [number, number], b: [number, number], c: [number, number], d: [number, number]) {
  const p = [a, b, c, d].map(([x, y]) => toScreen(x, y)).flatMap((q) => [q.x, q.y]);
  g.poly(p);
}

export interface Outskirts {
  back: Container;
  /** Lit windows of the far city and lights on the pier, faded in at night. */
  night: Graphics;
  objects: { sprite: Sprite; depth: number; lit?: Sprite }[];
  steam: { x: number; y: number }[];
}

export function buildOutskirts(map: MapData): Outskirts {
  const back = new Container();
  const g = new Graphics();
  const night = new Graphics();
  const rnd = artRng(map.w * 977 + map.h);
  const { w, h } = map;
  back.addChild(g);

  // ---- ocean, beach and boardwalk (south and east) ----
  quad(g, [w, -SEA], [w + SEA, -SEA], [w + SEA, h + SEA], [w, h + SEA]); g.fill({ color: 0x1a3442 });
  quad(g, [-SEA, h], [w + SEA, h], [w + SEA, h + SEA], [-SEA, h + SEA]); g.fill({ color: 0x1a3442 });
  // gentle swell lines
  for (let i = 0; i < 260; i++) {
    const side = rnd() < 0.5;
    const x = side ? w + 5.5 + rnd() * (SEA - 6) : -SEA + rnd() * (w + SEA * 2);
    const y = side ? -SEA + rnd() * (h + SEA * 2) : h + 5.5 + rnd() * (SEA - 6);
    const p = toScreen(x, y);
    g.moveTo(p.x - 9, p.y).quadraticCurveTo(p.x, p.y - 3, p.x + 9, p.y);
  }
  g.stroke({ width: 1.3, color: 0x5d8ea6, alpha: 0.35 });
  // beach
  quad(g, [-SEA, h + 2.3], [w + 5, h + 2.3], [w + 5, h + 5.2], [-SEA, h + 5.2]); g.fill({ color: 0xc8b58a });
  quad(g, [w + 2.3, -SEA], [w + 5.2, -SEA], [w + 5.2, h + 5.2], [w + 2.3, h + 5.2]); g.fill({ color: 0xc8b58a });
  for (let i = 0; i < 160; i++) {
    const side = rnd() < 0.5;
    const x = side ? w + 2.4 + rnd() * 2.7 : -SEA + rnd() * (w + SEA);
    const y = side ? -SEA + rnd() * (h + SEA) : h + 2.4 + rnd() * 2.7;
    const p = toScreen(x, y);
    g.ellipse(p.x, p.y, 3 + rnd() * 5, 1.5 + rnd() * 2).fill({ color: shade(0xc8b58a, 0.9 + rnd() * 0.2), alpha: 0.7 });
  }
  // surf
  quad(g, [-SEA, h + 5.1], [w + 5.1, h + 5.1], [w + 5.1, h + 5.5], [-SEA, h + 5.5]); g.fill({ color: 0xe8efe8, alpha: 0.55 });
  quad(g, [w + 5.1, -SEA], [w + 5.5, -SEA], [w + 5.5, h + 5.5], [w + 5.1, h + 5.5]); g.fill({ color: 0xe8efe8, alpha: 0.55 });
  // sea wall and boardwalk planks
  quad(g, [-SEA, h], [w + 0.4, h], [w + 0.4, h + 0.35], [-SEA, h + 0.35]); g.fill({ color: 0x6b6962 });
  quad(g, [w, -SEA], [w + 0.35, -SEA], [w + 0.35, h + 0.4], [w, h + 0.4]); g.fill({ color: 0x6b6962 });
  quad(g, [-SEA, h + 0.35], [w + 2.3, h + 0.35], [w + 2.3, h + 2.3], [-SEA, h + 2.3]); g.fill({ color: 0x8a6a46 });
  quad(g, [w + 0.35, -SEA], [w + 2.3, -SEA], [w + 2.3, h + 2.3], [w + 0.35, h + 2.3]); g.fill({ color: 0x8a6a46 });
  for (let x = -SEA; x < w + 2.3; x += 0.33) { const a = toScreen(x, h + 0.35), b = toScreen(x, h + 2.3); g.moveTo(a.x, a.y).lineTo(b.x, b.y); }
  for (let y = -SEA; y < h + 0.35; y += 0.33) { const a = toScreen(w + 0.35, y), b = toScreen(w + 2.3, y); g.moveTo(a.x, a.y).lineTo(b.x, b.y); }
  g.stroke({ width: 1, color: 0x5a4430, alpha: 0.55 });
  // railing on the beach side
  for (let x = -SEA; x < w + 2.3; x += 0.5) { const p = toScreen(x, h + 2.25); g.moveTo(p.x, p.y).lineTo(p.x, p.y - 7); }
  for (let y = -SEA; y < h + 2.3; y += 0.5) { const p = toScreen(w + 2.25, y); g.moveTo(p.x, p.y).lineTo(p.x, p.y - 7); }
  g.stroke({ width: 1.2, color: 0xe0d6c0, alpha: 0.85 });
  { const a = toScreen(-SEA, h + 2.25), b = toScreen(w + 2.25, h + 2.25), c = toScreen(w + 2.25, -SEA); g.moveTo(a.x, a.y - 7).lineTo(b.x, b.y - 7).lineTo(c.x, c.y - 7).stroke({ width: 1.6, color: 0xe0d6c0, alpha: 0.9 }); }

  // ---- the amusement pier with a Ferris wheel (south-east) ----
  const px = Math.max(4, w - 9), py0 = h + 2.3, py1 = h + 14;
  quad(g, [px, py0], [px + 3, py0], [px + 3, py1], [px, py1]); g.fill({ color: 0x7a5c3c });
  for (let y = py0; y < py1; y += 0.33) { const a = toScreen(px, y), b = toScreen(px + 3, y); g.moveTo(a.x, a.y).lineTo(b.x, b.y); }
  g.stroke({ width: 1, color: 0x4a3420, alpha: 0.5 });
  for (let y = py0 + 0.5; y < py1; y += 1.5) for (const x of [px, px + 3]) { const p = toScreen(x, y); g.moveTo(p.x, p.y).lineTo(p.x, p.y + 10); }
  g.stroke({ width: 2, color: 0x3a2a1a, alpha: 0.9 });
  const objects: Outskirts['objects'] = [];
  const wheel = ferrisWheel();
  const wp = toScreen(px + 1.5, py1 - 2);
  const ws = new Sprite(Texture.from(wheel.day)); ws.anchor.set(0.5, 1); ws.scale.set(1 / SPRITE_RES); ws.position.set(wp.x, wp.y);
  const wl = new Sprite(Texture.from(wheel.lit)); wl.anchor.set(0.5, 1); wl.scale.set(1 / SPRITE_RES); wl.position.set(wp.x, wp.y); wl.blendMode = 'add';
  objects.push({ sprite: ws, depth: px + py1 + 50, lit: wl });
  const pav = pavilion();
  const pp = toScreen(px + 1.5, py0 + 3.5);
  const ps = new Sprite(Texture.from(pav.day)); ps.anchor.set(0.5, 1); ps.scale.set(1 / SPRITE_RES); ps.position.set(pp.x, pp.y);
  const pl = new Sprite(Texture.from(pav.lit)); pl.anchor.set(0.5, 1); pl.scale.set(1 / SPRITE_RES); pl.position.set(pp.x, pp.y); pl.blendMode = 'add';
  objects.push({ sprite: ps, depth: px + py0 + 5 + 50, lit: pl });

  // ---- the rest of the city to the north and west, fading into the dark ----
  const city = new Graphics();
  back.addChild(city);
  const blocks: { x: number; y: number; ring: number }[] = [];
  for (let ring = 1; ring <= 3; ring++) {
    for (let bx = -ring; bx < map.bw; bx++) blocks.push({ x: bx * PERIOD + ROAD, y: -ring * PERIOD + ROAD, ring });
    for (let by = -ring + 1; by < map.bh; by++) blocks.push({ x: -ring * PERIOD + ROAD, y: by * PERIOD + ROAD, ring });
  }
  // asphalt under the far city
  quad(city, [-3 * PERIOD, -3 * PERIOD], [w, -3 * PERIOD], [w, 0], [-3 * PERIOD, 0]); city.fill({ color: 0x1e2024 });
  quad(city, [-3 * PERIOD, 0], [0, 0], [0, h], [-3 * PERIOD, h]); city.fill({ color: 0x1e2024 });
  blocks.sort((a, b) => a.x + a.y - (b.x + b.y));
  const boxes: { x: number; y: number; s: number; hgt: number; col: number; ring: number }[] = [];
  for (const b of blocks) {
    quad(city, [b.x - 0.35, b.y - 0.35], [b.x + BLOCK + 0.35, b.y - 0.35], [b.x + BLOCK + 0.35, b.y + BLOCK + 0.35], [b.x - 0.35, b.y + BLOCK + 0.35]);
    city.fill({ color: 0x4a4944 });
    const quadLots = rnd() < 0.8;
    const lots = quadLots ? [[0, 0], [3, 0], [0, 3], [3, 3]] : [[0, 0]];
    for (const [ox, oy] of lots) {
      const s = quadLots ? 2.7 : 5.6;
      boxes.push({ x: b.x + ox + 0.15, y: b.y + oy + 0.15, s, hgt: 30 + rnd() * (quadLots ? 70 : 140), col: shade([0x6a3a30, 0x5a4a40, 0x7a6a58, 0x4a4e56, 0x5e4038][Math.floor(rnd() * 5)], 0.75), ring: b.ring });
    }
  }
  boxes.sort((a, b) => a.x + a.y + a.s - (b.x + b.y + b.s));
  for (const bx of boxes) {
    const { x, y, s, hgt, col } = bx;
    const T = toScreen(x, y), R = toScreen(x + s, y), B = toScreen(x + s, y + s), L = toScreen(x, y + s);
    city.poly([L.x, L.y, B.x, B.y, B.x, B.y - hgt, L.x, L.y - hgt]).fill({ color: shade(col, 0.95) });
    city.poly([B.x, B.y, R.x, R.y, R.x, R.y - hgt, B.x, B.y - hgt]).fill({ color: shade(col, 0.7) });
    city.poly([T.x, T.y - hgt, R.x, R.y - hgt, B.x, B.y - hgt, L.x, L.y - hgt]).fill({ color: shade(col, 0.55) });
    // windows (dark by day, lit by night)
    const floors = Math.floor(hgt / 18);
    for (let f = 0; f < floors; f++) for (let k = 0; k < Math.round(s * 1.4); k++) {
      const u = (k + 0.5) / Math.round(s * 1.4);
      for (const face of [0, 1]) {
        const p = face === 0 ? { x: L.x + (B.x - L.x) * u, y: L.y + (B.y - L.y) * u } : { x: B.x + (R.x - B.x) * u, y: B.y + (R.y - B.y) * u };
        const wy = p.y - 8 - f * 18;
        city.rect(p.x - 2.5, wy - 6, 5, 7).fill({ color: 0x1a1e24, alpha: 0.8 });
        if (rnd() < 0.45) night.rect(p.x - 2.5, wy - 6, 5, 7).fill({ color: rnd() < 0.85 ? 0xffd27a : 0xbfe0ff, alpha: 0.9 });
      }
    }
  }
  // haze that thickens with distance
  for (let ring = 1; ring <= 3; ring++) {
    const a = 0.12 + ring * 0.14;
    const x0 = -ring * PERIOD, y0 = -ring * PERIOD;
    quad(city, [x0, y0], [w + 2, y0], [w + 2, y0 + PERIOD], [x0, y0 + PERIOD]); city.fill({ color: 0x0b0d12, alpha: a });
    quad(city, [x0, y0 + PERIOD], [x0 + PERIOD, y0 + PERIOD], [x0 + PERIOD, h + 2], [x0, h + 2]); city.fill({ color: 0x0b0d12, alpha: a });
  }
  back.addChild(night);
  night.alpha = 0;

  // manholes that steam
  const steam: { x: number; y: number }[] = [];
  for (let i = 0; i < 400 && steam.length < 7; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
    if (map.tiles[y * w + x] === 0) steam.push({ x: x + 0.5, y: y + 0.5 });
  }
  return { back, night, objects, steam };
}

function ferrisWheel() {
  const W = 200, H = 240, R = 82, cx = W / 2, cy = 100;
  const [day, c] = canvas(W * SPRITE_RES, H * SPRITE_RES);
  const [lit, l] = canvas(W * SPRITE_RES, H * SPRITE_RES);
  c.scale(SPRITE_RES, SPRITE_RES); l.scale(SPRITE_RES, SPRITE_RES);
  c.strokeStyle = '#d8d0c0'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx - 50, H - 4); c.lineTo(cx, cy); c.lineTo(cx + 50, H - 4); c.stroke();
  c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  c.lineWidth = 1.4; c.beginPath(); c.arc(cx, cy, R - 10, 0, 7); c.stroke();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); }
  const cols = ['#b23a3a', '#2f5a9a', '#d8b25a', '#2f7a4a'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, gx = cx + Math.cos(a) * R, gy = cy + Math.sin(a) * R;
    c.fillStyle = cols[i % 4]; c.fillRect(gx - 6, gy + 1, 12, 10); c.fillStyle = '#1a1a1a'; c.fillRect(gx - 7, gy, 14, 2);
  }
  c.fillStyle = '#e8e0cc'; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    l.fillStyle = i % 3 === 0 ? 'rgba(255,120,120,0.95)' : 'rgba(255,230,150,0.95)';
    l.beginPath(); l.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1.8, 0, 7); l.fill();
  }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; l.fillStyle = 'rgba(255,230,150,0.8)'; l.beginPath(); l.arc(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, 1.4, 0, 7); l.fill(); }
  return { day, lit };
}

function pavilion() {
  const W = 180, H = 130;
  const [day, c] = canvas(W * SPRITE_RES, H * SPRITE_RES);
  const [lit, l] = canvas(W * SPRITE_RES, H * SPRITE_RES);
  c.scale(SPRITE_RES, SPRITE_RES); l.scale(SPRITE_RES, SPRITE_RES);
  const cx = W / 2, base = H - 6;
  c.fillStyle = css(0xe8e0cc); c.fillRect(cx - 70, base - 46, 140, 46);
  c.fillStyle = css(0xd0c6b0); c.fillRect(cx + 10, base - 46, 60, 46);
  for (let i = 0; i < 7; i++) { c.fillStyle = css(0x3a4a5a); c.fillRect(cx - 64 + i * 19, base - 38, 10, 16); }
  c.fillStyle = css(0x2f5a4a);
  c.beginPath(); c.moveTo(cx - 78, base - 46); c.lineTo(cx, base - 92); c.lineTo(cx + 78, base - 46); c.closePath(); c.fill();
  c.fillStyle = css(0xb23a3a); c.beginPath(); c.moveTo(cx - 4, base - 92); c.lineTo(cx - 4, base - 118); c.lineTo(cx + 16, base - 112); c.lineTo(cx - 4, base - 106); c.fill();
  // striped awning
  for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? '#e9e1cc' : '#b23a3a'; c.fillRect(cx - 70 + i * 10, base - 20, 10, 8); }
  for (let i = 0; i < 20; i++) { l.fillStyle = 'rgba(255,225,150,0.95)'; l.beginPath(); l.arc(cx - 76 + i * 8, base - 46 - Math.max(0, 46 - Math.abs(i * 8 - 76)) * 0.6, 1.6, 0, 7); l.fill(); }
  for (let i = 0; i < 7; i++) { l.fillStyle = 'rgba(255,215,140,0.85)'; l.fillRect(cx - 64 + i * 19, base - 38, 10, 16); }
  return { day, lit };
}
