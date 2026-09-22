import { Pool } from 'pg';
import * as readline from 'readline';
import 'dotenv/config';

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://poker:pokerpass@localhost:5432/poker',
});

function ask(q: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(q + ' [y/N] ', (a) => {
      rl.close();
      resolve(a.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('=== STEP 1: All poker_tables ===\n');
  const all = await db.query(
    `SELECT id, name, variant, mode, is_active FROM poker_tables ORDER BY id`,
  );
  console.table(all.rows);

  console.log('\n=== STEP 2: Plan (keep LOWEST ACTIVE id per name+variant+mode) ===\n');
  // Only among ACTIVE tables: keep lowest id, deactivate the rest
  const plan = await db.query(`
    WITH ranked AS (
      SELECT id, name, variant, mode, is_active,
             ROW_NUMBER() OVER (
               PARTITION BY name, variant, mode
               ORDER BY id
             ) AS rn
      FROM poker_tables
      WHERE is_active = TRUE
    )
    SELECT id, name, variant, mode, is_active,
      CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DEACTIVATE' END AS action
    FROM ranked
    ORDER BY name, variant, mode, id
  `);
  console.table(plan.rows);

  const toDeactivate = plan.rows.filter((r) => r.action === 'DEACTIVATE');
  console.log(`\nWill deactivate: ${toDeactivate.length} active table(s)`);

  const testTable = all.rows.find(
    (r) => r.is_active && r.name.toLowerCase().includes('test'),
  );

  if (toDeactivate.length > 0) {
    const ok = await ask('\nApply deactivation of duplicates?');
    if (!ok) {
      console.log('Cancelled.');
      await db.end();
      return;
    }

    const upd = await db.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY name, variant, mode
                 ORDER BY id
               ) AS rn
        FROM poker_tables
        WHERE is_active = TRUE
      )
      UPDATE poker_tables pt
      SET is_active = FALSE
      FROM ranked
      WHERE pt.id = ranked.id AND ranked.rn > 1
      RETURNING pt.id, pt.name
    `);
    console.log(`\nOK. Deactivated ${upd.rowCount} table(s)`);
    for (const r of upd.rows) console.log(`   - #${r.id} ${r.name}`);
  } else {
    console.log('\nNo duplicates to deactivate.');
  }

  if (testTable) {
    const ok2 = await ask(
      `\nAlso deactivate test table #${testTable.id} "${testTable.name}"?`,
    );
    if (ok2) {
      await db.query(`UPDATE poker_tables SET is_active = FALSE WHERE id = $1`, [
        testTable.id,
      ]);
      console.log(`Deactivated #${testTable.id}`);
    }
  }

  console.log('\n=== STEP 3: Final active tables ===\n');
  const active = await db.query(
    `SELECT id, name, variant, mode FROM poker_tables WHERE is_active = TRUE ORDER BY id`,
  );
  console.table(active.rows);

  await db.end();
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});