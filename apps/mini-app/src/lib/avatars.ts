export interface Avatar {
  id: string;
  emoji: string;
  gradient: string;
}

export const AVATARS: Avatar[] = [
  { id: 'king',    emoji: '👑', gradient: 'from-yellow-500 to-amber-800' },
  { id: 'queen',   emoji: '👸', gradient: 'from-rose-500 to-pink-900' },
  { id: 'shark',   emoji: '🦈', gradient: 'from-blue-600 to-cyan-900' },
  { id: 'fox',     emoji: '🦊', gradient: 'from-orange-500 to-red-800' },
  { id: 'wolf',    emoji: '🐺', gradient: 'from-gray-600 to-slate-900' },
  { id: 'lion',    emoji: '🦁', gradient: 'from-orange-500 to-amber-900' },
  { id: 'dragon',  emoji: '🐉', gradient: 'from-green-600 to-emerald-900' },
  { id: 'eagle',   emoji: '🦅', gradient: 'from-indigo-600 to-purple-900' },
  { id: 'cat',     emoji: '🐱', gradient: 'from-pink-500 to-rose-900' },
  { id: 'ghost',   emoji: '👻', gradient: 'from-cyan-400 to-blue-800' },
  { id: 'pirate',  emoji: '🏴‍☠️', gradient: 'from-red-700 to-red-950' },
  { id: 'wizard',  emoji: '🧙', gradient: 'from-violet-600 to-indigo-900' },
  { id: 'samurai', emoji: '🥷', gradient: 'from-zinc-700 to-black' },
  { id: 'sphinx',  emoji: '🏛️', gradient: 'from-amber-500 to-yellow-900' },
  { id: 'vampire', emoji: '🧛', gradient: 'from-red-600 to-slate-900' },
  { id: 'angel',   emoji: '😇', gradient: 'from-yellow-200 to-amber-600' },
];

export function getAvatar(id?: string): Avatar {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}