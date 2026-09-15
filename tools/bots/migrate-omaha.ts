import 'dotenv/config';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker';

async function main() {
  const db = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('[migrate] Connecting to DB...');

    // Check existing tables
    const existing = await db.query(
      'SELECT id, name, variant FROM poker_tables WHERE is_active = TRUE ORDER BY id',
    );
    console.log('[migrate] Existing tables:');
    for (const row of existing.rows) {
      console.log(`  id=${row.id} | ${row.name} | variant=${row.variant}`);
    }

    // Check if Omaha tables exist
    const hasOmaha4 = existing.rows.some((r: any) => r.variant === 'omaha4');
    const hasOmaha5 = existing.rows.some((r: any) => r.variant === 'omaha5');

    if (hasOmaha4 && hasOmaha5) {
      console.log('[migrate] ✅ Omaha tables already exist. Skipping insert.');
    } else {
      // Get max id
      const maxId = await db.query('SELECT COALESCE(MAX(id), 0) as m FROM poker_tables');
      const nextId = Number(maxId.rows[0].m) + 1;
      console.log(`[migrate] Max existing id: ${maxId.rows[0].m}, next: ${nextId}`);

      // Insert Omaha tables
      if (!hasOmaha4) {
        const res = await db.query(
          `INSERT INTO poker_tables (id, name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            nextId,
            'Omaha 4 - Micro',
            'omaha4',
            'cash',
            'regular',
            JSON.stringify({ sb: 0.05, bb: 0.1, ante: 0 }),
            5,
            100,
            0.03,
            6,
            true,
          ],
        );
        console.log(`[migrate] ✅ Inserted Omaha4 with id=${res.rows[0].id}`);
      }

      if (!hasOmaha5) {
        const res = await db.query(
          `INSERT INTO poker_tables (id, name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            nextId + 1,
            'Omaha 5 - Micro',
            'omaha5',
            'cash',
            'regular',
            JSON.stringify({ sb: 0.05, bb: 0.1, ante: 0 }),
            5,
            100,
            0.03,
            6,
            true,
          ],
        );
        console.log(`[migrate] ✅ Inserted Omaha5 with id=${res.rows[0].id}`);
      }
    }

    // Final listing
    const final = await db.query(
      'SELECT id, name, variant FROM poker_tables WHERE is_active = TRUE ORDER BY id',
    );
    console.log('');
    console.log('[migrate] Final tables:');
    for (const row of final.rows) {
      console.log(`  id=${row.id} | ${row.name} | variant=${row.variant}`);
    }

    // Print IDs for convenience
    const omaha4 = final.rows.find((r: any) => r.variant === 'omaha4');
    const omaha5 = final.rows.find((r: any) => r.variant === 'omaha5');
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  USE THESE VALUES:');
    if (omaha4) console.log(`  Omaha4 → TABLE_ID=${omaha4.id}`);
    if (omaha5) console.log(`  Omaha5 → TABLE_ID=${omaha5.id}`);
    console.log('═══════════════════════════════════════════');

    await db.end();
    process.exit(0);
  } catch (e: any) {
    console.error('[migrate] ❌ ERROR:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
