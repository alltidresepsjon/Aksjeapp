// Draws the isometric guide images in docs/maler/ that are uploaded to ChatGPT together with each prompt.
// Pure parallel projection: horizontal edges slope exactly 1:2, verticals are vertical, no perspective.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../docs/maler/', import.meta.url));
await mkdir(out, { recursive: true });

/** A box template: footprint diamond touching left/right/bottom, walls of the given height, floor lines. */
async function box(file, W, H, half, wallH, floors) {
  const bx = W / 2, by = H - 24;
  const B = [bx, by], L = [bx - half, by - half / 2], R = [bx + half, by - half / 2], T = [bx, by - half];
  const up = (p, h) => [p[0], p[1] - h];
  const line = (a, b, style) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${style}/>`;
  const solid = 'stroke="#1e6fd9" stroke-width="5"';
  const thin = 'stroke="#7aa8e8" stroke-width="2" stroke-dasharray="10 8"';
  const back = 'stroke="#b9cff0" stroke-width="2" stroke-dasharray="6 10"';
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  let g = '';
  // the pavement diamond under the building (its back half is hidden behind the walls)
  g += `<polygon points="${pts([B, L, T, R])}" fill="#e6e6e6"/>`;
  // two visible walls and the roof, filled so the box reads as solid
  g += `<polygon points="${pts([L, B, up(B, wallH), up(L, wallH)])}" fill="#f4f4f4" stroke="#1e6fd9" stroke-width="5"/>`;
  g += `<polygon points="${pts([B, R, up(R, wallH), up(B, wallH)])}" fill="#dedede" stroke="#1e6fd9" stroke-width="5"/>`;
  g += `<polygon points="${pts([up(B, wallH), up(L, wallH), up(T, wallH), up(R, wallH)])}" fill="#cfe0f7" stroke="#1e6fd9" stroke-width="5"/>`;
  // floor lines on the walls
  for (let i = 1; i < floors; i++) {
    const h = (wallH * i) / floors;
    g += line(up(L, h), up(B, h), thin) + line(up(B, h), up(R, h), thin);
  }
  // the pavement's front edges stay visible below the walls
  g += line(L, B, solid) + line(B, R, solid);
  // slope reminders: two arrows along the 1:2 edges
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${g}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out + file);
  console.log('  ✓ docs/maler/' + file);
}

await box('mal-hus-lav.png', 1024, 1024, 480, 300, 2);      // 1–2 storeys
await box('mal-hus-middels.png', 1024, 1280, 480, 520, 4);  // 3–4 storeys
await box('mal-hus-hoyt.png', 1024, 1536, 480, 800, 7);     // 5–8 storeys

/** Figure template: a flat ground ellipse and four standing boxes in a row. */
{
  const W = 1536, H = 1024, cw = W / 4;
  let g = '';
  for (let i = 0; i < 4; i++) {
    const cx = cw * i + cw / 2, gy = H - 80;
    g += `<ellipse cx="${cx}" cy="${gy}" rx="90" ry="45" fill="#e6e6e6" stroke="#1e6fd9" stroke-width="4"/>`;
    g += `<line x1="${cx}" y1="${gy}" x2="${cx}" y2="${gy - 760}" stroke="#7aa8e8" stroke-width="2" stroke-dasharray="10 8"/>`;
    g += `<line x1="${cw * i + 20}" y1="${gy}" x2="${cw * (i + 1) - 20}" y2="${gy}" stroke="#1e6fd9" stroke-width="3"/>`;
    g += `<line x1="${cw * i + 20}" y1="${gy - 760}" x2="${cw * (i + 1) - 20}" y2="${gy - 760}" stroke="#7aa8e8" stroke-width="2" stroke-dasharray="10 8"/>`;
    // facing arrow: towards the bottom-right, along the 1:2 iso axis
    g += `<line x1="${cx}" y1="${gy}" x2="${cx + 80}" y2="${gy + 40}" stroke="#d9481e" stroke-width="6"/><polygon points="${cx + 92},${gy + 46} ${cx + 66},${gy + 46} ${cx + 82},${gy + 26}" fill="#d9481e"/>`;
  }
  for (let i = 1; i < 4; i++) g += `<line x1="${cw * i}" y1="0" x2="${cw * i}" y2="${H}" stroke="#cccccc" stroke-width="2"/>`;
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${g}</svg>`)).png().toFile(out + 'mal-figur.png');
  console.log('  ✓ docs/maler/mal-figur.png');
}

/** Car templates: a long box on the ground, front towards bottom-right or rear towards the viewer. */
for (const [file, len, wid] of [['mal-bil.png', 300, 130]]) {
  const W = 1536, H = 1024, cx = W / 2, cy = H * 0.62;
  const P = (a, b, z) => [cx + (a - b) * 1, cy + (a + b) * 0.5 - z];
  const corners = [[-len, -wid], [len, -wid], [len, wid], [-len, wid]];
  const poly = (z) => corners.map(([a, b]) => P(a, b, z).join(',')).join(' ');
  let g = `<polygon points="${poly(0)}" fill="#e6e6e6" stroke="#1e6fd9" stroke-width="4"/>`;
  g += `<polygon points="${poly(150)}" fill="none" stroke="#7aa8e8" stroke-width="2" stroke-dasharray="10 8"/>`;
  for (const [a, b] of corners) { const p = P(a, b, 0), q = P(a, b, 150); g += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#7aa8e8" stroke-width="2" stroke-dasharray="10 8"/>`; }
  const f = P(len, 0, 0), f2 = P(len + 120, 0, 0);
  g += `<line x1="${f[0]}" y1="${f[1]}" x2="${f2[0]}" y2="${f2[1]}" stroke="#d9481e" stroke-width="8"/><polygon points="${f2[0] + 14},${f2[1] + 7} ${f2[0] - 16},${f2[1] + 14} ${f2[0] - 4},${f2[1] - 14}" fill="#d9481e"/>`;
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${g}</svg>`)).png().toFile(out + file);
  console.log('  ✓ docs/maler/' + file);
}
