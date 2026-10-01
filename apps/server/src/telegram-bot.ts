// ============================================================
// Telegram Bot integration for Flop Club community
// ------------------------------------------------------------
// Responsibilities:
//   1. Register webhook (one webhook per bot, per Telegram rules)
//   2. Handle /start ref_XXX deep links → attribute referral
//   3. Handle chat_member updates → sync membership cache
//   4. Verify membership via getChatMember before granting perks
//   5. Post to channel/group on game events (big wins, tourneys)
// ============================================================

import type { Pool } from 'pg';
import crypto from 'crypto';
import dns from 'node:dns';

// Force IPv4-first DNS resolution.
// undici (Node.js fetch) prefers IPv6 by default, which breaks through
// many ISP networks where IPv6 is advertised but not actually routable.
// Symptom: "fetch failed" with no useful error message.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // older Node.js — ignore
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? 'FlopClubOfficialBot';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';

// Telegram API base — supports reverse proxy for restricted regions (e.g. Iran).
// Set TELEGRAM_API_BASE to a Cloudflare Worker URL to bypass ISP filtering.
// Telegram API base — supports reverse proxy for restricted regions (e.g. Iran).
const TELEGRAM_API_BASE = (process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(
  /\/$/,
  '',
);
const API_BASE = `${TELEGRAM_API_BASE}/bot${BOT_TOKEN}`;

// ---------- Low-level API wrapper ----------
// Note: Cloudflare Worker reverse proxy from Iran can be flaky.
// Higher timeout + more retries + `Connection: close` header forces
// a fresh TCP connection (undici connection reuse causes "fetch failed").
const TG_TIMEOUT_MS = 25_000;
const TG_MAX_ATTEMPTS = 3;
const TG_RETRY_DELAY_MS = 2000;

// ---------- Mini App button helper ----------
// Telegram requires HTTPS for `web_app` inline buttons.
// In dev (http://localhost), we skip the button entirely — sending it
// would cause the whole message to be rejected by Telegram with
// "Only HTTPS links are allowed".
function buildOpenAppButton(): Array<Array<any>> | undefined {
  const appUrl = process.env.APP_URL ?? '';
  if (!appUrl) return undefined;

  if (appUrl.startsWith('https://')) {
    return [[{ text: '▶️ Open Flop Club', web_app: { url: appUrl } }]];
  }

  // Dev: HTTP not allowed for web_app — skip button
  return undefined;
}

async function tg(method: string, body: Record<string, any> = {}): Promise<any> {
  let lastErr: any = null;

  for (let attempt = 1; attempt <= TG_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Force fresh TCP connection — avoids undici pool staleness
          // that causes "fetch failed" through slow proxies.
          Connection: 'close',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TG_TIMEOUT_MS),
      });
      const json: any = await res.json();
      if (!json.ok) {
        throw new Error(`tg_${method}_failed: ${json.description ?? res.status}`);
      }
      return json.result;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? '');
      // undici hides the actual network error inside .cause
      const cause = e?.cause;
      const causeMsg = cause ? String(cause.message ?? cause.code ?? cause) : '';
      const fullMsg = causeMsg ? `${msg} (${causeMsg})` : msg;

      const retryable =
        e?.name === 'TimeoutError' ||
        e?.name === 'AbortError' ||
        msg.includes('timeout') ||
        msg.includes('aborted') ||
        msg.includes('fetch failed') ||
        causeMsg.includes('ECONNRESET') ||
        causeMsg.includes('ECONNREFUSED') ||
        causeMsg.includes('ENOTFOUND') ||
        causeMsg.includes('ENETUNREACH') ||
        causeMsg.includes('ETIMEDOUT');

      if (!retryable || attempt >= TG_MAX_ATTEMPTS) {
        throw new Error(`tg_${method}_failed after ${attempt} attempts: ${fullMsg}`);
      }

      const delay = 1500 * attempt;
      console.warn(
        `[tg-bot] ${method} attempt ${attempt}/${TG_MAX_ATTEMPTS} failed (${fullMsg}) — retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr ?? new Error(`tg_${method}_failed: unknown`);
}

// ---------- Core methods ----------
export class TelegramBotService {
  constructor(private db: Pool) {}

  /**
   * Register webhook with Telegram. Must be called once on server start.
   * Telegram rule: ONE webhook per bot. If already set, this is idempotent.
   */
  /**
   * Delete any existing webhook. Required before starting long polling,
   * since Telegram rejects getUpdates when a webhook is set.
   */
  async deleteWebhook(): Promise<void> {
    if (!BOT_TOKEN) {
      console.warn('[tg-bot] no TELEGRAM_BOT_TOKEN — bot disabled');
      return;
    }
    try {
      const result = await tg('deleteWebhook', { drop_pending_updates: false });
      // result is true when a webhook existed, false when already clean
      console.log(
        result
          ? '[tg-bot] ✅ webhook cleared (switched to long polling)'
          : '[tg-bot] ℹ️  no webhook to clear (already using polling)',
      );
    } catch (e: any) {
      // "webhook not set" is fine — ignore
      if (!e.message?.includes('not set')) {
        console.warn('[tg-bot] deleteWebhook failed:', e.message);
      }
    }
  }

  /**
   * (Legacy) Webhook registration — kept for reference.
   * Not used because public HTTPS tunnels (ngrok, cloudflared)
   * are blocked in restricted regions. We use long polling instead.
   */
  async registerWebhook(publicUrl: string): Promise<void> {
    if (!BOT_TOKEN) {
      console.warn('[tg-bot] no TELEGRAM_BOT_TOKEN — bot disabled');
      return;
    }
    const url = `${publicUrl}/api/telegram/webhook/${WEBHOOK_SECRET}`;
    await tg('setWebhook', {
      url,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: [
        'message',
        'callback_query',
        'chat_member',
        'my_chat_member',
        'channel_post',
      ],
      drop_pending_updates: false,
    });
    console.log(`[tg-bot] ✅ webhook registered: ${url}`);
  }

  /**
   * Verify a user is a member of a chat.
   * Per Telegram docs: only reliable if bot is admin in the chat.
   */
  async verifyMembership(
    chatId: number,
    userId: number,
  ): Promise<{ status: string; isMember: boolean }> {
    try {
      const member = await tg('getChatMember', {
        chat_id: chatId,
        user_id: userId,
      });
      const status = String(member?.status ?? 'left');
      const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(status);

      // Update cache
      await this.db.query(
        `INSERT INTO telegram_memberships
           (chat_id, user_id, status, is_premium, last_verified_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (chat_id, user_id) DO UPDATE
           SET status = EXCLUDED.status,
               is_premium = EXCLUDED.is_premium,
               last_verified_at = NOW()`,
        [chatId, userId, status, !!member?.user?.is_premium],
      );

      return { status, isMember };
    } catch (e: any) {
      console.error('[tg-bot] verifyMembership failed:', e.message);
      return { status: 'unknown', isMember: false };
    }
  }

  /**
   * Create a trackable invite link. Bot must be admin with can_invite_users.
   */
  async createInviteLink(params: {
    chatId: number;
    name?: string;
    memberLimit?: number;
    expireUnix?: number;
    creatorUserId?: number;
    createsJoinRequest?: boolean;
  }): Promise<{ link: string; id: number }> {
    const result = await tg('createChatInviteLink', {
      chat_id: params.chatId,
      name: params.name,
      member_limit: params.memberLimit,
      expire_date: params.expireUnix,
      creates_join_request: params.createsJoinRequest,
    });

    const ins = await this.db.query(
      `INSERT INTO telegram_invite_links
         (chat_id, invite_link, creator_user_id, name, member_limit,
          expire_date, creates_join_request)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        params.chatId,
        result.invite_link,
        params.creatorUserId ?? null,
        params.name ?? null,
        params.memberLimit ?? null,
        params.expireUnix ? new Date(params.expireUnix * 1000) : null,
        !!params.createsJoinRequest,
      ],
    );

    return { link: result.invite_link, id: Number(ins.rows[0].id) };
  }

  /**
   * Post to channel or group.
   */
  async postMessage(params: {
    chatId: number;
    text: string;
    parseMode?: 'HTML' | 'MarkdownV2';
    disablePreview?: boolean;
    buttons?: Array<Array<{ text: string; url: string }>>;
  }): Promise<void> {
    const payload: any = {
      chat_id: params.chatId,
      text: params.text,
      parse_mode: params.parseMode ?? 'HTML',
      disable_web_page_preview: params.disablePreview ?? true,
    };
    if (params.buttons) {
      payload.reply_markup = { inline_keyboard: params.buttons };
    }

    try {
      await tg('sendMessage', payload);
      await this.db.query(
        `INSERT INTO telegram_bot_actions (chat_id, action, payload, ok)
         VALUES ($1, 'post', $2, TRUE)`,
        [params.chatId, JSON.stringify({ length: params.text.length })],
      );
    } catch (e: any) {
      await this.db.query(
        `INSERT INTO telegram_bot_actions (chat_id, action, payload, ok, error)
         VALUES ($1, 'post', $2, FALSE, $3)`,
        [params.chatId, JSON.stringify({ length: params.text.length }), e.message],
      );
      throw e;
    }
  }

  /**
   * Send a DM to a user.
   */
  async sendDM(userId: number, text: string, buttons?: any[]): Promise<void> {
    const payload: any = {
      chat_id: userId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (buttons) payload.reply_markup = { inline_keyboard: buttons };
    try {
      await tg('sendMessage', payload);
    } catch (e: any) {
      console.warn(`[tg-bot] DM to ${userId} failed: ${e.message}`);
    }
  }

  /**
   * Raw getUpdates — used by the long-polling loop.
   * Uses the same proxy base as everything else.
   */
  async getUpdatesRaw(
    params: {
      offset?: number;
      timeout?: number;
      limit?: number;
    } = {},
  ): Promise<any[]> {
    const body: Record<string, any> = {
      timeout: params.timeout ?? 25,
      limit: params.limit ?? 100,
      allowed_updates: [
        'message',
        'callback_query',
        'chat_member',
        'my_chat_member',
        'channel_post',
      ],
    };
    if (params.offset !== undefined && params.offset !== null) {
      body.offset = params.offset;
    }

    const res = await fetch(`${API_BASE}/getUpdates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Connection: 'close',
      },
      body: JSON.stringify(body),
      // Telegram holds the request for up to `timeout` seconds
      signal: AbortSignal.timeout((params.timeout ?? 25) * 1000 + 5000),
    });
    const json: any = await res.json();
    if (!json.ok) {
      throw new Error(`getUpdates_failed: ${json.description ?? res.status}`);
    }
    return json.result ?? [];
  }

  /**
   * Generate a per-user referral deep link.
   * Format: https://t.me/FlopClubBot?start=ref_XXXXXXXX
   */
  buildReferralLink(referralCode: string): string {
    return `https://t.me/${BOT_USERNAME}?start=${referralCode}`;
  }

  /**
   * Build a deep link for a group affiliate's short code.
   * `shortCode` is a raw hex string; we prepend 'grp_'.
   */
  buildGroupLink(shortCode: string): string {
    return `https://t.me/${BOT_USERNAME}?start=grp_${shortCode}`;
  }

  // ---------- Update handlers ----------
  async handleUpdate(update: any): Promise<void> {
    // /start ref_XXX or /start grp_XXX
    if (update.message?.text?.startsWith('/start')) {
      await this.handleStartCommand(update.message);
      return;
    }

    // Membership change
    if (update.chat_member || update.my_chat_member) {
      await this.handleChatMemberUpdate(update.chat_member ?? update.my_chat_member);
      return;
    }
  }

  private async handleStartCommand(msg: any): Promise<void> {
    const text: string = msg.text ?? '';
    // Split on any whitespace (users sometimes send multiple spaces)
    const parts = text.trim().split(/\s+/);
    const payload = parts[1] ?? '';
    const fromUserId = msg.from?.id;
    if (!fromUserId) return;

    // Look up internal user by telegram_id
    const uRes = await this.db.query('SELECT id, display_name FROM users WHERE telegram_id = $1', [
      fromUserId,
    ]);
    const user = uRes.rows[0];

    if (!payload) {
      // Plain /start
      await this.sendDM(
        fromUserId,
        `👋 Welcome to <b>Flop Club</b>!\n\n` +
          `Play poker, earn instant rakeback, compete in daily tournaments.\n\n` +
          `📢 <a href="https://t.me/flopclub_news">Channel</a> · ` +
          `💬 <a href="https://t.me/flopclub_chat">Chat</a>`,
        buildOpenAppButton(),
      );
      return;
    }

    if (payload.startsWith('ref_') || payload.startsWith('grp_')) {
      // Store the FULL payload (with prefix). attributeReferral expects
      // 'ref_XXXXXXXX' or 'grp_XXXXXXXX' and strips the prefix internally.
      await this.db.query(
        `INSERT INTO pending_referrals (telegram_user_id, code)
         VALUES ($1, $2)
         ON CONFLICT (telegram_user_id) DO UPDATE
           SET code = EXCLUDED.code, created_at = NOW(),
               expires_at = NOW() + INTERVAL '10 minutes'`,
        [fromUserId, payload],
      );
      console.log(`[tg-bot] 📎 pending ref: tg=${fromUserId} code=${payload}`);
    }

    // Always send a welcome message after a deep link.
    // The button is only included when APP_URL is HTTPS.
    const button = buildOpenAppButton();
    const welcomeText = button
      ? `🎰 <b>Welcome to Flop Club!</b>\n\nTap below to open the app.`
      : `🎰 <b>Welcome to Flop Club!</b>\n\n` + `Open the app from the bot menu to start playing.`;
    await this.sendDM(fromUserId, welcomeText, button);
  }

  private async handleChatMemberUpdate(update: any): Promise<void> {
    const chat = update.chat;
    const affectedUser = update.new_chat_member?.user;
    const newStatus = update.new_chat_member?.status;

    if (!chat || !affectedUser) return;

    const botId = await this.getBotId();

    // Bot's own membership changed (added/removed/promoted in a chat)
    if (affectedUser.id === botId) {
      const isAdmin = newStatus === 'administrator';
      await this.db.query(
        `INSERT INTO telegram_chats
           (chat_id, chat_type, title, bot_is_admin, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (chat_id) DO UPDATE
           SET bot_is_admin = EXCLUDED.bot_is_admin,
               title = EXCLUDED.title,
               updated_at = NOW()`,
        [chat.id, chat.type, chat.title ?? chat.username ?? 'Unknown', isAdmin],
      );
      return;
    }

    // A regular user's membership changed — update cache
    await this.db.query(
      `INSERT INTO telegram_memberships
         (chat_id, user_id, status, last_verified_at)
       SELECT $1, u.id, $2, NOW()
       FROM users u WHERE u.telegram_id = $3
       ON CONFLICT (chat_id, user_id) DO UPDATE
         SET status = EXCLUDED.status, last_verified_at = NOW()`,
      [chat.id, newStatus, affectedUser.id],
    );
  }

  private _botIdCache: number | null = null;
  private async getBotId(): Promise<number | null> {
    if (this._botIdCache) return this._botIdCache;
    try {
      const me = await tg('getMe');
      this._botIdCache = Number(me.id);
      return this._botIdCache;
    } catch {
      return null;
    }
  }

  // ---------- Auto-post helpers ----------
  async announceBigWin(params: {
    displayName: string;
    amount: number;
    blinds: string;
    variant: string;
  }): Promise<void> {
    const tpl = await this.db.query(
      `SELECT body FROM telegram_post_templates WHERE code = 'big_win' AND is_active = TRUE`,
    );
    if (!tpl.rows[0]) return;

    const chat = await this.db.query(
      `SELECT chat_id FROM telegram_chats
       WHERE is_primary = TRUE AND chat_type = 'channel' AND is_active = TRUE`,
    );
    if (!chat.rows[0]) return;

    const text = String(tpl.rows[0].body)
      .replace('{player}', params.displayName)
      .replace('{amount}', params.amount.toFixed(2))
      .replace('{blinds}', params.blinds)
      .replace('{variant}', params.variant)
      .replace('{app_link}', process.env.APP_URL ?? '');

    await this.postMessage({ chatId: Number(chat.rows[0].chat_id), text });
  }

  // ---------- Community auto-posts ----------

  /**
   * Get the primary channel's chat_id, or null if not configured.
   */
  async getPrimaryChannelId(): Promise<number | null> {
    const r = await this.db.query(
      `SELECT chat_id FROM telegram_chats
       WHERE is_primary = TRUE AND chat_type = 'channel' AND is_active = TRUE
       LIMIT 1`,
    );
    return r.rows[0]?.chat_id ? Number(r.rows[0].chat_id) : null;
  }

  /**
   * Check if a post was already sent (idempotency).
   * Returns true if safe to post.
   */
  async tryClaimPostSlot(
    postType: string,
    targetId: string,
    chatId: number,
    payload: any,
  ): Promise<boolean> {
    try {
      const r = await this.db.query(
        `INSERT INTO community_posts_log (post_type, target_id, chat_id, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (post_type, target_id) DO NOTHING
         RETURNING id`,
        [postType, targetId, chatId, JSON.stringify(payload ?? {})],
      );
      return r.rows.length > 0;
    } catch (e: any) {
      console.warn('[tg-bot] claim slot failed:', e.message);
      return false;
    }
  }

  /**
   * B1 — Tournament starting in N minutes.
   */
  async announceTournamentStarting(params: {
    tournamentId: number;
    name: string;
    minutesUntil: number;
    prizeUsd: number;
    buyIn: number;
    registeredCount: number;
    maxPlayers: number;
    variant: string;
  }): Promise<void> {
    const chatId = await this.getPrimaryChannelId();
    if (!chatId) return;

    const claimed = await this.tryClaimPostSlot(
      'tournament_starting',
      String(params.tournamentId),
      chatId,
      { minutesUntil: params.minutesUntil },
    );
    if (!claimed) return;

    const appUrl = process.env.APP_URL ?? '';
    const buyInLabel = params.buyIn > 0 ? `$${params.buyIn.toFixed(2)}` : 'FREE';
    const text =
      `🎰 <b>${this.escapeHtml(params.name)}</b>\n` +
      `starts in <b>${params.minutesUntil} minutes</b>!\n\n` +
      `💰 Prize pool: <b>$${params.prizeUsd.toFixed(0)}</b>\n` +
      `🎫 Buy-in: <b>${buyInLabel}</b>\n` +
      `👥 Players: <b>${params.registeredCount}/${params.maxPlayers}</b>\n` +
      `🃏 Variant: <b>${this.escapeHtml(params.variant.toUpperCase())}</b>\n\n` +
      `<a href="${appUrl}">Register →</a>`;

    try {
      await this.postMessage({ chatId, text, disablePreview: true });
      console.log(`[tg-bot] 📢 announced tournament #${params.tournamentId} starting`);
    } catch (e: any) {
      console.warn('[tg-bot] announceTournamentStarting failed:', e.message);
    }
  }

  /**
   * B2 — Tournament finished with winner + prize.
   */
  async announceTournamentFinished(params: {
    tournamentId: number;
    name: string;
    winnerDisplayName: string | null;
    prizeUsd: number;
    totalPlayers: number;
    variant: string;
  }): Promise<void> {
    const chatId = await this.getPrimaryChannelId();
    if (!chatId) return;

    const claimed = await this.tryClaimPostSlot(
      'tournament_finished',
      String(params.tournamentId),
      chatId,
      { winner: params.winnerDisplayName },
    );
    if (!claimed) return;

    const appUrl = process.env.APP_URL ?? '';
    const winnerLine = params.winnerDisplayName
      ? `🏆 Winner: <b>${this.escapeHtml(params.winnerDisplayName)}</b>\n`
      : '';

    const text =
      `🏁 <b>${this.escapeHtml(params.name)}</b> · finished\n\n` +
      winnerLine +
      `💰 Prize pool: <b>$${params.prizeUsd.toFixed(2)}</b>\n` +
      `👥 Players: <b>${params.totalPlayers}</b>\n` +
      `🃏 Variant: <b>${this.escapeHtml(params.variant.toUpperCase())}</b>\n\n` +
      `<a href="${appUrl}">See tournament history →</a>`;

    try {
      await this.postMessage({ chatId, text, disablePreview: true });
      console.log(`[tg-bot] 📢 announced tournament #${params.tournamentId} finished`);
    } catch (e: any) {
      console.warn('[tg-bot] announceTournamentFinished failed:', e.message);
    }
  }

  /**
   * B3 — Daily top-3 winners.
   */
  async announceDailyLeader(params: {
    dateLabel: string; // 'YYYY-MM-DD'
    topWinners: Array<{ displayName: string; totalWon: number; wins: number }>;
  }): Promise<void> {
    const chatId = await this.getPrimaryChannelId();
    if (!chatId) return;

    if (params.topWinners.length === 0) return;

    const claimed = await this.tryClaimPostSlot('daily_leader', params.dateLabel, chatId, {
      count: params.topWinners.length,
    });
    if (!claimed) return;

    const appUrl = process.env.APP_URL ?? '';
    const medals = ['🥇', '🥈', '🥉'];
    const lines = params.topWinners.slice(0, 3).map((w, i) => {
      const m = medals[i] ?? `#${i + 1}`;
      return `${m} <b>${this.escapeHtml(w.displayName)}</b> — <b>+$${w.totalWon.toFixed(2)}</b> · ${w.wins} ${w.wins === 1 ? 'win' : 'wins'}`;
    });

    const text =
      `👑 <b>Top Winners · Last 24h</b>\n\n` +
      lines.join('\n') +
      `\n\n<a href="${appUrl}">See full leaderboard →</a>`;

    try {
      await this.postMessage({ chatId, text, disablePreview: true });
      console.log(`[tg-bot] 📢 announced daily leaders for ${params.dateLabel}`);
    } catch (e: any) {
      console.warn('[tg-bot] announceDailyLeader failed:', e.message);
    }
  }

  /**
   * HTML-escape untrusted user text (display names, tournament names, etc.)
   */
  private escapeHtml(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// ---------- Long Polling ----------
let _pollAbort = false;

export function stopPolling(): void {
  _pollAbort = true;
}

export async function startPolling(db: Pool, intervalMs: number = 1000): Promise<void> {
  const bot = getTelegramBot(db);
  console.log('[tg-bot] long polling starting...');

  let offset = 0;

  try {
    const init = await bot.getUpdatesRaw({ offset: -1, timeout: 0, limit: 1 });
    if (init.length > 0) {
      offset = init[init.length - 1].update_id + 1;
      console.log(`[tg-bot] skipping ${init.length} old updates, offset=${offset}`);
    }
  } catch (e: any) {
    console.warn('[tg-bot] initial offset fetch failed:', e.message);
  }

  console.log('[tg-bot] long polling started');

  let iteration = 0;
  let lastHeartbeat = Date.now();
  const HEARTBEAT_MS = 30_000;

  while (!_pollAbort) {
    iteration++;
    try {
      const updates = await bot.getUpdatesRaw({
        offset,
        timeout: 20,
        limit: 100,
      });

      if (updates.length > 0) {
        console.log(`[tg-bot] ← received ${updates.length} update(s), offset was ${offset}`);
      }

      for (const update of updates) {
        console.log(
          `[tg-bot] processing update_id=${update.update_id}, type=${update.message ? 'message' : update.chat_member ? 'chat_member' : update.my_chat_member ? 'my_chat_member' : update.channel_post ? 'channel_post' : 'other'}`,
        );
        offset = update.update_id + 1;
        try {
          await bot.handleUpdate(update);
        } catch (e: any) {
          console.error(`[tg-bot] handleUpdate failed for ${update.update_id}:`, e.message);
        }
      }

      // Heartbeat every 30s so we know polling is alive
      if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
        console.log(`[tg-bot] 💓 polling alive (iter=${iteration}, offset=${offset})`);
        lastHeartbeat = Date.now();
      }
    } catch (e: any) {
      const msg = String(e.message ?? '');
      const cause = e?.cause;
      const causeMsg = cause ? String(cause.message ?? cause.code ?? cause) : '';
      console.warn(
        `[tg-bot] poll error (iter=${iteration}, offset=${offset}): ${msg}${causeMsg ? ` (${causeMsg})` : ''}`,
      );

      const backoff =
        msg.includes('fetch failed') || causeMsg.includes('ECONNRESET') ? 5000 : intervalMs;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  console.log('[tg-bot] long polling stopped');
}

// ---------- Singleton ----------
let _instance: TelegramBotService | null = null;
export function getTelegramBot(db: Pool): TelegramBotService {
  if (_instance) return _instance;
  _instance = new TelegramBotService(db);
  return _instance;
}
