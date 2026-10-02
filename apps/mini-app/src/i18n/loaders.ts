/**
 * Locale loading and detection.
 *
 * `en` is always available (source of truth and fallback); every other catalog is
 * loaded on demand and merged over `en`, so a catalog gap degrades to English
 * instead of an empty string or a raw key.
 */

import type { Dict, Lang } from './types';
import en from './catalog/en';
import { LOCALE_TAGS, readStoredLang } from './state';

const importers: Record<Lang, () => Promise<{ default: Dict }>> = {
  en: () => import('./catalog/en'),
  fa: () => import('./catalog/fa'),
  ar: () => import('./catalog/ar'),
  tr: () => import('./catalog/tr'),
  ru: () => import('./catalog/ru'),
  zh: () => import('./catalog/zh'),
};

const cache = new Map<Lang, Dict>();

export function deepMerge(base: Dict, override: Dict): Dict {
  const out: Dict = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof current === 'object' &&
      current !== null
    ) {
      out[key] = deepMerge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Dotted paths of every string leaf. Shared by the parity tests. */
export function catalogLeaves(dict: Dict, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) out.push(...catalogLeaves(value, path));
    else out.push(path);
  }
  return out;
}

export function lookup(dict: Dict, key: string): string | undefined {
  let current: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (typeof current !== 'string' && current !== undefined) current = current[part];
    else return undefined;
  }
  return typeof current === 'string' ? current : undefined;
}

const enLeaves = new Set(catalogLeaves(en as Dict));
const warned = new Set<Lang>();

function reportMissing(l: Lang, dict: Dict): void {
  if (!import.meta.env.DEV || warned.has(l)) return;
  warned.add(l);
  const present = new Set(catalogLeaves(dict));
  const missing = [...enLeaves].filter((key) => !present.has(key));
  if (missing.length > 0) {
    console.warn(
      `[i18n] ${l}: ${missing.length} key(s) missing, falling back to en: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`,
    );
  }
}

/** Loads (and caches) the merged catalog for a language. */
export async function loadCatalog(l: Lang): Promise<Dict> {
  const cached = cache.get(l);
  if (cached) return cached;

  const loaded = (await importers[l]()).default;
  const merged = deepMerge(en as Dict, loaded);
  cache.set(l, merged);
  reportMissing(l, loaded);
  return merged;
}

/** Primary subtag of a BCP-47 tag, mapped onto the supported languages. */
export function normalizeLang(code: string | null | undefined): Lang | null {
  if (!code) return null;
  const primary = code.toLowerCase().split(/[-_]/)[0];
  return primary in LOCALE_TAGS ? (primary as Lang) : null;
}

function telegramLang(): Lang | null {
  if (typeof window === 'undefined') return null;
  const code = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return normalizeLang(code);
}

function navigatorLang(): Lang | null {
  if (typeof navigator === 'undefined') return null;
  return normalizeLang(navigator.language);
}

/**
 * Language priority: stored choice, then the Telegram client, then the browser.
 * A server-stored preference (`users.language`) is layered on top of this in a
 * later wave, once `/api/me` exposes it.
 */
export function detectLang(): Lang {
  return readStoredLang() ?? telegramLang() ?? navigatorLang() ?? 'en';
}
