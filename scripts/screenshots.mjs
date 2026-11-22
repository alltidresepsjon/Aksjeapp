// Smoke test + screenshots: node scripts/screenshots.mjs [baseUrl]
// Starts nothing by itself: run `npm run build && npm start` (or `npm run dev`) first.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:8787';
const out = 'screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];

async function campaign(name, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(base);
  await page.waitForSelector('[data-go="new"]');
  await page.screenshot({ path: `${out}/${name}-1-title.png` });
  page.once('dialog', (d) => d.accept());
  await page.click('[data-go="new"]');
  await page.click('[data-go="next"]');
  await page.waitForSelector('[data-go="start"]');
  await page.screenshot({ path: `${out}/${name}-2-briefing.png`, fullPage: false });
  await page.click('[data-go="start"]');
  await page.waitForSelector('#view canvas');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-3-game.png` });
  // select all, open a building card
  await page.click('[data-tool="all"]');
  const v = await page.$('#view');
  const box = await v.boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-4-select.png` });
  // fast forward to night
  await page.evaluate(() => { const s = window.bg.game.sess; s.skip(); });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/${name}-5-night.png` });
  await ctx.close();
}

await campaign('desktop', { width: 1366, height: 820 });
await campaign('mobile', { width: 390, height: 844 }, { isMobile: true, hasTouch: true });
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No page errors.');
