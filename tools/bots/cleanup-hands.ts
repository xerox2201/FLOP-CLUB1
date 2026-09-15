import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker';

async function main() {
  const db = new Pool({ connectionString: DATABASE_URL });
  console.log('Cleaning up test data...\n');

  await db.query('TRUNCATE hand_events RESTART IDENTITY CASCADE');
  console.log('✅ hand_events cleared');

  await db.query('TRUNCATE hand_snapshots RESTART IDENTITY CASCADE');
  console.log('✅ hand_snapshots cleared');

  await db.query('TRUNCATE hands RESTART IDENTITY CASCADE');
  console.log('✅ hands cleared');

  await db.query('TRUNCATE table_seats RESTART IDENTITY CASCADE');
  console.log('✅ table_seats cleared');

  await db.query('TRUNCATE play_money_log RESTART IDENTITY CASCADE');
  console.log('✅ play_money_log cleared');

  await db.end();
  console.log('\n✅ Done');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});