// @ts-ignore
import { xpForNextLevel, levelFromLifetimeXP, levelDiscount, SHOP_PACKS } from '../../apps/server/src/loyalty/definitions.js';

async function main() {
  console.log('═══ XP CURVE ═══');
  console.log('L1→L2  :', xpForNextLevel(1));
  console.log('L5→L6  :', xpForNextLevel(5));
  console.log('L15→L16:', xpForNextLevel(15));
  console.log('L30→L31:', xpForNextLevel(30));
  console.log('L50→L51:', xpForNextLevel(50));
  console.log('L60→L61:', xpForNextLevel(60));
  console.log('L80→L81:', xpForNextLevel(80));

  console.log('\n═══ LEVELS ═══');
  console.log('100 XP → Level', levelFromLifetimeXP(100).level);
  console.log('1,850 XP → Level', levelFromLifetimeXP(1850).level);
  console.log('88,050 XP → Level', levelFromLifetimeXP(88050).level);

  console.log('\n═══ DISCOUNTS ═══');
  console.log('L5  →', levelDiscount(5) * 100 + '%');
  console.log('L10 →', levelDiscount(10) * 100 + '%');
  console.log('L25 →', levelDiscount(25) * 100 + '%');
  console.log('L50 →', levelDiscount(50) * 100 + '%');
  console.log('L80 →', levelDiscount(80) * 100 + '%');

  console.log('\n═══ SHOP PACKS ═══');
  for (const p of SHOP_PACKS) {
    console.log(`${p.id.padEnd(10)} $${p.priceUsd.toString().padEnd(4)} → ${p.chips.toLocaleString().padStart(10)} chips, ${p.xp} XP, voucher $${p.voucher}`);
  }

  // ============ API TESTS ============
  const base = 'http://localhost:4000';
  const initData =
    'user=' +
    encodeURIComponent(
      JSON.stringify({ id: 111, first_name: 'Ali', username: 'ali' }),
    ) +
    '&auth_date=9999999999&hash=dev';

  console.log('\n═══ /api/me/loyalty ═══');
  const loginRes = await fetch(base + '/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  const { token } = await loginRes.json();
  const loyalty = await fetch(base + '/api/me/loyalty', {
    headers: { Authorization: 'Bearer ' + token },
  }).then((r) => r.json());
  console.log(JSON.stringify(loyalty, null, 2));

  console.log('\n═══ /api/shop/packs ═══');
  const packs = await fetch(base + '/api/shop/packs', {
    headers: { Authorization: 'Bearer ' + token },
  }).then((r) => r.json());
  console.log('level:', packs.level, '| discount:', (packs.discountPct * 100) + '%');
  for (const p of packs.packs) {
    console.log(
      `${p.id.padEnd(10)} base $${p.priceUsd} → discounted $${p.priceUsdDiscounted}`,
    );
  }

  console.log('\n═══ /api/xp/convert (expect error) ═══');
  const convert = await fetch(base + '/api/xp/convert', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify({ xp: 5000 }),
  });
  console.log('Status:', convert.status);
  console.log('Body:', await convert.json());
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});