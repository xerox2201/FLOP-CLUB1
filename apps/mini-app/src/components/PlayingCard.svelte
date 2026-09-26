<script lang="ts">
  import { onMount } from 'svelte';
  import { cardTheme, CARD_THEMES } from '../stores/cardTheme';
  import { preferences } from '../lib/preferences';

  export let rank: string = 'A';
  export let suit: '♠' | '♥' | '♦' | '♣' = '♠';
  export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let rotation: number = 0;
  export let faceDown: boolean = false;
  export let selected: boolean = false;
  export let dim: boolean = false;
  export let themeOverride: string | null = null;

  // Animation props
  export let dealFrom: 'none' | 'top-left' | 'top-right' | 'top' = 'none';
  export let dealDelay: number = 0;
  export let folding: boolean = false;

  const sizes = {
    xs: { w: 26, h: 36 },
    sm: { w: 34, h: 48 },
    md: { w: 50, h: 70 },
    lg: { w: 64, h: 90 },
    xl: { w: 82, h: 115 },
  };
  $: s = sizes[size];
  $: radius = Math.max(3, s.w * 0.09);

  const RANK_MAP: Record<string, string> = {
    A: '1',
    K: 'king',
    Q: 'queen',
    J: 'jack',
    T: '10',
    '10': '10',
    '9': '9',
    '8': '8',
    '7': '7',
    '6': '6',
    '5': '5',
    '4': '4',
    '3': '3',
    '2': '2',
  };
  const SUIT_MAP: Record<string, string> = {
    '♠': 'spade',
    '♥': 'heart',
    '♦': 'diamond',
    '♣': 'club',
  };

  $: rankFile = RANK_MAP[rank.toUpperCase()] ?? '1';
  $: suitFile = SUIT_MAP[suit] ?? 'spade';
  $: activeThemeId = themeOverride ?? $cardTheme;
  $: theme = CARD_THEMES.find((t) => t.id === activeThemeId) ?? CARD_THEMES[0];
  $: cardSrc = theme.path.replace('{suit}', suitFile).replace('{rank}', rankFile);

  $: backSrc =
    activeThemeId === 'luxury'
      ? '/card-back-classic.webp'
      : activeThemeId === 'neon'
        ? '/card-back-dark.webp'
        : '/card-back-royal.webp';

  $: cssFilter = theme.filter && theme.filter !== 'none' ? theme.filter : 'none';
  $: frontFilter = dim ? 'brightness(0.55) saturate(0.5)' : cssFilter;

  // ---- Deal animation (once on mount) ----
  let playDeal = false;
  onMount(() => {
    if (dealFrom !== 'none') {
      playDeal = true;
      const totalMs = (dealDelay + 0.7) * 1000;
      const t = setTimeout(() => {
        playDeal = false;
      }, totalMs);
      return () => clearTimeout(t);
    }
  });

  $: dealClass = playDeal ? 'deal-in' : '';
  $: foldClass = folding ? 'fold-out' : '';
  $: dealVars =
    dealFrom === 'top-left'
      ? '--dx: -50vw; --dy: -40vh;'
      : dealFrom === 'top-right'
        ? '--dx: 50vw; --dy: -40vh;'
        : dealFrom === 'top'
          ? '--dx: 0vw; --dy: -40vh;'
          : '';
</script>

<div
  class="card-outer"
  style="
    width: {s.w}px;
    height: {s.h}px;
    transform: rotate({rotation}deg);
    {dealVars}
  "
>
  <div
    class="card-anim {dealClass} {foldClass}"
    style="
      animation-delay: {dealDelay}s;
      {$preferences.animations ? '' : 'animation-name: none !important;'}
    "
  >
    <div
      class="card-inner"
      style="
        transform: {selected ? 'translateY(-6px) scale(1.05)' : ''} rotateY({faceDown
        ? 180
        : 0}deg);
      "
    >
      <!-- FRONT (actual card face) — flipped 180 so it appears when faceDown=true turns to 180 -->
      <img
        src={cardSrc}
        alt="{rank}{suit}"
        class="card-face card-front"
        style="
          border-radius: {radius}px;
          filter: {frontFilter} {$preferences.fourColor && suit === '♦'
          ? 'hue-rotate(160deg) saturate(2.5)'
          : ''} {$preferences.fourColor && suit === '♣' ? 'hue-rotate(80deg) saturate(2)' : ''};
        "
        draggable="false"
        on:error={() => console.warn('[PlayingCard] 404:', cardSrc)}
      />
      <!-- BACK (card back) -->
      <img
        src={backSrc}
        alt=""
        class="card-face card-back"
        style="border-radius: {radius}px;"
        draggable="false"
      />
    </div>
  </div>
</div>

<style>
  .card-outer {
    position: relative;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform;
  }

  .card-anim {
    width: 100%;
    height: 100%;
    perspective: 800px;
    will-change: transform, opacity;
  }

  .card-inner {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-face {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    object-fit: cover;
    box-shadow:
      0 4px 10px rgba(0, 0, 0, 0.6),
      0 0 0 0.5px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    pointer-events: none;
  }

  .card-front {
    transform: rotateY(0deg);
  }

  .card-back {
    transform: rotateY(180deg);
  }

  /* ===== DEAL IN ===== */
  @keyframes card-deal-in {
    0% {
      opacity: 0;
      transform: translate(var(--dx, 0), var(--dy, 0)) rotate(-90deg) scale(0.5);
    }
    55% {
      opacity: 1;
    }
    100% {
      opacity: 1;
      transform: translate(0, 0) rotate(0) scale(1);
    }
  }
  .deal-in {
    animation: card-deal-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* ===== FOLD OUT ===== */
  @keyframes card-fold-out {
    0% {
      opacity: 1;
      transform: translate(0, 0) scale(1) rotate(0);
    }
    100% {
      opacity: 0;
      transform: translate(0, -30px) scale(0.6) rotate(-25deg);
    }
  }
  .fold-out {
    animation: card-fold-out 0.4s ease-in both;
    pointer-events: none;
  }
</style>
