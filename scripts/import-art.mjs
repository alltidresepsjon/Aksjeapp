// Imports hand-made / AI-made images into the game.
//
//   npm run art            (reads art-inbox/, writes packages/client/public/assets/graphics/)
//
// File names decide where an image goes (see docs/grafikk-prompter.md):
//   building-<look>-<3|6>-<n>.png      e.g. building-shop-3-1.png, building-bank-6-1.png
//   building-type-<type>-<3|6>-<n>.png e.g. building-type-bakery-3-1.png (beats the look)
//   person-<who>-<n>.png               e.g. person-corrado-1.png, person-nico.png, person-police-1.png
//                                      A wide picture with four poses side by side (stand, walk, walk, aim)
//                                      becomes an animated figure; a single figure is used as a still.
//   car-<model>-<front|rear>.png       e.g. car-sedan-front.png
//   ui-<name>.png                      e.g. ui-tommaso.png, ui-title.png, ui-briefing-c1.png, ui-panel.png
//   icon-<name>.png                    e.g. icon-extort.png (buttons)
//
// Each image gets its background removed (if it is not already transparent), is trimmed to the
// drawing, scaled to the size the game expects, and listed in manifest.json.

import { readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const inbox = process.env.ART_INBOX ?? join(root, 'art-inbox');
const out = process.env.ART_OUT ?? join(root, 'packages/client/public/assets/graphics');
const INSET = 0.14;

/** Target size in pixels (the game draws at half this size, so it stays sharp on high-DPI screens). */
function target(name) {
  let m;
  if ((m = /^building-(?:type-)?[a-z]+-(3|6)-/.exec(name))) return { cat: 'buildings', width: Math.round((+m[1] - INSET * 2) * 64 * 2) };
  if (name.startsWith('person-')) return { cat: 'people', height: 112 };
  if (name.startsWith('car-')) return { cat: 'cars', width: 260 };
  if (name.startsWith('icon-')) return { cat: 'icons', width: 128 };
  if (/^ui-(title|safehouse|win|lose|lobby)$/.test(name)) return { cat: 'ui', width: 1600, keepBg: true };
  if (name.startsWith('ui-briefing-')) return { cat: 'ui', width: 1200, keepBg: true };
  if (name === 'ui-logo') return { cat: 'ui', width: 1200 };
  if (name === 'ui-panel' || name === 'ui-paper') return { cat: 'ui', width: 1024, keepBg: true };
  if (name === 'ui-button') return { cat: 'ui', width: 512, keepBg: true };
  if (name === 'ui-tommaso') return { cat: 'ui', width: 256, keepBg: true };
  if (name.startsWith('ui-')) return { cat: 'ui', width: 256 };
  return null;
}

/** Makes the background transparent by flood-filling from the border with the corner colour. */
function removeBackground(data, w, h) {
  const px = (x, y) => (y * w + x) * 4;
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  if (corners.every((i) => data[i + 3] < 16)) return false; // already transparent
  const bg = [0, 1, 2].map((c) => corners.reduce((a, i) => a + data[i + c], 0) / 4);
  const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
  for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const k = y * w + x;
    if (seen[k]) continue;
    seen[k] = 1;
    const i = k * 4;
    const d = dist(i);
    if (d > 60) continue;
    data[i + 3] = d < 34 ? 0 : Math.min(data[i + 3], Math.round(((d - 34) / 26) * 255)); // soft edge
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return true;
}

/** Removes the thin coloured halo image generators leave around transparent cut-outs. */
function defringe(data, w, h) {
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[(y * w + x) * 4 + 3]);
  const kill = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = a(x, y);
    if (v === 0 || v >= 250) continue;
    if (a(x - 2, y) < 10 || a(x + 2, y) < 10 || a(x, y - 2) < 10 || a(x, y + 2) < 10) kill.push((y * w + x) * 4 + 3);
  }
  for (const i of kill) data[i] = 0;
}

/** Finds the pavement diamond at the bottom of a building picture: its lowest corner and its width. */
function footprint(data, w, h, box) {
  const A = (x, y) => data[(y * w + x) * 4 + 3];
  const bottom = box.top + box.height - 1;
  let sum = 0, cnt = 0;
  for (let x = box.left; x < box.left + box.width; x++) if (A(x, bottom) > 128) { sum += x; cnt++; }
  const bx = cnt ? sum / cnt : box.left + box.width / 2;
  let L = bx, R = bx;
  for (let d = 1; d < box.height / 2; d++) {
    const y = bottom - d;
    let l = -1, r = -1;
    for (let x = box.left; x < box.left + box.width; x++) if (A(x, y) > 128) { if (l < 0) l = x; r = x; }
    if (l < 0) break;
    const ok = (span) => span >= 2 * d - 12;
    if (ok(bx - l)) L = Math.min(L, l);
    if (ok(r - bx)) R = Math.max(R, r);
    if (!ok(bx - l) && !ok(r - bx)) break;
  }
  let width = R - L;
  // walls, gates or railings in front hide the pavement: fall back to the whole picture
  if (width < box.width * 0.75) width = box.width;
  return { bottomX: bx, width };
}

