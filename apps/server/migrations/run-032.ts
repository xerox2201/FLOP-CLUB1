import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

async function main() {
  const sqlPath = path.join(__dirname, '032_community_posts.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 032 applied');

  const t = await db.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='community_posts_log' ORDER BY ordinal_position`,
  );
  console.log('📋 Columns:', t.rows.map((r: any) => r.column_name).join(', '));
  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
