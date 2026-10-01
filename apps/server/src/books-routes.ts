import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

export async function registerBooksRoutes(app: FastifyInstance, db: Pool) {
  // GET /api/books?period=24h|7d|30d|all
  app.get<{ Querystring: { period?: string } }>('/api/books', async (req) => {
    const period = req.query.period ?? '24h';
    const intervalMap: Record<string, string> = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
      all: '100 years',
    };
    const interval = intervalMap[period] ?? '24 hours';

    const [rake, rewards, deposits, withdrawals, balances, topWinners] = await Promise.all([
      // Rake collected
      db.query(
        `SELECT COALESCE(SUM(e.amount), 0)::numeric AS v
         FROM entries e
         JOIN accounts a ON a.id = e.account_id
         JOIN transactions t ON t.id = e.tx_id
         WHERE a.code = 'HOUSE_RAKE'
           AND t.kind = 'RAKE'
           AND t.created_at > NOW() - $1::interval`,
        [interval],
      ),
      // Rewards paid (from HOUSE_RAKE to users as BONUS/REFERRAL)
      db.query(
        `SELECT COALESCE(SUM(-e.amount), 0)::numeric AS v
         FROM entries e
         JOIN accounts a ON a.id = e.account_id
         JOIN transactions t ON t.id = e.tx_id
         WHERE a.code = 'HOUSE_RAKE'
           AND e.amount < 0
           AND t.kind IN ('BONUS', 'REFERRAL')
           AND t.created_at > NOW() - $1::interval`,
        [interval],
      ),
      // Deposits (confirmed)
      db.query(
        `SELECT COALESCE(SUM(amount_usd), 0)::numeric AS v
         FROM ton_transactions
         WHERE direction='deposit' AND status='confirmed'
           AND confirmed_at > NOW() - $1::interval`,
        [interval],
      ),
      // Withdrawals (confirmed + processing)
      db.query(
        `SELECT COALESCE(SUM(amount_usd), 0)::numeric AS v
         FROM ton_transactions
         WHERE direction='withdraw' AND status IN ('confirmed','processing')
           AND created_at > NOW() - $1::interval`,
        [interval],
      ),
      // Total player balances (all-time)
      db.query(`SELECT COALESCE(SUM(balance_usd), 0)::numeric AS v FROM wallets`),
      // Top winners in period
      db.query(
        `SELECT u.display_name,
                SUM(re.amount)::numeric AS earned
         FROM referral_earnings re
         JOIN users u ON u.id = re.referrer_id
         WHERE re.paid_at > NOW() - $1::interval
         GROUP BY u.display_name
         ORDER BY earned DESC LIMIT 5`,
        [interval],
      ),
    ]);

    const rakeCollected = Number(rake.rows[0].v);
    const rewardsPaid = Number(rewards.rows[0].v);
    const depositsUsd = Number(deposits.rows[0].v);
    const withdrawalsUsd = Number(withdrawals.rows[0].v);
    const playerBalances = Number(balances.rows[0].v);
    const houseNet = rakeCollected - rewardsPaid;

    return {
      period,
      rakeCollected,
      rewardsPaid,
      returnPct: rakeCollected > 0 ? rewardsPaid / rakeCollected : 0,
      deposits: depositsUsd,
      withdrawals: withdrawalsUsd,
      playerBalances,
      houseNet,
      houseNetPct: rakeCollected > 0 ? houseNet / rakeCollected : 0,
      topRewardRecipients: topWinners.rows.map((r: any) => ({
        displayName: r.display_name,
        earned: Number(r.earned),
      })),
      generatedAt: new Date().toISOString(),
    };
  });
}
