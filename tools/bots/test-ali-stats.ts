import 'dotenv/config';

const base = 'http://localhost:4000';

async function main() {
  const userJson = JSON.stringify({
    id: 111,
    first_name: 'Ali',
    username: 'ali',
    language_code: 'en',
  });
  const initData = `user=${encodeURIComponent(userJson)}&auth_date=9999999999&hash=dev`;

  const loginRes = await fetch(`${base}/api/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  if (!loginRes.ok) {
    console.error('❌ Login failed:', loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const { token } = await loginRes.json();
  console.log('✅ Logged in as Ali\n');

  const meRes = await fetch(`${base}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    console.error('❌ /api/me failed:', meRes.status, await meRes.text());
    process.exit(1);
  }
  const me = await meRes.json();

  console.log('📊 Ali stats from /api/me:');
  console.log(JSON.stringify(me.stats, null, 2));
  console.log('');

  const lvl = Math.floor(Number(me.stats.totalWon) / 100) + 1;
  console.log(`   → Level = ${lvl}\n`);
  console.log(
    Number(me.stats.totalWon) === 0 && Number(me.stats.handsWon) === 0
      ? '✅ RESET WORKING — totalWon=0, handsWon=0'
      : `❌ totalWon=${me.stats.totalWon}, handsWon=${me.stats.handsWon}`,
  );
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
