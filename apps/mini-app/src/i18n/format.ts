/**
 * Locale-aware formatting.
 *
 * Two accessors:
 * - `fmt` is a store derived from the active language. Use it in templates
 *   (`$fmt.number(x)`) so the value re-renders when the language changes.
 * - `formatNumber` / `formatCurrency` / `formatDate` read the active language at
 *   call time. Use them in scripts, where no store subscription exists.
 *
 * Machine values (seeds, hashes, hand ids, blinds, addresses) must be rendered
 * with `{ latin: true }` plus `dir="ltr"`; see the "never localize" list in
 * P2_I18N_DESIGN.md.
 */

import { derived, get } from 'svelte/store';
import { lang, localeTag } from './state';
import type { Lang } from './types';

export type DateInput = Date | string | number;

export interface NumberOptions {
  /** Force ASCII digits and separators. Required for machine values. */
  latin?: boolean;
  digits?: number;
}

export interface CurrencyOptions extends NumberOptions {
  currency?: string;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

function numbering(opts: NumberOptions): Intl.NumberFormatOptions {
  return opts.latin ? { numberingSystem: 'latn' } : {};
}

function numberFormat(l: Lang, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${localeTag(l)}|${JSON.stringify(opts)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(localeTag(l), opts);
    numberFormats.set(key, format);
  }
  return format;
}

function dateFormat(l: Lang, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${localeTag(l)}|${JSON.stringify(opts)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(localeTag(l), opts);
    dateFormats.set(key, format);
  }
  return format;
}

function relativeFormat(l: Lang, opts: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat {
  const key = `${localeTag(l)}|${JSON.stringify(opts)}`;
  let format = relativeFormats.get(key);
  if (!format) {
    format = new Intl.RelativeTimeFormat(localeTag(l), opts);
    relativeFormats.set(key, format);
  }
  return format;
}

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

export interface Formatters {
  number(value: number, opts?: NumberOptions): string;
  currency(value: number, opts?: CurrencyOptions): string;
  percent(value: number, digits?: number): string;
  compact(value: number, opts?: NumberOptions): string;
  date(input: DateInput, style?: 'short' | 'medium' | 'long'): string;
  time(input: DateInput): string;
  dateTime(input: DateInput, style?: 'short' | 'medium' | 'long'): string;
  relative(input: DateInput, base?: DateInput): string;
}

export function makeFormatters(l: Lang): Formatters {
  return {
    number(value, opts = {}) {
      return numberFormat(l, {
        ...numbering(opts),
        minimumFractionDigits: opts.digits,
        maximumFractionDigits: opts.digits,
      }).format(value);
    },

    currency(value, opts = {}) {
      const options: Intl.NumberFormatOptions = {
        ...numbering(opts),
        style: 'currency',
        currency: opts.currency ?? 'USD',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: opts.digits ?? 2,
        maximumFractionDigits: opts.digits ?? 2,
      };
      return numberFormat(l, options).format(value);
    },

    percent(value, digits = 0) {
      return numberFormat(l, {
        style: 'percent',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    },

    compact(value, opts = {}) {
      return numberFormat(l, {
        ...numbering(opts),
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    },

    date(input, style = 'medium') {
      return dateFormat(l, { dateStyle: style }).format(toDate(input));
    },

    time(input) {
      return dateFormat(l, { timeStyle: 'short' }).format(toDate(input));
    },

    dateTime(input, style = 'medium') {
      return dateFormat(l, { dateStyle: style, timeStyle: 'short' }).format(toDate(input));
    },

    relative(input, base = Date.now()) {
      const diffSeconds = (toDate(input).getTime() - toDate(base).getTime()) / 1000;
      let value = diffSeconds;
      for (const [unit, factor] of RELATIVE_UNITS) {
        if (Math.abs(value) < factor) {
          return relativeFormat(l, { numeric: 'auto' }).format(Math.round(value), unit);
        }
        value /= factor;
      }
      return relativeFormat(l, { numeric: 'auto' }).format(Math.round(value), 'year');
    },
  };
}

/** Reactive formatters for templates. */
export const fmt = derived(lang, makeFormatters);

export function formatNumber(value: number, opts?: NumberOptions): string {
  return makeFormatters(get(lang)).number(value, opts);
}

export function formatCurrency(value: number, opts?: CurrencyOptions): string {
  return makeFormatters(get(lang)).currency(value, opts);
}

export function formatPercent(value: number, digits?: number): string {
  return makeFormatters(get(lang)).percent(value, digits);
}

export function formatDate(input: DateInput, style?: 'short' | 'medium' | 'long'): string {
  return makeFormatters(get(lang)).date(input, style);
}

export function formatTime(input: DateInput): string {
  return makeFormatters(get(lang)).time(input);
}

export function formatDateTime(input: DateInput, style?: 'short' | 'medium' | 'long'): string {
  return makeFormatters(get(lang)).dateTime(input, style);
}

export function formatRelative(input: DateInput, base?: DateInput): string {
  return makeFormatters(get(lang)).relative(input, base);
}
