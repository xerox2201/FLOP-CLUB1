import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const IS_PROD = process.env.NODE_ENV === 'production';

interface EnvSpec {
  name: string;
  forbidden?: string[];
}

const REQUIRED_IN_PROD: EnvSpec[] = [
  { name: 'JWT_SECRET', forbidden: ['dev_secret_change_me'] },
  { name: 'ADMIN_SECRET', forbidden: ['admin_dev_secret'] },
  { name: 'DATABASE_URL' },
  { name: 'TELEGRAM_BOT_TOKEN' },
];

const OPTIONAL: string[] = [
  'REDIS_URL',
  'TON_HOT_WALLET_MNEMONIC',
  'TON_DEPOSIT_ADDRESS',
  'CORS_ORIGINS',
];

function validateEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of REQUIRED_IN_PROD) {
    const val = process.env[spec.name];
    if (!val) {
      errors.push(`Missing required env: ${spec.name}`);
      continue;
    }
    if (spec.forbidden && spec.forbidden.includes(val)) {
      errors.push(
        `Env ${spec.name} is using INSECURE default value ("${val}") — change before production`,
      );
    }
  }

  for (const name of OPTIONAL) {
    if (!process.env[name]) {
      warnings.push(`Optional env not set: ${name}`);
    }
  }

  for (const w of warnings) {
    console.warn(`[env] ⚠️  ${w}`);
  }

  if (errors.length === 0) return;

  if (IS_PROD) {
    console.error('[env] ❌ FATAL: environment validation failed:');
    for (const e of errors) console.error(`   - ${e}`);
    process.exit(1);
  }

  console.warn('[env] 🧪 dev mode — validation errors ignored:');
  for (const e of errors) console.warn(`   - ${e}`);
}

validateEnv();

const jwtPreview = (process.env.JWT_SECRET ?? '').slice(0, 8);
console.log(
  `[env] loaded. NODE_ENV=${process.env.NODE_ENV ?? 'development'} JWT_SECRET=${jwtPreview}...`,
);
