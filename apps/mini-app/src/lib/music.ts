import { preferences } from './preferences';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let oscillators: OscillatorNode[] = [];
let playing = false;

function ensureContext() {
  if (ctx) return;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const newCtx: AudioContext = new AC();
  const newGain = newCtx.createGain();
  newGain.gain.value = 0;
  newGain.connect(newCtx.destination);
  ctx = newCtx;
  masterGain = newGain;
}

// Ambient pad: 3 sine waves in minor chord
const FREQS = [110, 164.81, 220]; // A2, E3, A3

function start() {
  ensureContext();
  if (!ctx || !masterGain) return;

  // Resume if suspended
  if (ctx.state === 'suspended') ctx.resume();

  // Cleanup
  stopOscillators();

  oscillators = FREQS.map((f, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    // Slow detune LFO for warmth
    osc.detune.value = (i - 1) * 4;
    gain.gain.value = 0.08 / FREQS.length;
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start();
    return osc;
  });

  // Fade in
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 2);

  playing = true;
}

function stopOscillators() {
  for (const osc of oscillators) {
    try { osc.stop(); osc.disconnect(); } catch {}
  }
  oscillators = [];
}

function stop() {
  if (!ctx || !masterGain) return;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  setTimeout(() => {
    stopOscillators();
    playing = false;
  }, 1200);
}

// Sync with preferences
preferences.subscribe((p) => {
  if (p.music && !playing) {
    // Only start after user interaction (browser autoplay policy)
    const resume = () => {
      if (!playing) start();
      window.removeEventListener('click', resume);
      window.removeEventListener('touchstart', resume);
    };
    window.addEventListener('click', resume, { once: true });
    window.addEventListener('touchstart', resume, { once: true });
  } else if (!p.music && playing) {
    stop();
  }
});

export function initMusic() {
  // No-op — trigger via preferences
}

export function isMusicPlaying() {
  return playing;
}