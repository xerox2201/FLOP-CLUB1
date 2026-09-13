export interface Avatar {
  id: string;
  emoji: string;
  gradient: string;
}

export const AVATARS: Avatar[] = [
  { id: 'spade',   emoji: '♠️', gradient: 'from-slate-700 to-slate-900' },
  { id: 'heart',   emoji: '♥️', gradient: 'from-red-700 to-red-950' },
  { id: 'diamond', emoji: '♦️', gradient: 'from-rose-600 to-red-900' },
  { id: 'club',    emoji: '♣️', gradient: 'from-emerald-700 to-emerald-950' },
  { id: 'crown',   emoji: '👑', gradient: 'from-yellow-500 to-amber-800' },
  { id: 'lion',    emoji: '🦁', gradient: 'from-orange-500 to-amber-900' },
  { id: 'shark',   emoji: '🦈', gradient: 'from-blue-600 to-cyan-900' },
  { id: 'eagle',   emoji: '🦅', gradient: 'from-indigo-600 to-purple-900' },
  { id: 'dragon',  emoji: '🐉', gradient: 'from-green-600 to-emerald-900' },
  { id: 'wolf',    emoji: '🐺', gradient: 'from-gray-600 to-slate-900' },
  { id: 'fox',     emoji: '🦊', gradient: 'from-orange-500 to-red-800' },
  { id: 'panda',   emoji: '🐼', gradient: 'from-neutral-500 to-neutral-900' },
  { id: 'rocket',  emoji: '🚀', gradient: 'from-purple-600 to-indigo-900' },
  { id: 'ghost',   emoji: '👻', gradient: 'from-cyan-400 to-blue-800' },
  { id: 'alien',   emoji: '👽', gradient: 'from-lime-500 to-green-900' },
  { id: 'ninja',   emoji: '🥷', gradient: 'from-zinc-700 to-black' },
];

export function getAvatar(id?: string): Avatar {
  return AVATARS.find(a => a.id === id) ?? AVATARS[0];
}