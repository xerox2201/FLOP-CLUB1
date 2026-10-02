/**
 * P2 wave C — mechanical migration from physical to logical direction utilities.
 *
 * Usage:
 *   node tools/i18n-logical-codemod.mjs           # dry run, prints rule counts
 *   node tools/i18n-logical-codemod.mjs --write   # applies the changes
 *
 * Two things are deliberately NOT touched:
 *   - bare `left:` / `right:` CSS declarations and `*-1/2` offsets. Those are
 *     physical centering (`left: 50%` + `translateX(-50%)`), which produces the
 *     same result in RTL; converting them would require flipping every translate.
 *   - `Admin.svelte` and `TournamentFieldsDebug.svelte`, which stay English-only.
 *
 * The poker felt is safe either way: it is a `dir="ltr"` island, where logical
 * utilities resolve to their physical LTR equivalents.
 */

import fs from 'fs';
import path from 'path';

const ROOT = 'apps/mini-app/src';
const WRITE = process.argv.includes('--write');

const EXCLUDE = [
  'routes/Admin.svelte',
  'components/TournamentFieldsDebug.svelte',
  // Never touch these: they are comments/prose, not classes.
  // (guarded by negative lookaheads in the rules below instead)
];

const RULES = [
  { name: 'ml-* -> ms-*', re: /\bml-/g, to: 'ms-' },
  { name: 'mr-* -> me-*', re: /\bmr-/g, to: 'me-' },
  { name: 'pl-* -> ps-*', re: /\bpl-/g, to: 'ps-' },
  { name: 'pr-* -> pe-*', re: /\bpr-/g, to: 'pe-' },
  {
    name: '-left-* -> -start-*',
    re: /-left-(?!1\/2)/g,
    to: '-start-',
  },
  {
    name: '-right-* -> -end-*',
    re: /-right-(?!1\/2)/g,
    to: '-end-',
  },
  {
    name: 'left-* -> start-*',
    re: /\bleft-(?!1\/2|to-right|aligned)/g,
    to: 'start-',
  },
  {
    name: 'right-* -> end-*',
    re: /\bright-(?!1\/2|to-left|aligned)/g,
    to: 'end-',
  },
  { name: 'text-left -> text-start', re: /\btext-left\b/g, to: 'text-start' },
  { name: 'text-right -> text-end', re: /\btext-right\b/g, to: 'text-end' },
  { name: 'border-left -> border-inline-start', re: /\bborder-left:/g, to: 'border-inline-start:' },
  { name: 'border-right -> border-inline-end', re: /\bborder-right:/g, to: 'border-inline-end:' },
  { name: 'padding-left -> padding-inline-start', re: /\bpadding-left:/g, to: 'padding-inline-start:' },
  { name: 'padding-right -> padding-inline-end', re: /\bpadding-right:/g, to: 'padding-inline-end:' },
  { name: 'margin-left -> margin-inline-start', re: /\bmargin-left:/g, to: 'margin-inline-start:' },
  { name: 'margin-right -> margin-inline-end', re: /\bmargin-right:/g, to: 'margin-inline-end:' },
  { name: 'text-[9px] -> text-micro', re: /text-\[9px\]/g, to: 'text-micro' },
  { name: 'text-[10px] -> text-mini', re: /text-\[10px\]/g, to: 'text-mini' },
  { name: 'text-[11px] -> text-tiny', re: /text-\[11px\]/g, to: 'text-tiny' },
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.svelte')) files.push(full);
  }
  return files;
}

const counts = new Map(RULES.map((rule) => [rule.name, 0]));
let changedFiles = 0;

for (const file of walk(ROOT)) {
  const relative = path.relative(ROOT, file).replace(/\\/g, '/');
  if (EXCLUDE.includes(relative)) continue;

  const before = fs.readFileSync(file, 'utf8');
  let after = before;

  for (const rule of RULES) {
    after = after.replace(rule.re, (...args) => {
      counts.set(rule.name, counts.get(rule.name) + 1);
      return typeof rule.to === 'function' ? rule.to(...args) : rule.to;
    });
  }

  if (after !== before) {
    changedFiles += 1;
    if (WRITE) fs.writeFileSync(file, after);
  }
}

for (const [name, count] of counts) {
  if (count > 0) console.log(`${String(count).padStart(5)}  ${name}`);
}
console.log(`${WRITE ? 'updated' : 'would update'} ${changedFiles} file(s)`);
