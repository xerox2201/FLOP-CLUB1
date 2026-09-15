import dotenv from 'dotenv';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker';
const file = process.argv[2] || '006_ledger_and_events.sql';

async function main() {
  const db = new Pool({ connectionString: DATABASE_URL });
  const filePath = path.resolve(__dirname, '../../infra/sql', file);

  console.log(`Running: ${filePath}`);
  const sql = fs.readFileSync(filePath, 'utf8');
  await db.query(sql);
  console.log('✅ Done');

  await db.end();
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
