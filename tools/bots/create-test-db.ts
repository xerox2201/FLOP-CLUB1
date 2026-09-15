import { Pool } from 'pg';

const admin = new Pool({
  connectionString: 'postgres://poker:pokerpass@localhost:5432/postgres',
});

try {
  await admin.query('CREATE DATABASE poker_test');
  console.log('✅ Database poker_test created');
} catch (e) {
  if (e.code === '42P04') {
    console.log('ℹ️  Database poker_test already exists');
  } else {
    console.error('❌ Error:', e.message);
  }
}

await admin.end();