function bbox(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Splits a 4-pose sheet into equal frames that share one baseline, and writes them as a strip. */
async function importSheet(data, w, h, name, height) {
  const cols = 4, cw = Math.floor(w / cols);
  const boxes = [];
  for (let i = 0; i < cols; i++) {
    const part = Buffer.alloc(cw * h * 4);
    for (let y = 0; y < h; y++) data.copy(part, y * cw * 4, (y * w + i * cw) * 4, (y * w + i * cw + cw) * 4);
    const b = bbox(part, cw, h);
    if (!b) return null;
    boxes.push({ part, b });
  }
  const top = Math.min(...boxes.map((x) => x.b.top));
  const bottom = Math.max(...boxes.map((x) => x.b.top + x.b.height));
  const fw = Math.max(...boxes.map((x) => x.b.width)) + 8;
  const fh = bottom - top;
  const scale = height / fh;
  const outW = Math.round(fw * scale), outH = height;
  const frames = [];
  for (const { part, b } of boxes) {
    // centre each pose on its own middle, keep the common top/bottom so the feet line up
    const cx = b.left + b.width / 2;
    const left = Math.max(0, Math.min(cw - fw, Math.round(cx - fw / 2)));
    const width = Math.min(fw, cw - left);
    const img = await sharp(part, { raw: { width: cw, height: h, channels: 4 } })
      .extract({ left, top, width, height: fh })
      .extend({ right: fw - width, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: outW, height: outH, fit: 'fill' })
      .png().toBuffer();
    frames.push(img);
  }
  const strip = await sharp({ create: { width: outW * cols, height: outH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((input, i) => ({ input, left: i * outW, top: 0 })))
    .png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(out, 'people', `${name}.png`), strip);
  return { file: `people/${name}.png`, w: outW, h: outH, frames: cols };
}

async function main() {
  let files;
  try { files = (await readdir(inbox)).filter((f) => /\.(png|webp|jpe?g)$/i.test(f)); }
  catch { console.log(`No ${inbox} folder. Put your images there first.`); return; }
  const manifest = { version: 1, buildings: {}, people: {}, cars: {}, ui: {}, icons: {} };
  for (const cat of ['buildings', 'people', 'cars', 'ui', 'icons']) await mkdir(join(out, cat), { recursive: true });
  let ok = 0;
  for (const f of files.sort()) {
    const name = basename(f, extname(f)).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const t = target(name);
    if (!t) { console.warn(`  ? ${f}: unknown name, skipped (see docs/grafikk-prompter.md)`); continue; }
    const img = sharp(join(inbox, f)).ensureAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const removed = t.keepBg ? false : removeBackground(data, info.width, info.height);
    if (!t.keepBg) defringe(data, info.width, info.height);
    if (t.cat === 'people' && info.width / info.height >= 1.3) {
      const r = await importSheet(data, info.width, info.height, name, t.height);
      if (!r) { console.warn(`  ! ${f}: could not find four poses`); continue; }
      const key = name.replace(/^person-/, '');
      manifest.people[key] = r;
      ok++;
      console.log(`  ✓ ${f} → people/${name}.png (4 poses, ${r.w}×${r.h} each${removed ? ', background removed' : ''})`);
      continue;
    }
    const box = bbox(data, info.width, info.height);
    if (!box) { console.warn(`  ! ${f}: image is empty after removing the background`); continue; }
    let pipe = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(box);
    // buildings are scaled by their footprint (the pavement diamond), not by awnings or eaves sticking out
    let extra = {};
    if (t.cat === 'buildings') {
      const fp = footprint(data, info.width, info.height, box);
      const scale = t.width / fp.width;
      pipe = pipe.resize({ width: Math.round(box.width * scale) });
      extra = { ax: +((fp.bottomX - box.left) / box.width).toFixed(4), fw: t.width };
    } else pipe = t.width ? pipe.resize({ width: t.width }) : pipe.resize({ height: t.height });
    const file = `${name}.png`;
    const buf = await pipe.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
    await writeFile(join(out, t.cat, file), buf.data);
    if (t.cat === 'buildings') {
      // lit windows glow at night: keep only the warm, bright pixels as an additive layer
      const raw = await sharp(buf.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const d = raw.data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        const warm = r > 170 && g > 110 && r - b > 70 && a > 200;
        if (warm) { const k = Math.min(1, (r + g - 260) / 200); d[i + 3] = Math.max(0, Math.round(255 * k)); if (d[i + 3] > 40) n++; }
        else d[i + 3] = 0;
      }
      if (n > 50) {
        const litFile = `${name}-lit.png`;
        await sharp(d, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } }).blur(0.6).png({ compressionLevel: 9 }).toFile(join(out, t.cat, litFile));
        extra.lit = `${t.cat}/${litFile}`;
      }
    }
    const key = name.replace(/^(building|person|car|ui|icon)-/, '');
    manifest[t.cat][key] = { file: `${t.cat}/${file}`, w: buf.info.width, h: buf.info.height, ...extra };
    ok++;
    console.log(`  ✓ ${f} → ${t.cat}/${file} (${buf.info.width}×${buf.info.height}${removed ? ', background removed' : ''})`);
  }
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${ok} image(s) imported. Restart or rebuild the game to see them.`);
}

if (process.argv.includes('--clear')) {
  for (const cat of ['buildings', 'people', 'cars', 'ui', 'icons']) await rm(join(out, cat), { recursive: true, force: true });
  await rm(join(out, 'manifest.json'), { force: true });
  console.log('Removed all imported art; the game falls back to its own drawings.');
} else await main();
