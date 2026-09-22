import { writable, get } from 'svelte/store';
import { api } from './api';

export interface BroadcastItem {
  id: number;
  title: string;
  message: string;
  target: string;
  severity: 'info' | 'warning' | 'success' | 'danger';
  createdAt: string;
}

export const broadcasts = writable<BroadcastItem[]>([]);
export const unreadCount = writable<number>(0);
export const broadcastsLoading = writable<boolean>(false);

export async function loadBroadcasts(): Promise<void> {
  broadcastsLoading.set(true);
  try {
    const res = await api.getBroadcasts();
    if (res.ok && res.data) {
      broadcasts.set(res.data.broadcasts);
      unreadCount.set(res.data.broadcasts.length);
    } else {
      broadcasts.set([]);
      unreadCount.set(0);
    }
  } catch {
    broadcasts.set([]);
    unreadCount.set(0);
  } finally {
    broadcastsLoading.set(false);
  }
}

export async function markRead(id: number): Promise<void> {
  const before = get(broadcasts);
  const target = before.find((b) => b.id === id);
  if (!target) return;

  // optimistic: remove from list
  broadcasts.update((arr) => arr.filter((b) => b.id !== id));
  unreadCount.update((n) => Math.max(0, n - 1));

  try {
    await api.markBroadcastRead(id);
  } catch {
    // rollback on failure
    broadcasts.set(before);
    unreadCount.update((n) => n + 1);
  }
}

export async function markAllRead(): Promise<void> {
  const before = get(broadcasts);
  if (before.length === 0) return;
  broadcasts.set([]);
  unreadCount.set(0);
  try {
    await Promise.all(before.map((b) => api.markBroadcastRead(b.id)));
  } catch {
    broadcasts.set(before);
    unreadCount.set(before.length);
  }
}

// Poll every 30s
let pollTimer: any = null;
export function startBroadcastPolling(): void {
  if (pollTimer) return;
  loadBroadcasts();
  pollTimer = setInterval(loadBroadcasts, 30_000);
}

export function stopBroadcastPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
