// ============================================================
// Sound Effects Manager
// ============================================================

type SoundName = 'chip' | 'deal' | 'card-flip' | 'win' | 'lose' | 'button' | 'check';

const SOUND_FILES: Record<SoundName, string> = {
  chip: '/sounds/chip.wav',
  deal: '/sounds/deal.wav',
  'card-flip': '/sounds/card-flip.wav',
  win: '/sounds/win.wav',
  lose: '/sounds/lose.wav',
  button: '/sounds/button.wav',
  check: '/sounds/check.wav',
};

const cache: Partial<Record<SoundName, HTMLAudioElement>> = {};

let enabled = true;
let masterVolume = 0.6;

// Load from localStorage
if (typeof localStorage !== 'undefined') {
  try {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    enabled = settings.sound !== false;
  } catch {}
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

export function isSoundEnabled() {
  return enabled;
}

export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v));
}

export function playSound(name: SoundName, volume?: number) {
  if (!enabled) return;
  if (typeof window === 'undefined') return;

  try {
    let audio = cache[name];
    if (!audio) {
      audio = new Audio(SOUND_FILES[name]);
      audio.preload = 'auto';
      cache[name] = audio;
    }

    // Clone for overlapping plays
    const instance = audio.cloneNode() as HTMLAudioElement;
    instance.volume = Math.max(0, Math.min(1, volume ?? masterVolume));
    instance.play().catch(() => {
      // Browser autoplay blocked — ignore
    });
  } catch {}
}

export function preloadAllSounds() {
  if (typeof window === 'undefined') return;
  (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => {
    try {
      const audio = new Audio(SOUND_FILES[name]);
      audio.preload = 'auto';
      cache[name] = audio;
    } catch {}
  });
}