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
  const sqlPath = path.join(__dirname, '029_referral.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('▶ Running:', sqlPath);
  await db.query(sql);
  console.log('✅ Migration 029 applied');

  const t = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN (
      'referral_edges','referral_earnings','group_affiliates',
      'group_members','referral_milestones','referral_milestone_claims',
      'referral_duo_bonuses','pending_referrals'
    ) ORDER BY table_name
  `);
  console.log('📋 Tables:', t.rows.map((r: any) => r.table_name).join(', '));

  const u = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE referral_code IS NOT NULL)::int AS with_code
     FROM users`,
  );
  console.log(`📊 Users: ${u.rows[0].total} total, ${u.rows[0].with_code} with code`);

  await db.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
