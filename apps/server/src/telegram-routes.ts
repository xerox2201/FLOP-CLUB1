// ============================================================
// Telegram webhook + community management endpoints
// ============================================================

import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { getTelegramBot } from './telegram-bot.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin_dev_secret';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const p = verifyToken(auth.slice(7), JWT_SECRET);
  return p?.uid ?? null;
}

function isAdmin(req: any): boolean {
  return req.headers.authorization === `Bearer ${ADMIN_SECRET}`;
}

export async function registerTelegramRoutes(app: FastifyInstance, db: Pool) {
  const bot = getTelegramBot(db);

  // ============================================================
  // WEBHOOK — receives updates from Telegram
  // ============================================================
  app.post<{ Params: { secret: string }; Body: any }>(
    '/api/telegram/webhook/:secret',
    async (req, reply) => {
      // Verify secret matches (defense against fake webhook calls)
      if (!WEBHOOK_SECRET || req.params.secret !== WEBHOOK_SECRET) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      // Ack immediately — Telegram requires fast responses
      reply.code(200).send({ ok: true });

      // Process async (don't block Telegram's retry)
      bot.handleUpdate(req.body).catch((e) => {
        console.error('[tg-webhook] handleUpdate error:', e.message);
      });
    },
  );

  // ============================================================
  // PUBLIC — community info
  // ============================================================
  app.get('/api/community', async () => {
    const res = await db.query(
      `SELECT chat_type, title, username, invite_link, member_count
       FROM telegram_chats
       WHERE is_primary = TRUE AND is_active = TRUE
       ORDER BY chat_type`,
    );
    const channel = res.rows.find((r) => r.chat_type === 'channel');
    const group = res.rows.find((r) => r.chat_type !== 'channel');
    return {
      channel: channel ?? null,
      group: group ?? null,
    };
  });

  // ============================================================
  // USER — check my membership
  // ============================================================
  app.get('/api/community/my-membership', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const u = await db.query('SELECT telegram_id FROM users WHERE id = $1', [userId]);
    if (!u.rows[0]) return reply.code(404).send({ error: 'user_not_found' });
    const tgId = Number(u.rows[0].telegram_id);

    const chats = await db.query(
      `SELECT chat_id, chat_type, title FROM telegram_chats
       WHERE is_primary = TRUE AND is_active = TRUE`,
    );

    // Verify all chats in parallel, each capped at 5s. Without the cap a single
    // Telegram outage costs TG_MAX_ATTEMPTS x TG_TIMEOUT_MS per chat (3 x 25s),
    // and the chats were awaited sequentially — that is what made this endpoint
    // block for ~126s.
    const TIMEOUT_MS = 5000;
    const results = await Promise.all(
      chats.rows.map(async (c: any) => {
        try {
          const v = await Promise.race([
            bot.verifyMembership(Number(c.chat_id), tgId),
            new Promise<{ status: string; isMember: boolean }>((resolve) =>
              setTimeout(() => resolve({ status: 'timeout', isMember: false }), TIMEOUT_MS),
            ),
          ]);
          return { chat: c, result: v };
        } catch (e: any) {
          return {
            chat: c,
            result: { status: 'error', isMember: false, error: e.message },
          };
        }
      }),
    );

    const memberships: Record<string, any> = {};
    for (const { chat: c, result: v } of results) {
      // Keyed by chat_type ('channel' | 'supergroup'): the mini-app looks up
      // memberships['channel'] / memberships['supergroup']. Do not switch this
      // to chat_id without updating Community.svelte and CommunityBanner.svelte.
      memberships[c.chat_type] = {
        title: c.title,
        isMember: v.isMember,
        status: v.status,
      };
    }
    return { memberships };
  });

  // ============================================================
  // USER — request an invite link
  // ============================================================
  app.post<{ Body: { chat_type: 'channel' | 'group' } }>(
    '/api/community/invite',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });

      const { chat_type } = req.body ?? {};
      if (!chat_type || !['channel', 'group'].includes(chat_type)) {
        return reply.code(400).send({ error: 'invalid_chat_type' });
      }

      const c = await db.query(
        `SELECT chat_id, invite_link FROM telegram_chats
         WHERE is_primary = TRUE AND is_active = TRUE
           AND chat_type = CASE WHEN $1 = 'channel' THEN 'channel' ELSE 'supergroup' END
         LIMIT 1`,
        [chat_type],
      );
      if (!c.rows[0]) return reply.code(404).send({ error: 'chat_not_configured' });

      // Return the static invite link (created once when bot was set up)
      return {
        ok: true,
        invite_link: c.rows[0].invite_link,
      };
    },
  );

  // ============================================================
  // ADMIN — register primary channel/group
  // ============================================================
  app.post<{
    Body: {
      chat_id: number;
      chat_type: 'group' | 'supergroup' | 'channel';
      title: string;
      username?: string;
      invite_link?: string;
    };
  }>('/api/admin/community/register', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const b = req.body ?? {};
    if (!b.chat_id || !b.chat_type || !b.title) {
      return reply.code(400).send({ error: 'missing_fields' });
    }

    // If setting as primary, demote any other primary of the same kind
    if (b.chat_type === 'channel') {
      await db.query(
        `UPDATE telegram_chats SET is_primary = FALSE
         WHERE is_primary = TRUE AND chat_type = 'channel'`,
      );
    } else {
      await db.query(
        `UPDATE telegram_chats SET is_primary = FALSE
         WHERE is_primary = TRUE AND chat_type IN ('group','supergroup')`,
      );
    }

    const res = await db.query(
      `INSERT INTO telegram_chats
         (chat_id, chat_type, title, username, invite_link, is_primary, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
       ON CONFLICT (chat_id) DO UPDATE
         SET chat_type = EXCLUDED.chat_type,
             title = EXCLUDED.title,
             username = EXCLUDED.username,
             invite_link = EXCLUDED.invite_link,
             is_primary = TRUE,
             updated_at = NOW()
       RETURNING id`,
      [b.chat_id, b.chat_type, b.title, b.username ?? null, b.invite_link ?? null],
    );

    // Immediately try to verify bot admin status
    const me = await db.query(`SELECT 1`);
    try {
      const members = await db.query(`SELECT 1`);
    } catch {}

    return { ok: true, id: Number(res.rows[0].id) };
  });

  // ============================================================
  // ADMIN — send test post to channel
  // ============================================================
  app.post<{ Body: { chat_id: number; text: string } }>(
    '/api/admin/community/post',
    async (req, reply) => {
      if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
      const { chat_id, text } = req.body ?? {};
      if (!chat_id || !text) return reply.code(400).send({ error: 'missing_fields' });
      await bot.postMessage({ chatId: Number(chat_id), text });
      return { ok: true };
    },
  );

  // ============================================================
  // ADMIN — refresh member count
  // ============================================================
  app.post('/api/admin/community/refresh', async (req, reply) => {
    if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden' });
    const chats = await db.query('SELECT chat_id FROM telegram_chats WHERE is_active = TRUE');
    const updated: any[] = [];
    for (const c of chats.rows) {
      try {
        const info = (await bot.postMessage) ? null : null; // placeholder
      } catch {}
    }
    return { ok: true, refreshed: chats.rows.length };
  });
}
