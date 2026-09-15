import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { gameManager } from './game-manager.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function isAdmin(req: any): boolean {
  const auth = req.headers.authorization;
  return auth === `Bearer ${ADMIN_SECRET}`;
}

export async function registerTableManagerRoutes(app: FastifyInstance, db: Pool) {
  app.get('/api/tables/live', async () => {
    const res = await db.query(
      `SELECT id, name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats, is_active, created_at
       FROM poker_tables WHERE is_active = TRUE ORDER BY id`,
    );
    const tables = res.rows.map((t: any) => {
      const room = gameManager.getRoom(t.id);
      return {
        ...t,
        live_players: room ? room.players.size : 0,
        live_phase: room?.game?.state?.phase ?? 'waiting',
        live_hand_no: room?.game?.state?.handNo ?? 0,
      };
    });
    return { tables };
  });

  app.get('/api/admin/tables', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const res = await db.query(
      `SELECT id, name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats, is_active, created_at
       FROM poker_tables ORDER BY is_active DESC, id`,
    );
    const tables = res.rows.map((t: any) => {
      const room = gameManager.getRoom(t.id);
      return {
        ...t,
        live_players: room ? room.players.size : 0,
        live_phase: room?.game?.state?.phase ?? null,
        live_hand_no: room?.game?.state?.handNo ?? 0,
      };
    });
    return { tables };
  });

  app.post<{ Body: any }>('/api/admin/tables', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const b = req.body ?? {};
    if (!b.name || !b.variant || !b.mode) return reply.code(400).send({ error: 'missing_fields' });
    if (!['holdem', 'omaha4', 'omaha5'].includes(b.variant))
      return reply.code(400).send({ error: 'invalid_variant' });
    if (!['free', 'real'].includes(b.mode)) return reply.code(400).send({ error: 'invalid_mode' });
    if (b.small_blind <= 0 || b.big_blind <= 0)
      return reply.code(400).send({ error: 'invalid_blinds' });
    if (b.big_blind < b.small_blind) return reply.code(400).send({ error: 'bb_lt_sb' });
    if (b.seats < 2 || b.seats > 10) return reply.code(400).send({ error: 'invalid_seats' });
    const blinds = {
      sb: Number(b.small_blind),
      bb: Number(b.big_blind),
      ante: Number(b.ante ?? 0),
    };
    const inserted = await db.query(
      `INSERT INTO poker_tables (name, variant, mode, speed, blinds, min_buyin, max_buyin, rake_pct, seats, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE) RETURNING *`,
      [
        b.name,
        b.variant,
        b.mode,
        b.speed ?? 'regular',
        JSON.stringify(blinds),
        Number(b.min_buyin ?? 0),
        Number(b.max_buyin ?? 0),
        Number(b.rake_pct ?? 0.03),
        Number(b.seats ?? 6),
      ],
    );
    return { ok: true, table: inserted.rows[0] };
  });

  app.patch<{ Params: { id: string }; Body: any }>('/api/admin/tables/:id', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const { id } = req.params;
    const b = req.body ?? {};
    const existing = await db.query('SELECT * FROM poker_tables WHERE id = $1', [id]);
    if (existing.rows.length === 0) return reply.code(404).send({ error: 'table_not_found' });
    const cur = existing.rows[0];
    const blinds =
      b.small_blind !== undefined || b.big_blind !== undefined || b.ante !== undefined
        ? {
            sb: Number(b.small_blind ?? cur.blinds.sb),
            bb: Number(b.big_blind ?? cur.blinds.bb),
            ante: Number(b.ante ?? cur.blinds.ante ?? 0),
          }
        : cur.blinds;
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const setField = (name: string, val: any) => {
      fields.push(`${name} = $${idx++}`);
      values.push(val);
    };
    if (b.name !== undefined) setField('name', b.name);
    if (b.variant !== undefined) setField('variant', b.variant);
    if (b.mode !== undefined) setField('mode', b.mode);
    if (b.speed !== undefined) setField('speed', b.speed);
    if (b.small_blind !== undefined || b.big_blind !== undefined || b.ante !== undefined)
      setField('blinds', JSON.stringify(blinds));
    if (b.min_buyin !== undefined) setField('min_buyin', Number(b.min_buyin));
    if (b.max_buyin !== undefined) setField('max_buyin', Number(b.max_buyin));
    if (b.rake_pct !== undefined) setField('rake_pct', Number(b.rake_pct));
    if (b.seats !== undefined) setField('seats', Number(b.seats));
    if (b.is_active !== undefined) setField('is_active', Boolean(b.is_active));
    if (fields.length === 0) return { ok: true, table: cur };
    values.push(id);
    const q = `UPDATE poker_tables SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const updated = await db.query(q, values);
    return { ok: true, table: updated.rows[0] };
  });

  app.post<{ Params: { id: string }; Body: { active: boolean } }>(
    '/api/admin/tables/:id/toggle',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const { id } = req.params;
      const { active } = req.body ?? {};
      const updated = await db.query(
        'UPDATE poker_tables SET is_active = $1 WHERE id = $2 RETURNING *',
        [Boolean(active), id],
      );
      if (updated.rows.length === 0) return reply.code(404).send({ error: 'table_not_found' });
      return { ok: true, table: updated.rows[0] };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/admin/tables/:id', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const { id } = req.params;
    const room = gameManager.getRoom(Number(id));
    if (room && room.players.size > 0) return reply.code(400).send({ error: 'table_has_players' });
    await db.query('DELETE FROM poker_tables WHERE id = $1', [id]);
    return { ok: true };
  });

  app.get('/api/admin/tables/stats', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const total = await db.query('SELECT COUNT(*) as c FROM poker_tables');
    const active = await db.query('SELECT COUNT(*) as c FROM poker_tables WHERE is_active = TRUE');
    const rooms = gameManager.getRooms();
    let liveHands = 0;
    let livePlayers = 0;
    for (const room of rooms) {
      liveHands += room.game.state.handNo;
      livePlayers += room.players.size;
    }
    return {
      totalTables: Number(total.rows[0].c),
      activeTables: Number(active.rows[0].c),
      liveRooms: rooms.length,
      liveHands,
      livePlayers,
    };
  });
}
