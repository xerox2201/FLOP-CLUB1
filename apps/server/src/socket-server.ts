import { Server as SocketIOServer } from 'socket.io';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { gameManager } from './game-manager.js';
import { CommandQueue } from './command-queue.js';
import { ErrorCode } from './errors.js';
import { recordIp, recordDevice, analyzeUser } from './anti-cheat.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

const VIRTUAL_TABLE_THRESHOLD = 1_000_000;

export function setupSocketServer(io: SocketIOServer, db: Pool): void {
  console.log('[socket.io] server setup');
  const commandQueue = new CommandQueue(db);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error(ErrorCode.AUTH_REQUIRED));

      const payload = verifyToken(token, JWT_SECRET);
      if (!payload) return next(new Error(ErrorCode.INVALID_SESSION));

      const userId = payload.uid;

      const uCheck = await db.query('SELECT is_banned, display_name FROM users WHERE id = $1', [
        userId,
      ]);
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

    console.log(`[socket.io] connected: ${displayName} (${socket.id})`);

    socket.on(
      'table:join',
      async (
        data: { tableId: number; lastHandNo?: number; lastSequence?: number },
        ack?: Function,
      ) => {
        try {
          const tableId = Number(data?.tableId);
          if (!tableId) return ack?.({ ok: false, code: ErrorCode.TABLE_NOT_FOUND });

          const isTournament = tableId >= VIRTUAL_TABLE_THRESHOLD;

          let table: any;

          if (isTournament) {
            const existingRoom = gameManager.getRoom(tableId);
            if (!existingRoom) {
              console.warn(`[socket] tournament table ${tableId} not found in gameManager`);
              return ack?.({ ok: false, code: 'TOURNAMENT_TABLE_NOT_FOUND' });
            }
            table = {
              id: tableId,
              variant: existingRoom.variant,
              mode: 'real',
              speed: existingRoom.speed,
              blinds: existingRoom.blinds,
              rake_pct: 0,
            };
            console.log(
              `[socket] ${displayName} joining tournament table ${tableId} (T#${existingRoom.tournamentId} table ${existingRoom.tournamentTableNumber})`,
            );
          } else {
            const tableRes = await db.query('SELECT * FROM poker_tables WHERE id = $1', [tableId]);
            if (tableRes.rows.length === 0)
              return ack?.({ ok: false, code: ErrorCode.TABLE_NOT_FOUND });
            table = tableRes.rows[0];
          }

          const room = gameManager.joinRoom({
            tableId,
            userId,
            displayName,
            socketId: socket.id,
            tableConfig: table,
          });

          socket.join(`table:${tableId}`);

          const sync = gameManager.resync(
            tableId,
            userId,
            data?.lastHandNo ?? null,
            data?.lastSequence ?? null,
          );

          ack?.({
            ok: true,
            tableId,
            userId,
            displayName,
            playersInRoom: room.players.size,
            syncType: sync.syncType,
            currentHandNo: sync.currentHandNo,
            currentSequence: sync.currentSequence,
          });

          gameManager.broadcastState(tableId, io);

          socket.to(`table:${tableId}`).emit('table:player_joined', {
            userId,
            displayName,
            total: room.players.size,
          });

          // 🔴 Auto-start logic
          setTimeout(async () => {
            const r = gameManager.getRoom(tableId);
            if (!r) return;
            if (r.game.state.phase !== 'waiting') return;

            const connected = [...r.players.values()].filter((p) => !!p.socketId).length;
            const total = r.players.size;

            if (isTournament) {
              if (connected >= 2) {
                console.log(
                  `[hand] 🏆 tournament table ${tableId}: starting with ${connected}/${total} connected`,
                );
                try {
                  await gameManager.startHand(tableId, io);
                } catch (e) {
                  console.error('[hand] tournament startHand error:', e);
                }
              } else {
                console.log(
                  `[hand] tournament table ${tableId}: waiting (${connected}/${total} connected)`,
                );
              }
            } else {
              if (connected >= 2) {
                try {
                  await gameManager.startHand(tableId, io);
                } catch (e) {
                  console.error('[hand] startHand error:', e);
                }
              }
            }
          }, 1500);

          setTimeout(() => analyzeUser(db, userId, tableId), 2000);
        } catch (e: any) {
          console.error('[socket] join error', e);
          ack?.({ ok: false, code: 'JOIN_FAILED', error: e.message });
        }
      },
    );

    socket.on(
      'table:action',
      async (data: { action: string; amount?: number; commandId?: string }, ack?: Function) => {
        try {
          const action = String(data?.action ?? '').toUpperCase();
          const amount = Number(data?.amount ?? 0);
          const commandId = data?.commandId || `${socket.id}_${Date.now()}_${Math.random()}`;

          if (!['FOLD', 'CHECK', 'CALL', 'RAISE', 'BET'].includes(action)) {
            return ack?.({ ok: false, code: ErrorCode.INVALID_ACTION });
          }

          const result = await commandQueue.run(commandId, userId, 'table_action', () =>
            gameManager.act(socket.id, action, amount, io),
          );

          ack?.(result);
        } catch (e: any) {
          console.error('[socket] action error', e);
          ack?.({ ok: false, code: 'INTERNAL_ERROR', error: e.message });
        }
      },
    );

    socket.on('table:time_bank', async (data: any, ack?: Function) => {
      try {
        const result = await gameManager.useTimeBank(socket.id, io);
        ack?.(result);
      } catch (e: any) {
        ack?.({ ok: false, code: 'INTERNAL_ERROR', error: e.message });
      }
    });

    socket.on(
      'table:resync',
      async (
        data: { tableId: number; lastHandNo: number; lastSequence: number },
        ack?: Function,
      ) => {
        try {
          const tableId = Number(data?.tableId);
          const sync = gameManager.resync(
            tableId,
            userId,
            data?.lastHandNo ?? null,
            data?.lastSequence ?? null,
          );
          ack?.({ ok: true, ...sync });
          gameManager.broadcastState(tableId, io);
        } catch (e: any) {
          ack?.({ ok: false, code: 'INTERNAL_ERROR', error: e.message });
        }
      },
    );

    socket.on('table:leave', async (data: any, ack?: Function) => {
      try {
        const ctx = gameManager.getPlayerBySocket(socket.id);
        if (ctx) socket.leave(`table:${ctx.room.tableId}`);
        gameManager.leaveRoom(socket.id);
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, code: 'INTERNAL_ERROR', error: e.message });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket.io] disconnected: ${displayName} (${socket.id}) - ${reason}`);
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
