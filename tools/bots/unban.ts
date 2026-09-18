import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const res = await db.query('UPDATE users SET is_banned = FALSE RETURNING id, display_name');
console.log(`✅ Unbanned ${res.rowCount} users:`);
for (const u of res.rows) console.log(`   - ${u.display_name} (id=${u.id})`);
await db.end();
