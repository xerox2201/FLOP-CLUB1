<script lang="ts">
  import { cardTheme, CARD_THEMES } from '../stores/cardTheme';

  export let rank: string = 'A';
  export let suit: '♠' | '♥' | '♦' | '♣' = '♠';
  export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let rotation: number = 0;
  export let faceDown: boolean = false;
  export let selected: boolean = false;
  export let dim: boolean = false;
  export let themeOverride: string | null = null;

  const sizes = {
    xs: { w: 26, h: 36 },
    sm: { w: 34, h: 48 },
    md: { w: 50, h: 70 },
    lg: { w: 64, h: 90 },
    xl: { w: 82, h: 115 },
  };
  $: s = sizes[size];

  const RANK_MAP: Record<string, string> = {
    A: '1', K: 'king', Q: 'queen', J: 'jack',
    T: '10', '10': '10',
    '9': '9', '8': '8', '7': '7', '6': '6',
    '5': '5', '4': '4', '3': '3', '2': '2',
  };
  const SUIT_MAP: Record<string, string> = {
    '♠': 'spade', '♥': 'heart', '♦': 'diamond', '♣': 'club',
  };

  $: rankFile = RANK_MAP[rank.toUpperCase()] ?? '1';
  $: suitFile = SUIT_MAP[suit] ?? 'spade';
  $: activeThemeId = themeOverride ?? $cardTheme;
  $: theme = CARD_THEMES.find((t) => t.id === activeThemeId) ?? CARD_THEMES[0];
  $: cardSrc = theme.path.replace('{suit}', suitFile).replace('{rank}', rankFile);

  // Card back based on theme
  $: backSrc =
    activeThemeId === 'luxury' ? '/card-back-classic.png' :
    activeThemeId === 'neon' ? '/card-back-dark.png' :
    '/card-back-royal.png';

  $: cssFilter = theme.filter && theme.filter !== 'none' ? theme.filter : 'none';
</script>

<div
  class="relative select-none"
  style="
    width: {s.w}px;
    height: {s.h}px;
    border-radius: {Math.max(3, s.w * 0.09)}px;
    transform: rotate({rotation}deg) {selected ? 'translateY(-6px) scale(1.05)' : ''};
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
    overflow: hidden;
    box-shadow:
      0 4px 10px rgba(0,0,0,0.6),
      0 0 0 0.5px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.15);
    background: #fff;
    {dim ? 'filter: brightness(0.55) saturate(0.5);' : ''}
    {selected ? 'box-shadow: 0 8px 20px rgba(212,175,55,0.8), 0 0 0 1.5px rgba(212,175,55,0.9); z-index: 50;' : ''}
  "
>
  {#if faceDown}
    <img
      src={backSrc}
      alt="card back"
      class="w-full h-full select-none pointer-events-none"
      style="object-fit: cover;"
      draggable="false"
    />
  {:else}
    <img
      src={cardSrc}
      alt="{rank}{suit}"
      class="w-full h-full select-none pointer-events-none"
      style="object-fit: cover; filter: {cssFilter};"
      draggable="false"
      on:error={() => console.warn('[PlayingCard] 404:', cardSrc)}
    />
  {/if}
</div>