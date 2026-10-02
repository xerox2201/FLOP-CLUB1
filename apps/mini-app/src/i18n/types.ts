/**
 * i18n type surface.
 *
 * Message keys are derived from the `en` catalog, so a typo in a `t()` call is a
 * `svelte-check` failure instead of a runtime fallback to the raw key.
 */

import type en from './catalog/en';

export type Lang = 'en' | 'fa' | 'ar' | 'tr' | 'ru' | 'zh';

/** A catalog: nested string leaves. */
export type Dict = { [key: string]: string | Dict };

type EnDict = typeof en;

/** Dotted paths to every string leaf of a catalog, e.g. `nav.home`. */
export type DeepKeys<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${DeepKeys<T[K]>}`;
    }[keyof T & string];

export type MessageKey = DeepKeys<EnDict> | PluralStem<DeepKeys<EnDict>>;

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Stems of plural variants are valid keys too: `common.players_one` in the
 * catalog is requested as `t('common.players', { n })`.
 */
type PluralStem<K extends string> = K extends `${infer Stem}_${PluralCategory}` ? Stem : never;

/**
 * Values substituted into `{name}` placeholders.
 *
 * Numbers are inserted verbatim: `t()` never formats them, so machine values
 * (seeds, hashes, hand ids, blinds) can not be localized by accident. Callers
 * that show a localizable quantity pass `formatNumber(n)` themselves.
 */
export type MessageParams = Record<string, string | number>;

export type TranslateFn = (key: MessageKey, params?: MessageParams) => string;

export interface LanguageOption {
  code: Lang;
  /** English name, used in English UI and in code. */
  label: string;
  /** Endonym shown in the picker, e.g. `فارسی`. */
  nativeLabel: string;
  rtl?: boolean;
}
