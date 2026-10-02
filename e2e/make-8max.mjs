// Dev utility: create a dedicated 8-max test table.
import fs from 'fs';
import pg from 'pg';

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = new pg.Pool({ connectionString: env.DATABASE_URL });

const cols = (
  await db.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='poker_tables' ORDER BY ordinal_position",
  )
).rows;
console.log('poker_tables columns:');
cols.forEach((c) => console.log('  ' + c.column_name.padEnd(20) + c.data_type + (c.is_nullable === 'NO' ? ' NOT NULL' : '') + (c.column_default ? ' default ' + c.column_default : '')));

const existing = (await db.query("SELECT id, name, seats, mode, variant FROM poker_tables ORDER BY id")).rows;
console.log('\nexisting tables:');
existing.forEach((t) => console.log('  #' + t.id + ' ' + t.name + ' seats=' + t.seats + ' ' + t.mode + ' ' + t.variant));

// the id sequence is behind the existing rows -> resync before inserting
await db.query("SELECT setval('poker_tables_id_seq', (SELECT COALESCE(MAX(id),1) FROM poker_tables))");
const found = existing.find((t) => t.name === 'Test 8-Max');
if (!found) {
  const ins = await db.query(
    `INSERT INTO poker_tables (name, variant, mode, seats, blinds, min_buyin, max_buyin, rake_pct, is_active)
     VALUES ('Test 8-Max','holdem','free',8,'{"sb":5,"bb":10,"ante":0}'::jsonb,100,2000,0,true)
     RETURNING id, name, seats`,
  ).catch(async (e) => {
    console.log('\ninsert with full column set failed: ' + e.message);
    const alt = await db.query(
      `INSERT INTO poker_tables (name, variant, mode, seats, blinds) VALUES ('Test 8-Max','holdem','free',8,'{"sb":5,"bb":10,"ante":0}'::jsonb) RETURNING id, name, seats`,
    );
    return alt;
  });
  console.log('\ncreated: #' + ins.rows[0].id + ' ' + ins.rows[0].name + ' seats=' + ins.rows[0].seats);
} else {
  console.log('\nalready exists: #' + found.id + ' ' + found.name);
}
await db.end();
