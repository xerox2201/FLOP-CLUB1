import { writable, derived, get } from 'svelte/store';
import { TableSocketIO, type TableState } from './socket';
import { preferences } from './preferences';

export interface ActiveTableMeta {
  tableId: number;
  name?: string;
  mode?: 'free' | 'real';
  variant?: string;
}

export interface ActiveTable {
  meta: ActiveTableMeta;
  socket: TableSocketIO;
  state: TableState | null;
  handResult: any;
  connected: boolean;
  reconnecting: boolean;
  myUserId: number | null;
  joinedAt: number;
  lastError?: { message: string; at: number };
}

type MapT = globalThis.Map<number, ActiveTable>;
const store = writable<MapT>(new globalThis.Map());

function teardownSocket(socket: TableSocketIO): void {
  try {
    socket.leaveTable();
  } catch {}
  // Give the leave packet a moment, then close
  setTimeout(() => {
    try {
      socket.close();
    } catch {}
  }, 250);
}

function join(meta: ActiveTableMeta, token: string, myUserId: number | null): ActiveTable {
  const cur = get(store);
  const existing = cur.get(meta.tableId);

  // 🔴 If the same table exists but belongs to a different user, reset it
  if (existing) {
    if (existing.myUserId !== null && existing.myUserId !== myUserId) {
      console.log(
        `[activeTables] userId changed for table ${meta.tableId} (${existing.myUserId} → ${myUserId}), resetting`,
      );
      teardownSocket(existing.socket);
      cur.delete(meta.tableId);
      store.set(new globalThis.Map(cur));
    } else if (existing.socket.isClosed?.()) {
      // 🔴 Socket was killed (e.g. STALE_TOURNAMENT). Reset entry.
      console.log(`[activeTables] table ${meta.tableId} has closed socket, resetting`);
      cur.delete(meta.tableId);
      store.set(new globalThis.Map(cur));
    } else {
      // Same user, live socket — reuse
      return existing;
    }
  }

  const autoMuck = get(preferences).autoMuck;
  const socket = new TableSocketIO(meta.tableId, token, autoMuck);

  const entry: ActiveTable = {
    meta,
    socket,
    state: null,
    handResult: null,
    connected: false,
    reconnecting: false,
    myUserId,
    joinedAt: Date.now(),
  };

  socket.on((evt: any) => {
    store.update((m) => {
      const e = m.get(meta.tableId);
      if (!e) return m;
      if (evt.type === 'state') {
        e.state = evt.state;
      } else if (evt.type === 'hand_result') {
        e.handResult = evt.result;
        e.state = evt.state;
        const hr = evt.result;
        setTimeout(() => {
          store.update((mm) => {
            const ee = mm.get(meta.tableId);
            if (ee && ee.handResult === hr) ee.handResult = null;
            return new globalThis.Map(mm);
          });
        }, 10000);
      } else if (evt.type === 'connected') {
        e.connected = true;
        e.reconnecting = false;
      } else if (evt.type === 'disconnected') {
        e.connected = false;
        // Only mark reconnecting if the socket wants to keep trying
        e.reconnecting = evt.reason !== 'stale_room';
      } else if (evt.type === 'reconnecting') {
        e.reconnecting = true;
      } else if (evt.type === 'error') {
        e.lastError = { message: evt.message, at: Date.now() };
      }
      return new globalThis.Map(m);
    });
  });

  socket.connect();
  cur.set(meta.tableId, entry);
  store.set(new globalThis.Map(cur));
  return entry;
}

function leave(tableId: number): void {
  const cur = get(store);
  const e = cur.get(tableId);
  if (!e) return;
  teardownSocket(e.socket);
  cur.delete(tableId);
  store.set(new globalThis.Map(cur));
}

function leaveAll(): void {
  const cur = get(store);
  for (const e of cur.values()) {
    teardownSocket(e.socket);
  }
  store.set(new globalThis.Map());
}

function updateAutoMuck(v: boolean): void {
  for (const e of get(store).values()) {
    try {
      e.socket.updateAutoMuck(v);
    } catch {}
  }
}

export const activeTables = {
  subscribe: store.subscribe,
  join,
  leave,
  leaveAll,
  updateAutoMuck,
};

export const myTurnTables = derived(activeTables, ($t) => {
  const out: number[] = [];
  for (const [id, t] of $t) {
    if (!t.state || !t.myUserId) continue;
    const seat = t.state.seats.find((s: any) => Number(s.userId) === Number(t.myUserId));
    if (!seat) continue;
    const winners = t.state.winners ?? [];
    if (t.state.currentSeat === seat.seat && !seat.folded && !seat.allIn && winners.length === 0) {
      out.push(id);
    }
  }
  return out;
});
