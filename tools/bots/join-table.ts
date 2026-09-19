import { io, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import 'dotenv/config';

const TABLE_ID = Number(process.argv[2]) || 1;
const BOT_COUNT = Number(process.argv[3]) || 5;
const JWT_SECRET =
  process.env.JWT_SECRET || 'change_me_please_32_chars_minimum_secret';
const API_URL = 'http://localhost:4000';

const BOT_AVATARS = [
  'king', 'queen', 'fox', 'wolf', 'dragon', 'lion',
  'shark', 'eagle', 'cat', 'ghost', 'pirate', 'wizard',
  'samurai', 'sphinx', 'vampire', 'angel',
];

async function main() {
  const db = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://poker:pokerpass@localhost:5432/poker',
  });

  console.log(
    `[join-table] preparing ${BOT_COUNT} bots for table ${TABLE_ID}`,
  );

  const bots: any[] = [];

  for (let i = 0; i < BOT_COUNT; i++) {
    const tgId = 900100 + i;
    const displayName = `Bot${i + 1}`;
    const avatarId = BOT_AVATARS[i % BOT_AVATARS.length];

    let res = await db.query(
      'SELECT id, display_name, avatar_id FROM users WHERE telegram_id = $1',
      [tgId],
    );

    if (res.rows.length === 0) {
      res = await db.query(
        `INSERT INTO users (telegram_id, display_name, avatar_id)
         VALUES ($1, $2, $3) RETURNING id, display_name, avatar_id`,
        [tgId, displayName, avatarId],
      );
      console.log(`  ✨ created ${displayName} (avatar: ${avatarId})`);
    } else {
      // update avatar in case it changed
      await db.query('UPDATE users SET avatar_id = $1 WHERE id = $2', [
        avatarId,
        res.rows[0].id,
      ]);
      res.rows[0].avatar_id = avatarId;
    }

    bots.push({
      id: Number(res.rows[0].id),
      displayName: res.rows[0].display_name,
      avatarId: res.rows[0].avatar_id,
      tgId,
    });
  }

  await db.end();

  // ============================================================
  // Connect each bot
  // ============================================================
  const sockets: Socket[] = [];

  for (const bot of bots) {
    const token = jwt.sign({ uid: bot.id, tg: bot.tgId }, JWT_SECRET);

        const socket = io(API_URL, {
      auth: { token, device: `bot_device_${bot.id}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log(`[bot ${bot.displayName}] connected`);

      socket.emit(
        'table:join',
        { tableId: TABLE_ID },
        (res: any) => {
          if (res?.ok) {
            console.log(
              `[bot ${bot.displayName}] joined table ${TABLE_ID} (${res.playersInRoom} players)`,
            );
          } else {
            console.error(
              `[bot ${bot.displayName}] join failed:`,
              res?.code || res?.error,
            );
          }
        },
      );
    });

    // ============ Auto-action ============
    socket.on('table:state', (state: any) => {
      const mySeat = state.seats?.find((s: any) => s.userId === bot.id);
      if (!mySeat) return;
      if (mySeat.folded || mySeat.allIn) return;
      if (state.phase === 'waiting' || state.phase === 'showdown') return;
      if (state.currentSeat !== mySeat.seat) return;

      // Delay random 1.5-3s for realism
      setTimeout(() => {
        // Check current state again (might have changed)
        const maxBet = Math.max(
          0,
          ...state.seats.map((s: any) => s.betThisStreet || 0),
        );
        const myBet = mySeat.betThisStreet || 0;
        const toCall = maxBet - myBet;

        // Simple bot strategy: 20% raise, 80% check/call
        const r = Math.random();
        let action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE';
        let amount = 0;

        if (r < 0.05 && toCall > 0) {
          action = 'FOLD';
        } else if (r < 0.15 && mySeat.stack > maxBet * 2) {
          // Small raise
          action = 'RAISE';
          const minRaise = state.minRaise || state.bigBlind || 10;
          amount = maxBet + minRaise;
          if (amount > mySeat.stack + myBet) {
            amount = mySeat.stack + myBet;
          }
        } else if (toCall === 0) {
          action = 'CHECK';
        } else {
          action = 'CALL';
        }

        socket.emit(
          'table:action',
          {
            action,
            amount,
            commandId: `bot_${bot.id}_${Date.now()}_${Math.random()}`,
          },
          (res: any) => {
            if (!res?.ok) {
              console.warn(
                `[bot ${bot.displayName}] action failed: ${action} — ${res?.code || res?.error}`,
              );
            }
          },
        );
      }, 1500 + Math.random() * 1500);
    });

    socket.on('table:hand_result', (data: any) => {
      // ignore
    });

    socket.on('connect_error', (e: any) => {
      console.error(`[bot ${bot.displayName}] connect error:`, e.message);
    });

    sockets.push(socket);
  }

  console.log(
    `\n✅ ${BOT_COUNT} bots connected to table ${TABLE_ID}. Ctrl+C to disconnect.\n`,
  );

  const cleanup = () => {
    console.log('\n[join-table] disconnecting bots…');
    sockets.forEach((s) => s.disconnect());
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});