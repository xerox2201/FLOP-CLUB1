import { writable } from 'svelte/store';

export const adminRequested = writable(false);

export function requestAdmin() {
  adminRequested.set(true);
}