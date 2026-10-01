import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://poker:pokerpass@localhost:5432/poker',
});

const FIRST_NAMES = [
  'Alex',
  'Sara',
  'Mike',
  'Nina',
  'Leo',
  'Emma',
  'Dan',
  'Lily',
  'Max',
  'Zoe',
  'Tom',
  'Amy',
  'Joe',
  'Mia',
  'Sam',
  'Ava',
  'Ben',
  'Ella',
  'Oscar',
  'Ruby',
  'Jack',
  'Aria',
  'Liam',
  'Chloe',
  'Noah',
  'Grace',
  'Ryan',
  'Ivy',
  'Adam',
  'Sky',
  'Owen',
  'Nora',
  'Finn',
  'Iris',
  'Luca',
  'Wren',
  'Kai',
  'Juno',
  'Reid',
  'Vera',
];

const LAST_NAMES = [
  'King',
  'Shark',
  'Ace',
  'Queen',
  'Wolf',
  'Fox',
  'Tiger',
  'Lion',
  'Eagle',
  'Dragon',
  'Falcon',
  'Panther',
  'Cobra',
  'Viper',
  'Phoenix',
  'Raven',
  'Storm',
  'Blade',
  'Knight',
  'Sage',
];

const AVATAR_IDS = [
  'king',
  'queen',
  'shark',
  'fox',
  'wolf',
  'lion',
  'dragon',
  'eagle',
  'cat',
  'ghost',
  'pirate',
  'wizard',
  'samurai',
  'sphinx',
  'vampire',
  'angel',
];

const BOT_ID_START = 900000000;
const BOT_COUNT = 100;

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 2): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

