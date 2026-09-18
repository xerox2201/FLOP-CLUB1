import { writable } from 'svelte/store';

export const adminRequested = writable(false);
export const adminPromptOpen = writable(false);

export function requestAdmin() {
  adminPromptOpen.set(true);
}

export function confirmAdmin() {
  adminPromptOpen.set(false);
  adminRequested.set(true);
}

export function cancelAdmin() {
  adminPromptOpen.set(false);
}