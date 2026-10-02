/**
 * Public i18n entry point.
 *
 * Every consumer imports from here; nothing else in the app may import
 * `catalog/*`, `loaders`, `state` or `format` directly. Keeping this surface
 * small is what makes a future swap (e.g. Paraglide) a change inside this folder.
 *
 *   import { t, lang, setLang, LANGUAGES, fmt, dir } from '../i18n';
 *   <span>{$t('nav.home')}</span>
 *   <span>{$fmt.currency(12.5)}</span>
 */

import { derived, get } from 'svelte/store';
import en from './catalog/en';
import { applyDocumentLang, lang, localeTag, messages, persistLang } from './state';
import { detectLang, loadCatalog, lookup } from './loaders';
import type { Dict, Lang, LanguageOption, MessageKey, MessageParams, TranslateFn } from './types';

export {
  fmt,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatTime,
  formatRelative,
} from './format';
export { dir, isRtl, lang, localeTag } from './state';
// Support surface: used by the i18n test suite, not by app code.
export {
  catalogLeaves,
  deepMerge,
  detectLang,
  loadCatalog,
  lookup,
  normalizeLang,
} from './loaders';
export type { Dict, Lang, LanguageOption, MessageKey, MessageParams, TranslateFn } from './types';

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'fa', label: 'Persian', nativeLabel: 'فارسی', rtl: true },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', rtl: true },
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
];

const DEV = import.meta.env.DEV;
const pluralRules = new Map<Lang, Intl.PluralRules>();
const missingKeys = new Set<string>();
const missingParams = new Set<string>();

function pluralCategory(l: Lang, value: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(l);
  if (!rules) {
    rules = new Intl.PluralRules(localeTag(l));
    pluralRules.set(l, rules);
  }
  return rules.select(value);
}

function interpolate(template: string, params?: MessageParams): string {
  if (!template.includes('{')) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      if (DEV && !missingParams.has(match)) {
        missingParams.add(match);
        console.warn(`[i18n] missing param ${match}`);
      }
      return match;
    }
    return String(value);
  });
}

/**
 * Resolves `key` in `dict`.
 *
 * When `params.n` is a number a plural variant (`<key>_one`, `<key>_few`, …) wins,
 * falling back to `<key>_other`. The dict is already merged with `en` by the
 * loader, so a catalog gap degrades to English.
 */
export function translate(dict: Dict, l: Lang, key: string, params?: MessageParams): string {
  let resolved = key;
  if (typeof params?.n === 'number') {
    const category = `${key}_${pluralCategory(l, params.n)}`;
    if (lookup(dict, category) !== undefined) resolved = category;
    else if (lookup(dict, `${key}_other`) !== undefined) resolved = `${key}_other`;
  }

  const value = lookup(dict, resolved) ?? lookup(en as Dict, resolved);
  if (value === undefined) {
    if (DEV && !missingKeys.has(key)) {
      missingKeys.add(key);
      console.warn(`[i18n] missing key ${key}`);
    }
    return key;
  }
  return interpolate(value, params);
}

/** Reactive translator: `$t('nav.home')`, `$t('x.count', { n: 3 })`. */
export const t = derived(
  [lang, messages],
  ([$lang, $messages]) =>
    ((key: MessageKey, params?: MessageParams) =>
      translate($messages, $lang, key, params)) as TranslateFn,
);

async function applyMessages(l: Lang): Promise<void> {
  const dict = await loadCatalog(l);
  // A slower load must not overwrite a newer choice.
  if (get(lang) === l) messages.set(dict);
}

/** Sets the active language and loads its catalog asynchronously. */
export function setLang(l: Lang): void {
  if (get(lang) === l) return;
  persistLang(l);
  lang.set(l);
  void applyMessages(l);
}

/** Same as `setLang`, but resolves once the catalog is in place. */
export async function loadLanguage(l: Lang): Promise<void> {
  lang.set(l);
  await applyMessages(l);
}

/**
 * Boots i18n before the app mounts, so the first paint is already in the right
 * language and direction. Priority: stored choice, Telegram client, browser.
 */
export async function initI18n(force?: Lang): Promise<Lang> {
  const target = force ?? detectLang();
  await loadLanguage(target);
  return target;
}

// Single place that mirrors the active language onto <html>.
lang.subscribe((l) => applyDocumentLang(l));
