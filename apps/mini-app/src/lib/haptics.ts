// ============================================================
// Haptics Manager (Telegram WebApp + navigator.vibrate fallback)
// ============================================================

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotif = 'success' | 'warning' | 'error';

import { preferences } from './preferences';

let enabled = true;

preferences.subscribe((p) => {
  enabled = p.haptics;
});

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

export function isHapticsEnabled() {
  return enabled;
}

function tg() {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.Telegram?.WebApp?.HapticFeedback ?? null;
}

export const haptic = {
  light() {
    if (!enabled) return;
    const h = tg();
    if (h) {
      try { h.impactOccurred('light'); return; } catch {}
    }
    try { navigator.vibrate?.(8); } catch {}
  },

  medium() {
    if (!enabled) return;
    const h = tg();
    if (h) {
      try { h.impactOccurred('medium'); return; } catch {}
    }
    try { navigator.vibrate?.(18); } catch {}
  },

  heavy() {
    if (!enabled) return;
    const h = tg();
    if (h) {
      try { h.impactOccurred('heavy'); return; } catch {}
    }
    try { navigator.vibrate?.(35); } catch {}
  },

  success() {
    if (!enabled) return;
    const h = tg();
    if (h) {
      try { h.notificationOccurred('success'); return; } catch {}
    }
    try { navigator.vibrate?.([15, 40, 15]); } catch {}
  },

  warning() {
    if (!enabled) return;
    const h = tg();
    if (h) {
      try { h.notificationOccurred('warning'); return; } catch {}
    }
    try { navigator.vibrate?.([25, 50, 25]); } catch {}
  },

  error() {
    if (!enabled) return;
    const h = tg();
    if (h) {
      try { h.notificationOccurred('error'); return; } catch {}
    }
    try { navigator.vibrate?.([60, 40, 60, 40, 60]); } catch {}
  },
};