async function main() {
  console.log('🤖 Seeding 100 test bots...\n');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. Ensure leaderboard period ───
    let periodRes = await client.query(
      `SELECT id FROM leaderboard_periods
       WHERE status = 'open' AND NOW() BETWEEN period_start AND period_end
       ORDER BY period_start DESC LIMIT 1`,
    );
    let periodId: number;
    if (periodRes.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO leaderboard_periods (period_start, period_end, prize_pool_usd, status)
         VALUES (
           date_trunc('month', NOW())::date,
           (date_trunc('month', NOW()) + INTERVAL '1 month - 1 day')::date,
           0, 'open'
         ) RETURNING id`,
      );
      periodId = Number(ins.rows[0].id);
    } else {
      periodId = Number(periodRes.rows[0].id);
    }
    console.log(`📅 Leaderboard period: #${periodId}`);

    // ─── 2. Find existing bot IDs to clean ───
    const oldBots = await client.query(
      `SELECT id FROM users WHERE telegram_id >= $1 AND telegram_id < $2`,
      [BOT_ID_START, BOT_ID_START + BOT_COUNT],
    );
    const oldIds = oldBots.rows.map((r: any) => Number(r.id));

    if (oldIds.length > 0) {
      // Delete FK-dependent rows (in correct order)
      await client.query(`DELETE FROM leaderboard_entries WHERE user_id = ANY($1::bigint[])`, [
        oldIds,
      ]);
      await client.query(`DELETE FROM ton_transactions WHERE user_id = ANY($1::bigint[])`, [
        oldIds,
      ]);
      await client.query(`DELETE FROM tournament_entries WHERE user_id = ANY($1::bigint[])`, [
        oldIds,
      ]);
      await client.query(`DELETE FROM tournament_players WHERE user_id = ANY($1::bigint[])`, [
        oldIds,
      ]);
      await client.query(`DELETE FROM accounts WHERE owner_user_id = ANY($1::bigint[])`, [oldIds]);
      await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[])`, [oldIds]);
      console.log(`🗑️  Cleaned ${oldIds.length} old bots\n`);
    }

    // ─── 3. Insert 100 bots ───
    for (let i = 0; i < BOT_COUNT; i++) {
      const telegramId = BOT_ID_START + i;
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const displayName = `${firstName} ${lastName}`;
      const username = `${firstName.toLowerCase()}_${rand(1000, 9999)}`;
      const avatarId = pick(AVATAR_IDS);

      const userRes = await client.query(
        `INSERT INTO users (telegram_id, username, display_name, avatar_id, language)
         VALUES ($1, $2, $3, $4, 'en')
         RETURNING id`,
        [telegramId, username, displayName, avatarId],
      );
      const userId = Number(userRes.rows[0].id);

      // Balance: 5-5000 USD
      const balance = randFloat(5, 5000);

      // Rake → tier
      const lifetimeRake = randFloat(0, 15000);
      let tier = 'welcome';
      if (lifetimeRake >= 10000) tier = 'diamond';
      else if (lifetimeRake >= 2500) tier = 'platinum';
      else if (lifetimeRake >= 500) tier = 'gold';
      else if (lifetimeRake >= 100) tier = 'silver';
      else if (lifetimeRake >= 25) tier = 'bronze';

      await client.query(
        `INSERT INTO user_tier (user_id, tier, lifetime_rake)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET tier = $2, lifetime_rake = $3`,
        [userId, tier, lifetimeRake],
      );

      // XP roughly proportional to rake
      const lifetimeXp = Math.round(lifetimeRake * randFloat(50, 200));
      await client.query(
        `INSERT INTO user_xp (user_id, lifetime_xp, claimed_xp)
         VALUES ($1, $2, 0)
         ON CONFLICT (user_id) DO UPDATE SET lifetime_xp = $2`,
        [userId, lifetimeXp],
      );

      // Free chips
      const freeChips = rand(1000, 50000);
      const freeHands = rand(50, 5000);
      const freeWins = Math.round(freeHands * randFloat(0.2, 0.6));
      const freeWon = Math.round(freeChips * randFloat(0.1, 1.5));
      await client.query(
        `INSERT INTO free_chips (user_id, chips, total_hands, free_won, free_hands_won)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           chips = $2, total_hands = $3, free_won = $4, free_hands_won = $5`,
        [userId, freeChips, freeHands, freeWon, freeWins],
      );

      // Leaderboard: hands_played + total_won_usd (power curve for nice distribution)
      const t = Math.random();
      const handsPlayed = 20 + Math.floor(Math.pow(t, 1.5) * 800);
      const totalWon = 20 + Math.pow(t, 2.5) * 8000;

      await client.query(
        `INSERT INTO leaderboard_entries (period_id, user_id, hands_played, total_won_usd)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (period_id, user_id) DO UPDATE SET
           hands_played = $3, total_won_usd = $4`,
        [periodId, userId, handsPlayed, Number(totalWon.toFixed(2))],
      );

      // Wallet
      await client.query(
        `INSERT INTO wallets (user_id, balance_usd)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance_usd = $2`,
        [userId, balance],
      );

      // Ledger account
      await client.query(
        `INSERT INTO accounts (code, type, owner_user_id)
         VALUES ($1, 'user', $2)
         ON CONFLICT (code) DO NOTHING`,
        [`USER_${userId}`, userId],
      );

      // TON deposit history (70% chance)
      if (Math.random() > 0.3) {
        const depositTon = randFloat(1, 50, 2);
        const tonRate = 5.5;
        const depositUsd = Number((depositTon * tonRate).toFixed(2));
        const txHash = `seed_bot_${i}_${Date.now()}_${rand(1000, 9999)}`;
        const daysAgo = rand(1, 30);

        await client.query(
          `INSERT INTO ton_transactions
            (user_id, direction, amount_ton, amount_usd, tx_hash, from_address, to_address, memo, status, confirmations, confirmed_at)
           VALUES ($1, 'deposit', $2, $3, $4, 'seed_deposit_addr', 'deposit_addr', $5, 'confirmed', 1, NOW() - INTERVAL '${daysAgo} days')`,
          [userId, depositTon, depositUsd, txHash, String(userId)],
        );
      }
    }

    // ─── 4. Recalc ranks ───
    await client.query(
      `WITH ranked AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY total_won_usd DESC, hands_played DESC) as new_rank
         FROM leaderboard_entries WHERE period_id = $1
       )
       UPDATE leaderboard_entries le SET rank = ranked.new_rank FROM ranked WHERE le.id = ranked.id`,
      [periodId],
    );

    await client.query('COMMIT');

    // ─── 5. Summary ───
    const count = await client.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE telegram_id >= $1 AND telegram_id < $2`,
      [BOT_ID_START, BOT_ID_START + BOT_COUNT],
    );
    const leaderboardCount = await client.query(
      `SELECT COUNT(*)::int AS n FROM leaderboard_entries WHERE period_id = $1`,
      [periodId],
    );

    console.log(`✅ Seeded successfully!`);
    console.log(`📊 Bots created: ${count.rows[0].n}`);
    console.log(`🏆 Leaderboard entries: ${leaderboardCount.rows[0].n}`);
    console.log(`\n🎯 Now open Leaderboard to see them.\n`);
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', e.message);
    throw e;
  } finally {
    client.release();
    await db.end();
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
