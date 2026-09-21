import { writable, derived } from 'svelte/store';

export interface Preferences {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  animations: boolean;
  graphics: 'ultra' | 'high' | 'medium' | 'performance';
  autoMuck: boolean;
  fourColor: boolean;
  betSlider: boolean;
  autoPostBlinds: boolean;
}

const DEFAULTS: Preferences = {
  sound: true,
  music: false,
  haptics: true,
  animations: true,
  graphics: 'high',
  autoMuck: true,
  fourColor: false,
  betSlider: true,
  autoPostBlinds: true,
};

function load(): Preferences {
  if (typeof localStorage === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem('preferences');
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

const { subscribe, set, update } = writable<Preferences>(load());

// Persist to localStorage on every change
if (typeof localStorage !== 'undefined') {
  subscribe((p) => {
    try {
      localStorage.setItem('preferences', JSON.stringify(p));
    } catch {}
  });
}

export const preferences = {
  subscribe,
  set,
  update,
  setKey<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    update((p) => ({ ...p, [key]: value }));
  },
  reset() {
    set(DEFAULTS);
  },
};

// Helper derives
export const animationsEnabled = derived(preferences, ($p) => $p.animations);
export const musicEnabled = derived(preferences, ($p) => $p.music);
export const fourColorEnabled = derived(preferences, ($p) => $p.fourColor);