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
  const sqlPath = path.join(__dirname, '028_telegram_community.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 028 applied');

  const t = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN (
      'telegram_chats','telegram_memberships','telegram_invite_links',
      'telegram_post_templates','telegram_bot_actions'
    ) ORDER BY table_name
  `);
  console.log('📋 Tables:', t.rows.map((r: any) => r.table_name).join(', '));

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
