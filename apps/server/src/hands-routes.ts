import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

export async function registerHandsRoutes(app: FastifyInstance, db: Pool): Promise<void> {
  // ============================================================
  // GET /api/hands/recent
  // ============================================================
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/hands/recent',
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'notoken' });
      const payload = verifyToken(auth.slice(7), JWT_SECRET);
      if (!payload) return reply.code(401).send({ error: 'invalid token' });

      const userId = payload.uid;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;

      try {
        const seats = await db.query(
          `SELECT DISTINCT table_id FROM table_seats WHERE user_id = $1`,
          [userId],
        );
        const tableIds = seats.rows.map((r) => r.table_id);

        if (tableIds.length === 0) {
          return { hands: [] };
        }

        const res = await db.query(
          `SELECT 
            h.id, h.hand_no, h.variant, h.mode, h.pot, h.rake,
            h.winner_seats, h.community_cards, h.started_at, h.ended_at,
            h.small_blind, h.big_blind, h.player_count, h.table_id,
            pt.name AS table_name, pt.blinds AS table_blinds
          FROM hands h
          JOIN poker_tables pt ON pt.id = h.table_id
          WHERE h.table_id = ANY($1::bigint[]) AND h.finished = TRUE
          ORDER BY h.id DESC
          LIMIT $2 OFFSET $3`,
          [tableIds, limit, offset],
        );

        const hands = [];
        for (const row of res.rows) {
          // 🔴 FIX: گرفتن players از hand_events (sequence 0 snapshot)
          const snapshot = await db.query(
            `SELECT state FROM hand_snapshots
             WHERE hand_id = $1 AND sequence = 0`,
            [row.id],
          );

          let players: any[] = [];
          if (snapshot.rows.length > 0) {
            const state = snapshot.rows[0].state;
            players = (state.players || []).map((p: any) => ({
              userId: p.userId,
              displayName: p.displayName,
              avatarId: 'spade',
              seat: p.seat,
              stack: Number(p.stack || 0),
              isWinner: (row.winner_seats || []).includes(p.seat),
            }));
          }

          hands.push({
            id: row.id,
            handNo: row.hand_no,
            variant: row.variant,
            mode: row.mode,
            pot: Number(row.pot || 0),
            rake: Number(row.rake || 0),
            winners: row.winner_seats || [],
            community: row.community_cards || [],
            startedAt: row.started_at,
            endedAt: row.ended_at,
            smallBlind: Number(row.small_blind || 0),
            bigBlind: Number(row.big_blind || 0),
            playerCount: row.player_count,
            tableName: row.table_name,
            players,
          });
        }

        return { hands };
      } catch (e: any) {
        console.error('[hands-routes] recent failed:', e.message);
        return reply.code(500).send({ error: e.message });
      }
    },
  );

  // ============================================================
  // GET /api/hands/:id
  // ============================================================
  app.get<{ Params: { id: string } }>('/api/hands/:id', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'notoken' });
    const payload = verifyToken(auth.slice(7), JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'invalid token' });

    const handId = Number(req.params.id);
    if (!handId) return reply.code(400).send({ error: 'invalid id' });

    try {
      const hand = await db.query(`SELECT * FROM hands WHERE id = $1`, [handId]);
      if (hand.rows.length === 0) return reply.code(404).send({ error: 'hand not found' });

      const row = hand.rows[0];

      // 🔴 FIX: گرفتن players از snapshot
      const snapshot = await db.query(
        `SELECT state FROM hand_snapshots WHERE hand_id = $1 AND sequence = 0`,
        [handId],
      );

      let players: any[] = [];
      let seatToName: Record<number, string> = {};
      if (snapshot.rows.length > 0) {
        const state = snapshot.rows[0].state;
        players = (state.players || []).map((p: any) => ({
          userId: p.userId,
          displayName: p.displayName,
          avatarId: 'spade',
          seat: p.seat,
          stack: Number(p.stack || 0),
          isWinner: (row.winner_seats || []).includes(p.seat),
        }));
        for (const p of players) {
          seatToName[p.seat] = p.displayName;
        }
      }

      // Events
      const events = await db.query(
        `SELECT sequence, event_type, payload, created_at
           FROM hand_events WHERE hand_id = $1
           ORDER BY sequence ASC`,
        [handId],
      );

      // 🔴 FIX: اضافه کردن displayName به هر action
      const enrichedEvents = events.rows.map((e) => {
        const p = e.payload || {};
        return {
          sequence: e.sequence,
          type: e.event_type,
          payload: {
            ...p,
            displayName: p.seat !== undefined ? seatToName[p.seat] : undefined,
          },
          at: e.created_at,
        };
      });

      // Table name
      const tableInfo = await db.query(`SELECT name FROM poker_tables WHERE id = $1`, [
        row.table_id,
      ]);

      return {
        hand: {
          id: row.id,
          handNo: row.hand_no,
          tableId: row.table_id,
          tableName: tableInfo.rows[0]?.name || 'Unknown',
          variant: row.variant,
          mode: row.mode,
          pot: Number(row.pot || 0),
          rake: Number(row.rake || 0),
          winners: row.winner_seats || [],
          community: row.community_cards || [],
          result: row.result,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          dealerSeat: row.dealer_seat,
          smallBlind: Number(row.small_blind || 0),
          bigBlind: Number(row.big_blind || 0),
          playerCount: row.player_count,
          players,
        },
        events: enrichedEvents,
      };
    } catch (e: any) {
      console.error('[hands-routes] detail failed:', e.message);
      return reply.code(500).send({ error: e.message });
    }
  });

  // ============================================================
  // GET /api/hands/:id/replay
  // ============================================================
  app.get<{ Params: { id: string } }>('/api/hands/:id/replay', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'notoken' });
    const payload = verifyToken(auth.slice(7), JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'invalid token' });

    const handId = Number(req.params.id);
    if (!handId) return reply.code(400).send({ error: 'invalid id' });

    try {
      const snapshot = await db.query(
        `SELECT state FROM hand_snapshots WHERE hand_id = $1 AND sequence = 0`,
        [handId],
      );
      const events = await db.query(
        `SELECT sequence, event_type, payload, created_at
           FROM hand_events WHERE hand_id = $1
           ORDER BY sequence ASC`,
        [handId],
      );
      const hand = await db.query(
        `SELECT id, hand_no, variant, community_cards, winner_seats, pot, rake
           FROM hands WHERE id = $1`,
        [handId],
      );

      return {
        hand: hand.rows[0] || null,
        initialSnapshot: snapshot.rows[0]?.state || null,
        events: events.rows.map((e) => ({
          sequence: e.sequence,
          type: e.event_type,
          payload: e.payload,
          at: e.created_at,
        })),
      };
    } catch (e: any) {
      console.error('[hands-routes] replay failed:', e.message);
      return reply.code(500).send({ error: e.message });
    }
  });
}
