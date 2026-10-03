import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  LANGUAGES,
  catalogLeaves,
  detectLang,
  dir,
  fmt,
  formatNumber,
  isRtl,
  lang,
  loadLanguage,
  localeTag,
  lookup,
  normalizeLang,
  t,
  translate,
  type Dict,
  type Lang,
  type MessageKey,
} from '../index';
import en from '../catalog/en';
import fa from '../catalog/fa';
import ar from '../catalog/ar';
import tr from '../catalog/tr';
import ru from '../catalog/ru';
import zh from '../catalog/zh';
import baseline from './parity-baseline.json';

const CATALOGS: Record<Lang, Dict> = {
  en: en as Dict,
  fa: fa as Dict,
  ar: ar as Dict,
  tr: tr as Dict,
  ru: ru as Dict,
  zh: zh as Dict,
};

const NON_EN: Lang[] = ['fa', 'ar', 'tr', 'ru', 'zh'];
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** CLDR plural categories the language actually selects. */
function categoriesUsed(l: Lang): Set<string> {
  const rules = new Intl.PluralRules(localeTag(l));
  const used = new Set<string>();
  for (let n = 0; n <= 200; n++) used.add(rules.select(n));
  for (const n of [1.5, 2.5]) used.add(rules.select(n));
  return used;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

beforeEach(async () => {
  localStorage.clear();
  delete (window as any).Telegram;
  await loadLanguage('en');
});

describe('catalog parity', () => {
  it('has an English key for every localized key', () => {
    const enKeys = new Set(catalogLeaves(CATALOGS.en));
    // Stems that carry plural variants in English, e.g. `common.players`.
    const enPluralStems = new Set(
      [...enKeys]
        .filter((key) => PLURAL_SUFFIX.test(key))
        .map((key) => key.replace(PLURAL_SUFFIX, '')),
    );
    for (const l of NON_EN) {
      const orphans = catalogLeaves(CATALOGS[l]).filter((key) => {
        if (enKeys.has(key)) return false;
        // A locale may carry plural categories English does not use (ar `_few`).
        return !enPluralStems.has(key.replace(PLURAL_SUFFIX, ''));
      });
      expect(orphans, `${l} has keys missing from en`).toEqual([]);
    }
  });

  it('matches the frozen missing-key baseline', () => {
    const enKeys = new Set(catalogLeaves(CATALOGS.en));
    for (const l of NON_EN) {
      const present = new Set(catalogLeaves(CATALOGS[l]));
      const used = categoriesUsed(l);
      const missing = [...enKeys]
        .filter((key) => !present.has(key))
        .filter((key) => {
          const match = PLURAL_SUFFIX.exec(key);
          return !match || used.has(match[1]);
        })
        .sort();
      expect(missing, `${l} catalog gap changed`).toEqual(baseline[l as keyof typeof baseline]);
    }
  });

  it('keeps placeholders identical to English', () => {
    // `zero`/`one`/`two` plural forms may legitimately spell the number out
    // ("لاعب واحد") instead of interpolating it.
    const numberFreePlural = /_(zero|one|two)$/;
    for (const l of NON_EN) {
      for (const key of catalogLeaves(CATALOGS[l])) {
        if (numberFreePlural.test(key)) continue;
        const source = lookup(CATALOGS.en, key);
        if (source === undefined) continue;
        const value = lookup(CATALOGS[l], key) as string;
        expect(placeholders(value), `${l}:${key}`).toEqual(placeholders(source));
      }
    }
  });
});

describe('catalog hygiene', () => {
  it('contains no emoji in code', () => {
    for (const l of LANGUAGES.map((option) => option.code)) {
      for (const key of catalogLeaves(CATALOGS[l])) {
        const value = lookup(CATALOGS[l], key) as string;
        expect(/\p{Extended_Pictographic}/u.test(value), `${l}:${key} -> ${value}`).toBe(false);
      }
    }
  });

  it('keeps Persian typography (ZWNJ, no Arabic yeh/kaf)', () => {
    const values = catalogLeaves(CATALOGS.fa).map((key) => lookup(CATALOGS.fa, key) as string);
    const zwnj = values.reduce((count, value) => count + [...value.matchAll(/\u200C/g)].length, 0);
    expect(zwnj).toBeGreaterThanOrEqual(10);
    for (const value of values) {
      expect(value, `Arabic yeh in ${value}`).not.toMatch(/\u064A/);
      expect(value, `Arabic kaf in ${value}`).not.toMatch(/\u0643/);
    }
  });

  it('exposes language options without emoji flags', () => {
    expect(LANGUAGES.map((option) => option.code)).toEqual(['en', 'fa', 'ar', 'tr', 'ru', 'zh']);
    for (const option of LANGUAGES) {
      expect(option.nativeLabel.length).toBeGreaterThan(0);
      expect(/\p{Extended_Pictographic}/u.test(option.label)).toBe(false);
    }
    expect(LANGUAGES.filter((option) => option.rtl).map((option) => option.code)).toEqual([
      'fa',
      'ar',
    ]);
  });
});

describe('translation', () => {
  it('returns English and falls back to it for a catalog gap', () => {
    const dict = get(t);
    expect(dict('nav.home')).toBe('Home');
    // tournaments.players is still part of the fa baseline gap set
    expect(dict('tournaments.players')).toBe('Players');
  });

  it('interpolates params', () => {
    const dict = get(t);
    expect(dict('tournaments.inMinutes', { n: 5 })).toBe('in 5m');
    expect(dict('tournaments.inHours', { h: 1, m: 30 })).toBe('in 1h 30m');
  });

  it('never formats numbers itself', () => {
    const dict = get(t);
    expect(dict('tournaments.inMinutes', { n: 1234 })).toBe('in 1234m');
  });

  it('selects plural forms', async () => {
    await loadLanguage('en');
    expect(get(t)('common.players', { n: 1 })).toBe('1 player');
    expect(get(t)('common.players', { n: 4 })).toBe('4 players');

    await loadLanguage('ru');
    expect(get(t)('common.players', { n: 1 })).toBe('1 игрок');
    expect(get(t)('common.players', { n: 3 })).toBe('3 игрока');
    expect(get(t)('common.players', { n: 7 })).toBe('7 игроков');

    await loadLanguage('ar');
    expect(get(t)('common.players', { n: 0 })).toBe('لا لاعبين');
    expect(get(t)('common.players', { n: 2 })).toBe('لاعبان');

    await loadLanguage('fa');
    expect(get(t)('common.players', { n: 1 })).toBe('1 بازیکن');
    expect(get(t)('common.players', { n: 6 })).toBe('6 بازیکن');
  });

  it('warns once and returns the key when it is unknown', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dict = get(t);
    expect(dict('missing.key' as MessageKey)).toBe('missing.key');
    expect(dict('missing.key' as MessageKey)).toBe('missing.key');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('warns and keeps the placeholder when a param is absent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(translate(CATALOGS.en, 'en', 'tournaments.inMinutes')).toBe('in {n}m');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('direction', () => {
  it('reports rtl for fa and ar only', () => {
    expect(isRtl('fa')).toBe(true);
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
    expect(isRtl('tr')).toBe(false);
    expect(isRtl('ru')).toBe(false);
    expect(isRtl('zh')).toBe(false);
  });

  it('mirrors the active language onto <html>', async () => {
    await loadLanguage('fa');
    expect(get(dir)).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('fa');
    expect(get(lang)).toBe('fa');

    await loadLanguage('en');
    expect(get(dir)).toBe('ltr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('switches the catalog with the language', async () => {
    await loadLanguage('fa');
    expect(get(t)('nav.home')).toBe('خانه');
    expect(get(t)('nav.tournaments')).toBe('تورنمنت‌ها');
    expect(get(t)('tournaments.title')).toBe('تورنمنت‌ها');
    expect(get(t)('tournaments.noTournaments')).toBe('تورنمنتی نیست');
    await loadLanguage('en');
    expect(get(t)('nav.home')).toBe('Home');
    expect(get(t)('nav.tournaments')).toBe('Tourneys');
  });
});

describe('formatting', () => {
  it('uses locale digits for quantities and latin digits for machine values', async () => {
    await loadLanguage('fa');
    expect(formatNumber(1234, { latin: true })).toBe('1,234');
    expect(formatNumber(1234)).not.toBe('1,234');
    await loadLanguage('en');
    expect(formatNumber(1234, { latin: true })).toBe('1,234');
  });

  it('formats currency per locale', async () => {
    await loadLanguage('en');
    expect(get(fmt).currency(12.5)).toBe('$12.50');
    await loadLanguage('tr');
    expect(get(fmt).currency(12.5)).toContain('12,50');
  });

  it('formats dates per locale', async () => {
    const iso = '2026-03-10T12:00:00Z';
    await loadLanguage('en');
    expect(get(fmt).date(iso, 'short')).toBe('3/10/26');
    await loadLanguage('ru');
    expect(get(fmt).date(iso, 'short')).toMatch(/10\.03\.2026/);
    await loadLanguage('en');
  });
});

describe('detection', () => {
  it('normalizes BCP-47 tags', () => {
    expect(normalizeLang('fa')).toBe('fa');
    expect(normalizeLang('fa-IR')).toBe('fa');
    expect(normalizeLang('zh-Hans')).toBe('zh');
    expect(normalizeLang('RU')).toBe('ru');
    expect(normalizeLang('de-DE')).toBeNull();
    expect(normalizeLang(undefined)).toBeNull();
  });

  it('prefers the stored choice over the Telegram client', () => {
    localStorage.setItem('lang', 'fa');
    (window as any).Telegram = { WebApp: { initDataUnsafe: { user: { language_code: 'ru' } } } };
    expect(detectLang()).toBe('fa');
  });

  it('falls back to the Telegram client language', () => {
    (window as any).Telegram = { WebApp: { initDataUnsafe: { user: { language_code: 'ru-RU' } } } };
    expect(detectLang()).toBe('ru');
  });

  it('falls back to English when nothing matches', () => {
    expect(detectLang()).toBe('en');
  });
});
