export type CardTheme = 'classic' | '4color' | 'clean' | 'luxury' | 'neon';

export interface CardThemeMeta {
  id: CardTheme;
  name: string;
  nameFa: string;
  desc: string;
  path: string;
  backPath: string;
  previewColors: string[];
  filter?: string;
  /** Optional CSS box-shadow / background override */
  cardBg?: string;
  /** If true, apply filter only to red suits (for 4-color hack) */
  tintRed?: string;
  tintBlack?: string;
}

export const CARD_THEMES: CardThemeMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    nameFa: 'کلاسیک',
    desc: 'Original Vector Playing Cards',
    path: '/cards/{suit}_{rank}.png',
    backPath: '/cards/back.png',
    previewColors: ['#c8102e', '#1a1a1a', '#d4af37'],
    filter: 'none',
  },
  {
    id: '4color',
    name: '4-Color',
    nameFa: 'چهاررنگ',
    desc: 'Diamonds blue, Clubs green',
    path: '/cards/{suit}_{rank}.png',
    backPath: '/cards/back.png',
    previewColors: ['#3b82f6', '#10b981', '#c8102e', '#1a1a1a'],
    filter: 'hue-rotate(190deg) saturate(2.2) contrast(1.1)',
  },
  {
    id: 'clean',
    name: 'Clean',
    nameFa: 'مینیمال',
    desc: 'Bright, no filter — just cleaner look',
    path: '/cards/{suit}_{rank}.png',
    backPath: '/cards/back.png',
    previewColors: ['#ffffff', '#1a1a1a', '#e5e5e5'],
    filter: 'saturate(0.4) brightness(1.12) contrast(0.92)',
  },
  {
    id: 'luxury',
    name: 'Luxury Gold',
    nameFa: 'لوکس طلایی',
    desc: 'Warm gold-tinted premium',
    path: '/cards/{suit}_{rank}.png',
    backPath: '/cards/back.png',
    previewColors: ['#d4af37', '#a87a15', '#1a1a1a'],
    filter: 'sepia(0.65) saturate(2.2) brightness(1.05) contrast(1.05) hue-rotate(-15deg)',
  },
  {
    id: 'neon',
    name: 'Neon',
    nameFa: 'نئون',
    desc: 'Cyberpunk glow',
    path: '/cards/{suit}_{rank}.png',
    backPath: '/cards/back.png',
    previewColors: ['#22d3ee', '#f0abfc', '#a3e635'],
    filter: 'invert(0.85) hue-rotate(140deg) saturate(3) contrast(1.3) brightness(1.1)',
  },
];

export function getTheme(id: string | null | undefined): CardThemeMeta {
  return CARD_THEMES.find((t) => t.id === id) ?? CARD_THEMES[0];
}