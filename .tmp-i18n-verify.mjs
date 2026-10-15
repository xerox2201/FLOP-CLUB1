import { readFileSync } from 'node:fs';

const root = 'C:/projects/poker-platform/apps/mini-app/src/i18n/catalog/';
const load = (f) => {
  const src = readFileSync(root + f, 'utf8').replace(/^export default/, 'export default');
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
};
const en = (await load('en.ts')).default;
const tr = (await load('tr.ts')).default;

const leaves = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${p}${k}`] : leaves(v, `${p}${k}.`),
  );
const lookup = (o, key) => key.split('.').reduce((a, k) => a?.[k], o);

const enKeys = new Set(leaves(en));
const trKeys = leaves(tr);
const ph = (v) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const spec = readFileSync('C:/projects/poker-platform/WAVE_E_KEYS.md', 'utf8')
  .split(/\r?\n/)
  .slice(18)
  .filter((l) => l && l !== '```')
  .map((l) => l.split(' ')[0]);

const problems = [];
const missing = spec.filter((k) => !trKeys.includes(k));
if (missing.length) problems.push('MISSING: ' + missing.join(', '));

const extra = trKeys.filter((k) => !enKeys.has(k));
if (extra.length) problems.push('NOT IN EN: ' + extra.join(', '));

const phBad = trKeys.filter((k) => enKeys.has(k) && ph(lookup(tr, k)) !== ph(lookup(en, k)));
if (phBad.length) problems.push('PLACEHOLDER MISMATCH: ' + phBad.join(', '));

const emoji = trKeys.filter((k) => /\p{Extended_Pictographic}/u.test(lookup(tr, k)));
if (emoji.length) problems.push('EMOJI: ' + emoji.join(', '));

const tokens = ['XP', 'TON', 'LVL', 'MAX', 'USE', 'TBA', '24h', '7d', '30d', 'SHA-256',
  'SHA256(seed)', 'HMAC-SHA256', 'deck-v2', 'tx_hash', '00:00 UTC', 'EQ...',
  '8-64 chars: A-Z a-z 0-9 - _'];
const tokenMiss = [];
for (const t of tokens) {
  if (!enKeys.size) continue;
  for (const k of trKeys) {
    if (!enKeys.has(k)) continue;
    const e = lookup(en, k);
    const v = lookup(tr, k);
    const count = (s) => s.split(t).length - 1;
    if (count(e) > count(v)) tokenMiss.push(`${k}: ${t}`);
  }
}
if (tokenMiss.length) problems.push('TOKEN DROPPED: ' + tokenMiss.join(', '));

console.log('spec keys:', spec.length, '| tr leaves:', trKeys.length, '| en leaves:', enKeys.size);
console.log(problems.length ? problems.join('\n') : 'ALL CHECKS PASSED');
