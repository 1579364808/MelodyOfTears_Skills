// Batch screenshot LeetCode problem descriptions (statement + examples + hints),
// clipped tightly to the content (title chip + description body), 2x device scale.
//
// Usage:
//   node screenshot.mjs <problem-list.json>          # all problems
//   node screenshot.mjs <problem-list.json> 34 1 146 # only those problem numbers
//
// <problem-list.json> is an array of { num, slug, title } (title unused; num used
// to verify the page <title> starts with "NUM." before capturing).
//
// Requires a globally installed playwright (npm root -g) and a local Chrome/Edge.
// Override the playwright path with PW_PATH if it's not under E:/Develop/... .

import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PW_PATH = process.env.PW_PATH || 'E:/Develop/npm-global/node_modules/playwright';
const pw = require(PW_PATH);

function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('load failed', p, e.message);
    process.exit(1);
  }
}

const listFile = process.argv[2] || 'problem-list.json';
const problems = loadJson(listFile);
const unique = new Map();
for (const p of problems) if (!unique.has(p.slug)) unique.set(p.slug, p);

const DESC = '[data-track-load*="description"]';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const only = process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
const queue = only.length ? [...unique.values()].filter((p) => only.includes(p.num)) : [...unique.values()];

const browser = await pw.chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, locale: 'zh-CN' });
const page = await ctx.newPage();

fs.mkdirSync('shots', { recursive: true });
const report = [];
let ok = 0;
let bad = 0;
for (const p of queue) {
  const url = `https://leetcode.cn/problems/${p.slug}/`;
  const file = `shots/${p.num}-${p.slug}.png`;
  const rec = { num: p.num, slug: p.slug, url, file };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector(DESC, { timeout: 30000 });
    const title = (await page.title()).trim();
    rec.pageTitle = title;
    rec.titleOk = new RegExp(`^${p.num}\\.`).test(title);
    rec.finalUrl = page.url();
    rec.redirected = !rec.finalUrl.includes(`/problems/${p.slug}/`);
    if (!rec.titleOk || rec.redirected) {
      rec.verdict = 'TITLE_MISMATCH';
      bad++;
      console.log(`${p.num} ${p.slug}  TITLE_MISMATCH  title="${title.slice(0, 50)}"`);
      report.push(rec);
      continue;
    }
    // Let images and webfonts settle before measuring/capturing.
    await page.evaluate(async (sel) => {
      const imgs = [...document.querySelectorAll(`${sel} img`)];
      await Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    }, DESC);
    await sleep(350);
    // Reset scroll positions so viewport coordinates match page coordinates.
    await page.evaluate((sel) => {
      window.scrollTo(0, 0);
      const d = document.querySelector(sel);
      let n = d.parentElement;
      for (let i = 0; i < 6 && n; i++) {
        if ((n.className || '').toString().includes('overflow-y-auto')) n.scrollTop = 0;
        n = n.parentElement;
      }
    }, DESC);
    await sleep(250);
    const geo = await page.evaluate((sel) => {
      const d = document.querySelector(sel);
      const t = document.querySelector('div[class*="text-title-large"]');
      const dr = d.getBoundingClientRect();
      const tr = t ? t.getBoundingClientRect() : dr;
      const left = Math.max(0, Math.floor(Math.min(dr.left, tr.left) - 8));
      const right = Math.ceil(Math.max(dr.right, tr.right) + 8);
      const top = Math.max(0, Math.floor(Math.min(dr.top, tr.top) - 8));
      const bottom = Math.ceil(dr.bottom + 8);
      return { x: left, y: top, width: right - left, height: bottom - top, hasTitle: !!t };
    }, DESC);
    rec.geo = geo;
    await page.setViewportSize({ width: 1280, height: Math.min(geo.y + geo.height + 40, 7000) });
    await sleep(350);
    await page.screenshot({ path: file, clip: { x: geo.x, y: geo.y, width: geo.width, height: geo.height }, scale: 'device' });
    const buf = fs.readFileSync(file);
    rec.imgW = buf.readUInt32BE(16);
    rec.imgH = buf.readUInt32BE(20);
    rec.kb = Math.round(buf.length / 1024);
    rec.verdict = geo.hasTitle ? 'ok' : 'no-title';
    if (geo.hasTitle) ok++; else bad++;
    console.log(`${p.num} ${p.slug}  ${rec.imgW}x${rec.imgH}  ${rec.kb}KB  title="${title.slice(0, 34)}"`);
  } catch (e) {
    rec.verdict = 'FAIL';
    rec.error = String(e.message || e).slice(0, 100);
    bad++;
    console.log(`${p.num} ${p.slug}  FAIL  ${rec.error}`);
  }
  report.push(rec);
  await sleep(900);
}
await browser.close();
fs.writeFileSync('screenshot-report.json', JSON.stringify(report, null, 2));
console.log(`\ndone: ok=${ok} bad=${bad} of ${queue.length}`);