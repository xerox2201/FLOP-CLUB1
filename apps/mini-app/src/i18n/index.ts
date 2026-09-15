import { derived, writable } from 'svelte/store';
import en from './en';
import fa from './fa';
import ar from './ar';
import tr from './tr';
import ru from './ru';
import zh from './zh';

export type Lang = 'en' | 'fa' | 'ar' | 'tr' | 'ru' | 'zh';

export const LANGUAGES: { code: Lang; label: string; flag: string; rtl?: boolean }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷', rtl: true },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

const dict: Record<Lang, any> = { en, fa, ar, tr, ru, zh };

const stored =
  typeof localStorage !== 'undefined' ? (localStorage.getItem('lang') as Lang | null) : null;

export const lang = writable<Lang>(stored || 'en');

lang.subscribe((l) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('lang', l);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'fa' || l === 'ar' ? 'rtl' : 'ltr';
  }
});

export const t = derived(lang, ($lang) => {
  const d = dict[$lang] || dict.en;
  return (key: string): string => {
    const parts = key.split('.');
    let cur: any = d;
    for (const p of parts) {
      if (cur == null) return key;
      cur = cur[p];
    }
    return cur ?? key;
  };
});

export function setLang(l: Lang) {
  lang.set(l);
}
