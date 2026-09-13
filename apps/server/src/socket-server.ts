import { Server as SocketIOServer } from 'socket.io';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { gameManager } from './game-manager.js';
import {
  recordIp, recordDevice, analyzeUser,
} from './anti-cheat.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

export function setupSocketServer(io: SocketIOServer, db: Pool): void {
  console.log('[socket.io] ✅ server setup');

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('no_token'));

      const payload = verifyToken(token, JWT_SECRET);
      if (!payload) return next(new Error('invalid_token'));

      const userId = payload.uid;

      const uCheck = await db.query(
        'SELECT is_banned, display_name FROM users WHERE id = $1',
        [userId]
      );
      if (uCheck.rows.length === 0) return next(new Error('user_not_found'));
      if (uCheck.rows[0].is_banned) return next(new Error('banned'));

      (socket as any).userId = userId;
      (socket as any).displayName = uCheck.rows[0].display_name;

      const ip = socket.handshake.address || 'unknown';
      await recordIp(db, userId, ip);
      const deviceHash = socket.handshake.auth?.device;
      if (deviceHash) await recordDevice(db, userId, deviceHash);

      next();
    } catch (e: any) {
      next(new Error(e.message));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    const displayName = (socket as any).displayName;

    console.log(`[socket.io] 🟢 connected: ${displayName} (${socket.id})`);

    socket.on('table:join', async (data: { tableId: number }, ack?: Function) => {
      try {
        const tableId = Number(data?.tableId);
        if (!tableId) {
          ack?.({ ok: false, error: 'invalid_table_id' });
          return;
        }

        const tableRes = await db.query('SELECT * FROM poker_tables WHERE id = $1', [tableId]);
        if (tableRes.rows.length === 0) {
          ack?.({ ok: false, error: 'table_not_found' });
          return;
        }

        const table = tableRes.rows[0];

        const room = gameManager.joinRoom({
          tableId,
          userId,
          displayName,
          socketId: socket.id,
          tableConfig: table,
        });

        socket.join(`table:${tableId}`);

        ack?.({
          ok: true,
          tableId,
          userId,
          displayName,
          playersInRoom: room.players.size,
        });

        gameManager.broadcastState(tableId, io);

        socket.to(`table:${tableId}`).emit('table:player_joined', {
          userId,
          displayName,
          total: room.players.size,
        });

        setTimeout(async () => {
          const r = gameManager.getRoom(tableId);
          if (!r) return;
          if (r.players.size >= 2 && r.game.state.phase === 'waiting') {
            await gameManager.startHand(tableId, io).catch((e) =>
              console.error('[hand] startHand error:', e)
            );
          }
        }, 1500);

        setTimeout(() => analyzeUser(db, userId, tableId), 2000);
      } catch (e: any) {
        console.error('[socket] join error', e);
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('table:action', async (data: { action: string; amount?: number }, ack?: Function) => {
      try {
        const action = String(data?.action ?? '').toUpperCase();
        const amount = Number(data?.amount ?? 0);

        if (!['FOLD', 'CHECK', 'CALL', 'RAISE', 'BET'].includes(action)) {
          ack?.({ ok: false, error: 'invalid_action' });
          return;
        }

        const result = await gameManager.act(socket.id, action, amount, io);
        ack?.(result);
      } catch (e: any) {
        console.error('[socket] action error', e);
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('table:time_bank', async (data: any, ack?: Function) => {
      try {
        const result = await gameManager.useTimeBank(socket.id, io);
        ack?.(result);
      } catch (e: any) {
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('table:leave', async (data: any, ack?: Function) => {
      try {
        const ctx = gameManager.getPlayerBySocket(socket.id);
        if (ctx) socket.leave(`table:${ctx.room.tableId}`);
        gameManager.leaveRoom(socket.id);
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, error: e.message });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket.io] 🔴 disconnected: ${displayName} (${socket.id}) — ${reason}`);
      const ctx = gameManager.getPlayerBySocket(socket.id);
      if (ctx) {
        const tableId = ctx.room.tableId;
        socket.to(`table:${tableId}`).emit('table:player_left', {
          userId,
          total: Math.max(0, ctx.room.players.size - 1),
        });
      }
      gameManager.leaveRoom(socket.id);
    });

    socket.on('ping:app', (cb?: Function) => {
      cb?.({ pong: true, time: Date.now() });
    });
  });
}