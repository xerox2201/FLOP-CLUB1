import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const TARGETS = [
  { input: 'apps/mini-app/public/table-top-desktop.png', quality: 82 },
  { input: 'apps/mini-app/public/table-top-mobile.png', quality: 82 },
];

for (const t of TARGETS) {
  const out = t.input.replace(/\.png$/, '.webp');
  try {
    const before = (await stat(t.input)).size;
    await sharp(t.input).webp({ quality: t.quality, effort: 6 }).toFile(out);
    const after = (await stat(out)).size;
    console.log(
      `✅ ${t.input.split('/').pop()}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`
    );
  } catch (e) {
    console.error(`❌ ${t.input}:`, e.message);
  }
}