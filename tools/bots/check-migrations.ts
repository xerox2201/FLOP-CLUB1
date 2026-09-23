$content = @'
import { Pool } from 'pg';
import 'dotenv/config';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log('=== 1. Migration 018 - Loyalty tables ===');
  const t018 = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('user_xp','user_tier','rakeback_log','xp_transactions','shop_purchases','vouchers','seeds')
     ORDER BY table_name`
  );
  console.log('  ', t018.rows.map((r) => r.table_name));

  console.log('\n=== 2. Migration 020 - shop_purchases extra cols ===');
  const c020 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='shop_purchases' AND column_name IN ('discount_pct','level_at_purchase')`
  );
  console.log('  ', c020.rows.map((r) => r.column_name));

  console.log('\n=== 3. Migration 021 - users bonus cols ===');
  const c021 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='users'
       AND (column_name LIKE 'bonus%' OR column_name = 'last_daily_refill_at')
     ORDER BY column_name`
  );
  console.log('  ', c021.rows.map((r) => r.column_name));

  console.log('\n=== 4. Migration 017 - free_chips extra cols ===');
  const c017 = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='free_chips' AND column_name IN ('free_won','free_hands_won')
     ORDER BY column_name`
  );
  console.log('  ', c017.rows.map((r) => r.column_name));

  console.log('\n=== 5. Migration 016 - user_stats_reset ===');
  const t016 = await db.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_stats_reset') AS exists`
  );
  console.log('  ', t016.rows[0]);

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
'@

[System.IO.File]::WriteAllText("C:\projects\poker-platform\tools\bots\check-migrations.ts", $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "File written (no BOM)" -ForegroundColor Green
Get-Item "C:\projects\poker-platform\tools\bots\check-migrations.ts" | Select-Object Name, Length