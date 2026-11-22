// Draws the true isometric box over every building picture in art-inbox/ so you can see
// whether ChatGPT drew it with perspective. Writes art-inbox/sjekk/<name>.png.
//   npm run art:check
import { readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const inbox = process.env.ART_INBOX ?? join(root, 'art-inbox');
const out = join(inbox, 'sjekk');
await mkdir(out, { recursive: true });

for (const f of (await readdir(inbox)).filter((x) => /^building-.*\.(png|webp)$/i.test(x)).sort()) {
  const { data, info } = await sharp(join(inbox, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3];
  const row = (y) => { let l = -1, r = -1; for (let x = 0; x < W; x++) if (A(x, y) > 128) { if (l < 0) l = x; r = x; } return [l, r]; };
  let bottom = H - 1; while (bottom > 0 && row(bottom)[0] < 0) bottom--;
  let top = 0; while (top < H && row(top)[0] < 0) top++;
  const [bl, br] = row(bottom); const bx = (bl + br) / 2;
  // widest extent of the pavement diamond near the ground gives the footprint half-width
  let half = 0;
  for (let d = 1; d < (bottom - top) / 2; d++) { const [l, r] = row(bottom - d); if (l < 0) break; const s = Math.min(bx - l, r - bx); if (s >= 2 * d - 14) half = Math.max(half, s); else if (d > 40) break; }
  if (half < 50) half = Math.min(bx, W - bx);
  const B = [bx, bottom], L = [bx - half, bottom - half / 2], R = [bx + half, bottom - half / 2], T = [bx, bottom - half];
  // walls as tall as the picture reaches above the roof's front corner
  const wallH = Math.max(40, bottom - top - half);
  const up = (p) => [p[0], p[1] - wallH];
  const seg = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#00e5ff" stroke-width="5" stroke-dasharray="18 10"/>`;
  const lines = [seg(B, L), seg(B, R), seg(L, T), seg(R, T), seg(B, up(B)), seg(L, up(L)), seg(R, up(R)), seg(up(B), up(L)), seg(up(B), up(R)), seg(up(L), up(T)), seg(up(R), up(T))];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines.join('')}</svg>`;
  const tmp = await sharp(join(inbox, f)).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  await sharp(tmp).resize({ width: 800 }).png().toFile(join(out, f.replace(/\.\w+$/, '.png')));
  console.log(`  ✓ art-inbox/sjekk/${f}`);
}
console.log('Open the pictures: walls and roof edges should follow the turquoise lines.');
