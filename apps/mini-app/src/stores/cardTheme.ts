import { writable } from 'svelte/store';
import { CARD_THEMES, type CardTheme } from '../lib/card-themes';

const STORAGE_KEY = 'card_theme';

const stored: CardTheme =
  (typeof localStorage !== 'undefined'
    ? (localStorage.getItem(STORAGE_KEY) as CardTheme | null)
    : null) || 'classic';

export const cardTheme = writable<CardTheme>(stored);

// Persist whenever it changes
if (typeof localStorage !== 'undefined') {
  cardTheme.subscribe((v) => {
    localStorage.setItem(STORAGE_KEY, v);
  });
}

export { CARD_THEMES };
export type { CardTheme };