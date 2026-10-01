import { Server as SocketIOServer } from 'socket.io';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { gameManager } from './game-manager.js';
import { CommandQueue } from './command-queue.js';
import { ErrorCode } from './errors.js';
import { recordIp, recordDevice, analyzeUser } from './anti-cheat.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

// ============================================================
// Online users tracking (userId -> Set<socketId>)
// Counts unique logged-in users, not per-table seated players.
// User is "online" as long as at least one socket is connected.
// ============================================================
const onlineUsers = new Map<number, Set<string>>();

export function getOnlineUserCount(): number {
  return onlineUsers.size;
}

// ============================================================
// Chat
// ============================================================
interface ChatMessage {
  id: string;
  userId: number;
  displayName: string;
  avatarId: string;
  text: string;
  isEmoji: boolean;
  timestamp: number;
}

const CHAT_MAX_LENGTH = 200;
const CHAT_HISTORY_SIZE = 50;
const CHAT_COOLDOWN_MS = 1500;
const VIRTUAL_TABLE_THRESHOLD = 1_000_000;

export function setupSocketServer(io: SocketIOServer, db: Pool): void {
  console.log('[socket.io] server setup');
  const commandQueue = new CommandQueue(db);
  // ============================================================
  // Chat state (in-memory, per table)
  // ============================================================
  const chatHistory = new Map<number, ChatMessage[]>();
  const lastChatAt = new Map<string, number>(); // socketId → last message time

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error(ErrorCode.AUTH_REQUIRED));

      const payload = verifyToken(token, JWT_SECRET);
      if (!payload) return next(new Error(ErrorCode.INVALID_SESSION));

      const userId = payload.uid;

      const uCheck = await db.query(
        'SELECT is_banned, display_name, avatar_id FROM users WHERE id = $1',
        [userId],
      );
      if (uCheck.rows.length === 0) return next(new Error('user_not_found'));
      if (uCheck.rows[0].is_banned) return next(new Error('banned'));

      (socket as any).userId = userId;
      (socket as any).displayName = uCheck.rows[0].display_name;
      (socket as any).avatarId = uCheck.rows[0].avatar_id || 'king';

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
    const avatarId = (socket as any).avatarId || 'king';

    // ─── Online tracking ───
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    console.log(
      `[socket.io] connected: ${displayName} (${socket.id}) — online users: ${onlineUsers.size}`,
    );

    socket.on(
      'table:join',
      async (
        data: {
          tableId: number;
          lastHandNo?: number;
          lastSequence?: number;
          autoMuck?: boolean;
        },
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
              console.warn(
                `[socket] tournament table ${tableId} not found in gameManager (stale client)`,
              );
              return ack?.({
                ok: false,
                code: 'STALE_TOURNAMENT',
                hint: 'This table no longer exists. Please go back to Tournaments list.',
              });
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

          // 🔴 Disconnect any previous sockets for the same user+table
          //    This prevents multi-connect spam from rapid reconnect loops
          try {
            const existingRoom = gameManager.getRoom(tableId);
            if (existingRoom) {
              for (const playerInfo of existingRoom.players.values()) {
                if (
                  playerInfo.userId === userId &&
                  playerInfo.socketId &&
                  playerInfo.socketId !== socket.id
                ) {
                  const oldSocketId = playerInfo.socketId;
                  console.log(
                    `[socket] replacing old socket for user=${userId} table=${tableId}: ${oldSocketId} → ${socket.id}`,
                  );

                  // 🔴 CRITICAL: remove the old socketId from socketToPlayer BEFORE
                  //    calling disconnect, so leaveRoom(oldSocketId) will find nothing
                  //    and won't wipe the new socketId from the player record.
                  const room = gameManager.getRoom(tableId);
                  if (room) {
                    room.socketToPlayer.delete(oldSocketId);
                  }

                  try {
                    const oldSocket = io.sockets.sockets.get(oldSocketId);
                    if (oldSocket) {
                      oldSocket.leave(`table:${tableId}`);
                      oldSocket.disconnect(true);
                    }
                  } catch (e: any) {
                    console.warn('[socket] failed to disconnect old socket:', e.message);
                  }
                }
              }
            }
          } catch (e: any) {
            console.warn('[socket] dedup failed:', e.message);
          }

          const room = gameManager.joinRoom({
            tableId,
            userId,
            displayName,
            socketId: socket.id,
            tableConfig: table,
            autoMuck: data?.autoMuck,
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

          // Scope is per-user to prevent cross-user commandId collisions.
          // A malicious client could replay another user's commandId if
          // the scope were shared.
          const result = await commandQueue.run(
            commandId,
            userId,
            `table_action_user_${userId}`,
            () => gameManager.act(socket.id, action, amount, io),
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
    // ============================================================
    // CHAT — send message
    // ============================================================
    socket.on('table:chat', async (data: { text: string; isEmoji?: boolean }, ack?: Function) => {
      try {
        const ctx = gameManager.getPlayerBySocket(socket.id);
        if (!ctx) return ack?.({ ok: false, code: 'NOT_IN_TABLE' });

        const tableId = ctx.room.tableId;
        const text = String(data?.text ?? '').trim();

        if (!text) return ack?.({ ok: false, code: 'EMPTY' });
        if (text.length > CHAT_MAX_LENGTH) return ack?.({ ok: false, code: 'TOO_LONG' });

        // Anti-spam
        const now = Date.now();
        const lastAt = lastChatAt.get(socket.id) ?? 0;
        if (now - lastAt < CHAT_COOLDOWN_MS) {
          return ack?.({ ok: false, code: 'RATE_LIMIT' });
        }
        lastChatAt.set(socket.id, now);

        const msg: ChatMessage = {
          id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
          userId,
          displayName: displayName,
          avatarId: avatarId,
          text,
          isEmoji: !!data?.isEmoji || text.length <= 4,
          timestamp: now,
        };

        // Save to history
        const hist = chatHistory.get(tableId) ?? [];
        hist.push(msg);
        while (hist.length > CHAT_HISTORY_SIZE) hist.shift();
        chatHistory.set(tableId, hist);

        // Broadcast to all players at table
        io.to(`table:${tableId}`).emit('table:chat_message', msg);

        ack?.({ ok: true, messageId: msg.id });
      } catch (e: any) {
        ack?.({ ok: false, code: 'INTERNAL_ERROR', error: e.message });
      }
    });

    // ============================================================
    // CHAT — request history
    // ============================================================
    socket.on('table:chat_history', async (_data: any, ack?: Function) => {
      try {
        const ctx = gameManager.getPlayerBySocket(socket.id);
        if (!ctx) return ack?.({ ok: false, code: 'NOT_IN_TABLE' });
        const tableId = ctx.room.tableId;
        const hist = chatHistory.get(tableId) ?? [];
        ack?.({ ok: true, messages: hist });
      } catch (e: any) {
        ack?.({ ok: false, code: 'INTERNAL_ERROR', error: e.message });
      }
    });
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
    socket.on('table:update_prefs', async (data: { autoMuck?: boolean }, ack?: Function) => {
      try {
        const ctx = gameManager.getPlayerBySocket(socket.id);
        if (!ctx) return ack?.({ ok: false, code: 'NOT_IN_ROOM' });
        if (typeof data?.autoMuck === 'boolean') {
          ctx.player.autoMuck = data.autoMuck;
        }
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, code: 'INTERNAL_ERROR', error: e.message });
      }
    });
    socket.on('disconnect', (reason) => {
      lastChatAt.delete(socket.id);

      // ─── Online tracking cleanup ───
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }

      console.log(
        `[socket.io] disconnected: ${displayName} (${socket.id}) - ${reason} — online users: ${onlineUsers.size}`,
      );

      // 🔴 Only run leaveRoom if this socket is STILL the active one for this user.
      //    If dedup already replaced it, do nothing — the new socket owns the seat.
      const ctx = gameManager.getPlayerBySocket(socket.id);
      if (ctx && ctx.player.socketId === socket.id) {
        const tableId = ctx.room.tableId;
        socket.to(`table:${tableId}`).emit('table:player_left', {
          userId,
          total: Math.max(0, ctx.room.players.size - 1),
        });
        gameManager.leaveRoom(socket.id);
      }
    });

    socket.on('ping:app', (cb?: Function) => {
      cb?.({ pong: true, time: Date.now() });
    });
  });
}
