import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log(`[env] loaded. JWT_SECRET=${(process.env.JWT_SECRET ?? '').slice(0, 8)}...`);