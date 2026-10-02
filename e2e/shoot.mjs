// Dev-only screenshot + console-error harness.
// Run: node e2e/shoot.mjs
// Writes PNGs to %TEMP%/flopclub-shots (outside the repo, nothing to gitignore).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = path.join(process.env.TEMP || '.', 'flopclub-shots');
fs.mkdirSync(OUT, { recursive: true });

const DEV_URL = 'http://localhost:5173/?uid=222&name=Sara';
const problems = [];

async function shoot(page, name) {
  const file = path.join(OUT, name + '.png');
  await page.screenshot({ path: file });
  console.log('shot: ' + file);
}

const browser = await chromium.launch();

// ---------- mobile 393x852 ----------
const mobile = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
});
const page = await mobile.newPage();
page.on('pageerror', (e) => problems.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push('CONSOLE: ' + m.text().slice(0, 300));
});

try {
  await page.goto(DEV_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000); // socket + /api/home
  await shoot(page, '01-home-mobile');

  // discover the bottom-nav buttons so navigation is data-driven, not guessed
  const btns = await page.locator('button').allInnerTexts();
  const cleaned = [...new Set(btns.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  console.log('--- visible button labels ---');
  cleaned.forEach((t, i) => console.log('  [' + i + '] ' + t.slice(0, 60)));

  // Walk the FIXED BOTTOM NAV. Text matching alone is ambiguous (the drawer
  // menu carries the same labels), so pick the candidate that actually sits in
  // the bottom bar: its bounding box is inside the lower part of the viewport.
  const navLabels = [
    ['Tables', 'tables'],
    ['Tourneys', 'tournaments'],
    ['Wallet', 'wallet'],
    ['Me', 'profile'],
  ];
  let idx = 2;
  for (const [label, slug] of navLabels) {
    const cand = page.getByText(label, { exact: true });
    const count = await cand.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const box = await cand.nth(i).boundingBox().catch(() => null);
      if (box && box.y > 700 && box.height > 0) {
        await cand.nth(i).click({ timeout: 5000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    console.log('nav ' + label + ' -> ' + (clicked ? 'clicked bottom-nav item' : 'NO bottom-nav item found'));
    await page.waitForTimeout(2500);
    await shoot(page, String(idx).padStart(2, '0') + '-' + slug + '-mobile');
    idx++;
  }
  // back to the Tables list first (the last nav click landed on Profile)
  const tback = page.getByText('Tables', { exact: true });
  for (let i = 0; i < (await tback.count()); i++) {
    const b = await tback.nth(i).boundingBox().catch(() => null);
    if (b && b.y > 700 && b.height > 0) { await tback.nth(i).click({ timeout: 5000 }).catch(() => {}); break; }
  }
  await page.waitForTimeout(3000);
  // open the first cash table to reach the live table screen
  const card = page.getByText('Test 8-Max', { exact: false }).first();
  if (await card.count()) {
    await card.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await shoot(page, '06-table-mobile');
    // any buy-in / seat sheet that appeared
    const buy = page.getByText('Buy-in', { exact: false }).first();
    if (await buy.count()) await shoot(page, '07-buyin-mobile');
  } else console.log('table card not found');
} catch (e) {
  console.log('MOBILE PASS ERROR: ' + e.message);
}

// ---------- desktop 1920x1080 ----------
const desktop = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const dpage = await desktop.newPage();
dpage.on('pageerror', (e) => problems.push('DESKTOP PAGEERROR: ' + e.message));
dpage.on('console', (m) => {
  if (m.type() === 'error') problems.push('DESKTOP CONSOLE: ' + m.text().slice(0, 300));
});
try {
  await dpage.goto(DEV_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await dpage.waitForTimeout(4000);
  await shoot(dpage, '10-home-desktop');
  const t = dpage.getByText('Cash Games', { exact: true }).first();
  if (await t.count()) {
    await t.click({ timeout: 5000 }).catch(() => {});
    await dpage.waitForTimeout(2500);
    await shoot(dpage, '11-tables-desktop');
  }
} catch (e) {
  console.log('DESKTOP PASS ERROR: ' + e.message);
}

await browser.close();

console.log('\n=== browser console / page errors (' + problems.length + ') ===');
const uniq = [...new Set(problems)];
uniq.slice(0, 25).forEach((p) => console.log('  ' + p));
if (!uniq.length) console.log('  none');
