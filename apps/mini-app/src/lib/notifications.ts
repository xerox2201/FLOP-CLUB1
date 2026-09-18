import { writable } from 'svelte/store';

export interface Notif {
  id: string;
  icon: string;
  title: string;
  message?: string;
  color: string;
  ts: number;
}

export const notifications = writable<Notif[]>([]);

export function pushNotif(n: Omit<Notif, 'id' | 'ts'>): void {
  const id = Math.random().toString(36).slice(2);
  const item: Notif = { ...n, id, ts: Date.now() };
  notifications.update((arr) => {
    // Cap at 4 toasts
    const next = [...arr, item];
    return next.length > 4 ? next.slice(next.length - 4) : next;
  });
  setTimeout(() => {
    notifications.update((arr) => arr.filter((x) => x.id !== id));
  }, 5000);
}

export function dismissNotif(id: string): void {
  notifications.update((arr) => arr.filter((x) => x.id !== id));
}