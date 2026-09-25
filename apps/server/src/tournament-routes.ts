import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { TournamentManager } from './tournament-manager.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7), JWT_SECRET);
  return payload?.uid ?? null;
}

function authUserOrAdmin(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  if (token === ADMIN_SECRET) return 1;

  const payload = verifyToken(token, JWT_SECRET);
  return payload?.uid ?? null;
}

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}
import type { TournamentScheduler } from './tournament-scheduler.js';
import { SeasonManager } from './season-manager.js';
export async function registerTournamentRoutes(
  app: FastifyInstance,
  db: Pool,
    tm: TournamentManager,
  scheduler: TournamentScheduler,
): Promise<void> {
  const seasons = new SeasonManager(db);
  app.get<{ Querystring: { status?: string; variant?: string; mode?: string } }>(
    '/api/tournaments',
    async (req) => {
      const list = await tm.list({
        status: req.query.status,
        variant: req.query.variant,
        mode: req.query.mode,
      });
      return { tournaments: list };
    },
  );

  app.get<{ Params: { id: string } }>('/api/tournaments/:id', async (req, reply) => {
  const id = Number(req.params.id);
  if (!id) return reply.code(400).send({ error: 'invalid_id' });

  const userId = authUser(req);
  const t = await tm.get(id, userId);
  if (!t) return reply.code(404).send({ error: 'not_found' });
  return t;
});

  app.post<{ Body: Record<string, any> }>('/api/tournaments', async (req, reply) => {
    const userId = authUserOrAdmin(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const body: Record<string, any> = req.body ?? {};

    if (!body.name || !body.variant || !body.blindStructureId) {
      return reply.code(400).send({ error: 'missing_fields' });
    }

    try {
      const id = await tm.create({
        name: body.name,
        variant: body.variant,
        mode: body.mode || 'real',
        format: body.format || 'mtt',
        speed: body.speed || 'regular',
        buyIn: Number(body.buyIn || 0),
        fee: Number(body.fee || 0),
        startingStack: Number(body.startingStack || 10000),
        minPlayers: Number(body.minPlayers || 2),
        maxPlayers: Number(body.maxPlayers || 100),
        guaranteed: Number(body.guaranteed || 0),
        scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
        lateRegMin: Number(body.lateRegMin || 0),
        lateRegLevel: Number(body.lateRegLevel || 0),
        allowReEntry: !!body.allowReEntry,
        maxReEntries: Number(body.maxReEntries || 1),
        isBounty: !!body.isBounty,
        bountyAmount: Number(body.bountyAmount || 0),
        satelliteTargetId: body.satelliteTargetId ? Number(body.satelliteTargetId) : null,
        seatsAwarded: Number(body.seatsAwarded || 0),
        blindStructureId: Number(body.blindStructureId),
        isPrivate: !!body.isPrivate,
        createdBy: userId,
      });
      return { ok: true, tournamentId: id };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  app.post<{ Params: { id: string } }>('/api/tournaments/:id/register', async (req, reply) => {
    const userId = authUserOrAdmin(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const result = await tm.register(id, userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/tournaments/:id/unregister', async (req, reply) => {
    const userId = authUserOrAdmin(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const result = await tm.unregister(id, userId);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/tournaments/:id/start', async (req, reply) => {
    const userId = authUserOrAdmin(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const id = Number(req.params.id);
    if (!id) return reply.code(400).send({ error: 'invalid_id' });

    const result = await tm.start(id);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: { userId: number; eliminatedBy?: number } }>(
    '/api/tournaments/:id/bust',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      const { userId, eliminatedBy } = req.body ?? {};
      if (!userId) return reply.code(400).send({ error: 'missing_userId' });

      const result = await tm.handlePlayerBust(id, userId, eliminatedBy);
      if (!result.ok) return reply.code(400).send({ error: 'not_eliminated' });
      return { ok: true, finalPosition: result.finalPosition, finished: result.finished };
    },
  );

  app.post<{ Params: { id: string }; Body: { stacks: Record<string, number> } }>(
    '/api/tournaments/:id/sync-stacks',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      const stacks = req.body?.stacks ?? {};
      const map = new Map<number, number>();
      for (const [uid, s] of Object.entries(stacks)) {
        map.set(Number(uid), Number(s));
      }
      await tm.checkBustedPlayers(id, map);
      return { ok: true };
    },
  );

  // ============================================================
  // D5.4: SATELLITE TICKETS
  // ============================================================
  app.get('/api/tournaments/satellite/tickets', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const tickets = await tm.getUserTickets(userId);
    return { tickets };
  });

  app.get('/api/blind-structures', async () => {
    const res = await db.query(
      'SELECT id, name, description, starting_stack, is_turbo, is_hyper FROM blind_structures ORDER BY id',
    );
    return {
      structures: res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        startingStack: Number(r.starting_stack),
        isTurbo: r.is_turbo,
        isHyper: r.is_hyper,
      })),
    };
  });
  // ============================================================
  // D6.2: SEASONS + TOURNAMENT LEADERBOARD
  // ============================================================
  app.get('/api/leaderboard/season', async () => {
    const season = await seasons.ensureActiveSeason();
    const entries = await seasons.leaderboard(season.id, 100);
    return {
      season: {
        id: season.id,
        name: season.name,
        startAt: season.start_at,
        endAt: season.end_at,
        status: season.status,
        prizePool: Number(season.prize_pool),
      },
      entries,
    };
  });

  app.get('/api/leaderboard/season/me', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });
    const season = await seasons.ensureActiveSeason();
    const me = await seasons.myRank(season.id, userId);
    return { season: { id: season.id, name: season.name, endAt: season.end_at }, me };
  });

  app.get('/api/leaderboard/seasons', async () => {
    const list = await seasons.list();
    return { seasons: list };
  });
  // ============================================================
  // D6.3: MY TOURNAMENT HISTORY
  // ============================================================
  app.get<{ Querystring: { filter?: string; limit?: string } }>(
    '/api/my/tournaments',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });

      const filter = req.query.filter || 'all';
      const limit = Math.min(Number(req.query.limit) || 50, 200);

      let statusFilter = '';
      if (filter === 'won') statusFilter = `AND te.final_position = 1`;
      else if (filter === 'itm')
        statusFilter = `AND (te.status IN ('cashed','won','qualified') OR te.payout_amount > 0)`;
      else if (filter === 'eliminated')
        statusFilter = `AND te.status = 'eliminated' AND te.payout_amount = 0`;

      try {
        const res = await db.query(
          `SELECT
             te.tournament_id, te.status AS entry_status, te.final_position,
             te.payout_amount, te.points_earned, te.re_entry_count, te.registered_at,
             t.name, t.variant, t.format, t.mode, t.speed, t.buy_in, t.fee,
             t.starting_stack, t.total_prize_pool, t.total_players,
             t.started_at, t.finished_at, t.status AS tourney_status,
             t.winner_user_id
           FROM tournament_entries te
           JOIN tournaments t ON t.id = te.tournament_id
           WHERE te.user_id = $1
             AND t.status = 'finished'
             ${statusFilter}
           ORDER BY t.finished_at DESC NULLS LAST, t.id DESC
           LIMIT $2`,
          [userId, limit],
        );

        // Aggregate stats
        const statsRes = await db.query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE te.final_position = 1)::int AS wins,
             COUNT(*) FILTER (WHERE te.status IN ('cashed','won','qualified') OR te.payout_amount > 0)::int AS itm,
             COALESCE(SUM(te.payout_amount), 0) AS total_won,
             COALESCE(SUM(t.buy_in + t.fee), 0) AS total_invested,
             COALESCE(SUM(te.points_earned), 0)::int AS total_points,
             MAX(te.final_position)::int AS best_position
           FROM tournament_entries te
           JOIN tournaments t ON t.id = te.tournament_id
           WHERE te.user_id = $1 AND t.status = 'finished'`,
          [userId],
        );

        const s = statsRes.rows[0];
        const total = Number(s.total);
        const totalWon = Number(s.total_won);
        const totalInvested = Number(s.total_invested);
        const roi = totalInvested > 0 ? ((totalWon - totalInvested) / totalInvested) * 100 : 0;
        const itmPct = total > 0 ? (Number(s.itm) / total) * 100 : 0;

        return {
          tournaments: res.rows.map((r) => ({
            id: r.tournament_id,
            name: r.name,
            variant: r.variant,
            format: r.format,
            mode: r.mode,
            speed: r.speed,
            buyIn: Number(r.buy_in),
            fee: Number(r.fee),
            entryStatus: r.entry_status,
            finalPosition: r.final_position,
            payout: Number(r.payout_amount),
            points: Number(r.points_earned),
            reEntries: r.re_entry_count,
            totalPlayers: r.total_players,
            prizePool: Number(r.total_prize_pool),
            startedAt: r.started_at,
            finishedAt: r.finished_at,
            isWinner: r.winner_user_id === userId,
          })),
          stats: {
            total,
            wins: Number(s.wins),
            itm: Number(s.itm),
            itmPct: Math.round(itmPct * 10) / 10,
            totalWon,
            totalInvested,
            netProfit: totalWon - totalInvested,
            roi: Math.round(roi * 10) / 10,
            totalPoints: Number(s.total_points),
            bestPosition: s.best_position,
          },
        };
      } catch (e: any) {
        console.error('[my-tournaments] failed:', e.message);
        return reply.code(500).send({ error: e.message });
      }
    },
  );

  // ============================================================
  // ADMIN ENDPOINTS
  // ============================================================
  // ============================================================
  // D6.1: TOURNAMENT TEMPLATES (Recurring)
  // ============================================================
  app.get('/api/admin/tournament-templates', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const templates = await scheduler.list();
    return {
      templates: templates.map((t: any) => ({
        id: t.id,
        name: t.name,
        variant: t.variant,
        mode: t.mode,
        format: t.format,
        speed: t.speed,
        buyIn: Number(t.buy_in),
        fee: Number(t.fee),
        startingStack: Number(t.starting_stack),
        minPlayers: t.min_players,
        maxPlayers: t.max_players,
        guaranteed: Number(t.guaranteed),
        lateRegLevel: t.late_reg_level,
        allowReEntry: t.allow_re_entry,
        maxReEntries: t.max_re_entries,
        isBounty: t.is_bounty,
        bountyAmount: Number(t.bounty_amount),
        satelliteTargetId: t.satellite_target_id,
        seatsAwarded: t.seats_awarded,
        blindStructureId: t.blind_structure_id,
        scheduleType: t.schedule_type,
        scheduleTime: t.schedule_time,
        scheduleDay: t.schedule_day,
        isActive: t.is_active,
        nextRunAt: t.next_run_at,
        lastRunAt: t.last_run_at,
        createdAt: t.created_at,
      })),
    };
  });

  app.post<{ Body: Record<string, any> }>(
    '/api/admin/tournament-templates',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const b: Record<string, any> = req.body ?? {};
      if (!b.name || !b.blindStructureId || !b.scheduleType) {
        return reply.code(400).send({ error: 'missing_fields' });
      }
      const result = await scheduler.create({
        name: b.name,
        variant: b.variant || 'holdem',
        mode: b.mode || 'free',
        format: b.format || 'sng',
        speed: b.speed || 'regular',
        buy_in: Number(b.buyIn || 0),
        fee: Number(b.fee || 0),
        starting_stack: Number(b.startingStack || 5000),
        min_players: Number(b.minPlayers || 2),
        max_players: Number(b.maxPlayers || 100),
        guaranteed: Number(b.guaranteed || 0),
        late_reg_min: Number(b.lateRegMin || 0),
        late_reg_level: Number(b.lateRegLevel || 0),
        allow_re_entry: !!b.allowReEntry,
        max_re_entries: Number(b.maxReEntries || 1),
        is_bounty: !!b.isBounty,
        bounty_amount: Number(b.bountyAmount || 0),
        satellite_target_id: b.satelliteTargetId ? Number(b.satelliteTargetId) : null,
        seats_awarded: Number(b.seatsAwarded || 0),
        blind_structure_id: Number(b.blindStructureId),
        schedule_type: b.scheduleType,
        schedule_time: b.scheduleTime || '14:00',
        schedule_day: Number(b.scheduleDay || 0),
        created_by: 1,
      });
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return { ok: true, templateId: result.templateId };
    },
  );

  app.post<{ Params: { id: string }; Body: { active: boolean } }>(
    '/api/admin/tournament-templates/:id/toggle',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      const active = !!req.body?.active;
      const result = await scheduler.toggle(id, active);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return { ok: true, isActive: active };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/tournament-templates/:id',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      const result = await scheduler.remove(id);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return { ok: true };
    },
  );

  // Pause
  app.post<{ Params: { id: string } }>(
    '/api/admin/tournaments/:id/pause',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });
      const result = await tm.pause(id);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return { ok: true, status: 'paused' };
    },
  );

  // Resume
  app.post<{ Params: { id: string } }>(
    '/api/admin/tournaments/:id/resume',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });
      const result = await tm.resume(id);
      if (!result.ok) return reply.code(400).send({ error: result.error });
      return { ok: true, status: 'running' };
    },
  );

  // Cancel + refund
  app.post<{ Params: { id: string } }>(
    '/api/admin/tournaments/:id/cancel',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });

      const id = Number(req.params.id);
      if (!id) return reply.code(400).send({ error: 'invalid_id' });

      const client = await db.connect();
      try {
        await client.query('BEGIN');

        const tRes = await client.query(
          'SELECT id, status, buy_in, fee FROM tournaments WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (tRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'not_found' });
        }
        const t = tRes.rows[0];
        if (t.status === 'cancelled' || t.status === 'finished') {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: 'already_done', status: t.status });
        }

        const entries = await client.query(
          `SELECT user_id FROM tournament_entries 
           WHERE tournament_id = $1 AND status = 'registered'`,
          [id],
        );

        const refundTotal = Number(t.buy_in) + Number(t.fee);
        let refunded = 0;
        if (refundTotal > 0 && entries.rows.length > 0) {
          const entryAcc = await client.query(
            `SELECT id FROM accounts WHERE code = 'SYSTEM_TOURNAMENT_ENTRY'`,
          );
          if (entryAcc.rows.length > 0) {
            const entryAccId = entryAcc.rows[0].id;
            for (const e of entries.rows) {
              const userAcc = await client.query(`SELECT id FROM accounts WHERE code = $1`, [
                `USER_${e.user_id}`,
              ]);
              if (userAcc.rows.length === 0) continue;
              const userAccId = userAcc.rows[0].id;

              const txRes = await client.query(
                `INSERT INTO transactions (kind, ref, meta, status, user_id, amount, completed_at)
                 VALUES ('TOURNAMENT_REFUND', $1, $2, 'completed', $3, $4, NOW())
                 RETURNING id`,
                [
                  `tourney_cancel_${id}_user_${e.user_id}`,
                  JSON.stringify({ tournamentId: id, reason: 'cancelled' }),
                  e.user_id,
                  refundTotal,
                ],
              );
              const txId = txRes.rows[0].id;

              await client.query(
                `INSERT INTO entries (tx_id, account_id, amount, currency)
                 VALUES ($1, $2, $3, 'USD'), ($1, $4, $5, 'USD')`,
                [txId, entryAccId, -refundTotal, userAccId, refundTotal],
              );

              await client.query(
                `UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = NOW() WHERE user_id = $2`,
                [refundTotal, e.user_id],
              );

              refunded++;
            }
          }
        }

        await client.query(
          `UPDATE tournament_entries SET status = 'refunded' WHERE tournament_id = $1`,
          [id],
        );

        await client.query(
          `UPDATE tournaments SET status = 'cancelled', finished_at = NOW() WHERE id = $1`,
          [id],
        );

        await client.query('COMMIT');

        console.log(`[tournament] ❌ cancelled #${id}, refunded ${refunded} players`);

        return { ok: true, refunded, refundTotal: refundTotal * refunded };
      } catch (e: any) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        return reply.code(500).send({ error: e.message });
      } finally {
        client.release();
      }
    },
  );

  // List all (including cancelled/finished)
  app.get('/api/admin/tournaments', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });

    const res = await db.query(
      `SELECT t.*,
         (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = t.id AND status = 'registered') AS registered_count,
         (SELECT COUNT(*) FROM tournament_players WHERE tournament_id = t.id AND status = 'active') AS active_count
       FROM tournaments t
       ORDER BY 
         CASE status WHEN 'running' THEN 0 WHEN 'final_table' THEN 1 WHEN 'paused' THEN 2 WHEN 'registering' THEN 3 ELSE 4 END,
         id DESC
       LIMIT 100`,
    );

    return {
      tournaments: res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        variant: r.variant,
        mode: r.mode,
        format: r.format,
        buyIn: Number(r.buy_in),
        fee: Number(r.fee),
        startingStack: Number(r.starting_stack),
        minPlayers: r.min_players,
        maxPlayers: r.max_players,
        registeredCount: Number(r.registered_count || 0),
        activeCount: Number(r.active_count || 0),
        status: r.status,
        currentLevel: r.current_level,
        lateRegLevel: r.late_reg_level ?? 0,
        allowReEntry: r.allow_re_entry ?? false,
        maxReEntries: r.max_re_entries ?? 1,
        isBounty: r.is_bounty ?? false,
        bountyAmount: Number(r.bounty_amount ?? 0),
        satelliteTargetId: r.satellite_target_id ? Number(r.satellite_target_id) : null,
        seatsAwarded: Number(r.seats_awarded ?? 0),
        totalPrizePool: Number(r.total_prize_pool),
        totalPlayers: r.total_players,
        createdAt: r.created_at,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
      })),
    };
  });

  // Global stats
  app.get('/api/admin/stats', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });

    const [totals, byStatus, players, rake] = await Promise.all([
      db.query(`SELECT COUNT(*) as c FROM tournaments`),
      db.query(`SELECT status, COUNT(*) as c FROM tournaments GROUP BY status`),
      db.query(
        `SELECT COUNT(DISTINCT user_id) as c FROM tournament_entries WHERE status IN ('playing','cashed','won','eliminated','qualified')`,
      ),
      db.query(`SELECT COALESCE(SUM(total_rake), 0) as c FROM tournaments`),
    ]);

    const statusMap: Record<string, number> = {};
    for (const r of byStatus.rows) {
      statusMap[r.status] = Number(r.c);
    }

    return {
      totalTournaments: Number(totals.rows[0].c),
      byStatus: statusMap,
      totalUniquePlayers: Number(players.rows[0].c),
      totalRake: Number(rake.rows[0].c),
    };
  });
}