import 'dotenv/config';

async function main() {
  const res = await fetch('http://localhost:4000/api/tables');
  const data: any = await res.json();

  console.log('=== /api/tables raw response ===\n');
  for (const t of data.tables) {
    console.log(
      `#${t.id} "${t.name}" mode=${t.mode} variant=${t.variant} live=${t.livePlayers} max=${t.maxSeats}`,
    );
  }

  console.log('\n=== Sanity check ===');
  const totalLive = data.tables.reduce(
    (sum: number, t: any) => sum + Number(t.livePlayers ?? 0),
    0,
  );
  console.log(`Total live players across all tables: ${totalLive}`);
  console.log(
    totalLive === 0
      ? '⚠️  All tables report 0 — either nobody is at a table, or the live counter is broken'
      : '✅ Live counter is returning non-zero values',
  );
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});