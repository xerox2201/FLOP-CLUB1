import { writable } from 'svelte/store';

/**
 * Server-time offset in ms (serverNow - clientNow).
 * Synced once on app start, then we tick locally.
 */
export const serverOffset = writable<number>(0);

let lastSyncAt = 0;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // re-sync every 5 min

export async function syncServerTime(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_INTERVAL_MS) return;

  try {
    const t0 = Date.now();
    const res = await fetch('/api/time');
    const t1 = Date.now();
    if (!res.ok) return;
    const data = (await res.json()) as { utc: number };
    // Assume symmetric latency: server time when request hit was around midpoint
    const rtt = t1 - t0;
    const clientMid = t0 + rtt / 2;
    const offset = data.utc - clientMid;
    serverOffset.set(offset);
    lastSyncAt = Date.now();
  } catch {
    // network error — keep previous offset
  }
}

export function startServerTimeSync(): void {
  syncServerTime(true);
  setInterval(() => syncServerTime(), SYNC_INTERVAL_MS);
}