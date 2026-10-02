/**
 * Internal reactive state for the i18n module.
 *
 * Kept separate from `index.ts` so `format.ts` and `loaders.ts` can read the
 * active language without importing the public entry point (which imports them).
 */

import { derived, writable } from 'svelte/store';
import type { Dict, Lang } from './types';
import en from './catalog/en';

export const RTL_LANGS: readonly Lang[] = ['fa', 'ar'];

export function isRtl(l: Lang): boolean {
  return RTL_LANGS.includes(l);
}

/** BCP-47 tag used for `Intl` formatting. */
export const LOCALE_TAGS: Record<Lang, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ar: 'ar-SA',
  tr: 'tr-TR',
  ru: 'ru-RU',
  zh: 'zh-CN',
};

export function localeTag(l: Lang): string {
  return LOCALE_TAGS[l] ?? LOCALE_TAGS.en;
}

/** Active language. Starts at the source-of-truth language before detection runs. */
export const lang = writable<Lang>('en');

/** Merged catalog for the active language (always backed by `en`). */
export const messages = writable<Dict>(en as Dict);

/** Writing direction of the active language. */
export const dir = derived(lang, ($lang) => (isRtl($lang) ? 'rtl' : 'ltr'));

const STORAGE_KEY = 'lang';

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && value in LOCALE_TAGS;
}

export function readStoredLang(): Lang | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLang(stored) ? stored : null;
}

export function persistLang(l: Lang): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, l);
}

export function applyDocumentLang(l: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = l;
  document.documentElement.dir = isRtl(l) ? 'rtl' : 'ltr';
}
