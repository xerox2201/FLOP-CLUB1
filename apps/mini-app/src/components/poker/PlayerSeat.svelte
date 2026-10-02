<script lang="ts">
  import Icon from '../Icon.svelte';
  import Avatar from '../Avatar.svelte';
  import PlayingCard from '../PlayingCard.svelte';
  import TimerRing from '../TimerRing.svelte';
  import { fmtAmount } from '../../lib/table-geometry';

  export let player: any = {};
  export let isHero: boolean = false;
  export let isDealer: boolean = false;
  export let isTurn: boolean = false;
  export let isWinner: boolean = false;
  export let isShowdown: boolean = false;
  export let isShowdownWin: boolean = false;
  export let isShowdownLose: boolean = false;
  export let handName: string = '';
  export let payout: number = 0;
  export let holeCards: any[] = [];
  export let heroAvatarId: string = 'king';
  export let turnStartedAt: number = 0;
  export let turnBaseLimit: number = 30;
  export let serverTime: number = Date.now();
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let cardsAbove: boolean = true;
  export let panelSide: 'left' | 'right' = 'right';
  export let onClick: () => void = () => {};

  const SIZES = {
    sm: { avatar: 26, panelW: 68, nameFont: 8, stackFont: 9, cardW: 16, timerExtra: 6 },
    md: { avatar: 32, panelW: 76, nameFont: 9, stackFont: 10, cardW: 18, timerExtra: 8 },
    lg: { avatar: 40, panelW: 86, nameFont: 10, stackFont: 12, cardW: 22, timerExtra: 10 },
    xl: { avatar: 52, panelW: 104, nameFont: 11, stackFont: 13, cardW: 26, timerExtra: 12 },
  };
  $: Z = SIZES[size];

  function fmt(n: any): string {
    return fmtAmount(Number(n || 0));
  }
  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  $: showFace = isShowdown || isHero;
  $: hasCards = holeCards.length > 0;
  $: faceDown = hasCards && !showFace;
  $: displayCards = hasCards ? holeCards : [];
</script>

<button
  class="player-seat"
  dir="ltr"
  on:click={onClick}
  aria-label={player.displayName || 'Player'}
  type="button"
>
  <!-- CARDS ABOVE -->
  {#if cardsAbove && displayCards.length > 0}
    <div class="cards-abs cards-above">
      {#each displayCards as c, i}
        <div style="margin-left: {i > 0 ? -6 : 0}px; z-index: {i};">
          <PlayingCard rank={c.r} suit={suitChar(c.s)} size="xs" {faceDown} dim={player.folded} />
        </div>
      {/each}
    </div>
  {/if}

  <!-- AVATAR + PANEL -->
  <div class="avatar-panel-row" class:flip={panelSide === 'left'}>
    <!-- Avatar -->
    <div class="avatar-wrap" style="width: {Z.avatar}px; height: {Z.avatar}px;">
      {#if isTurn}
        <div class="timer-ring-abs seat-active-gold">
          <TimerRing
            size={Z.avatar + Z.timerExtra}
            strokeWidth={2.5}
            startedAt={turnStartedAt}
            limitSec={turnBaseLimit}
            {serverTime}
            active={true}
            color="#22d3ee"
          />
        </div>
      {/if}

      <div
        class="avatar-ring {isWinner ? 'winner-glow' : ''}"
        style="
          background: linear-gradient(180deg,
            {isWinner ? '#f4e5a8' : isTurn ? '#22d3ee' : '#1e3a8a'} 0%,
            {isWinner ? '#d4af37' : isTurn ? '#0891b2' : '#0f1f3a'} 50%,
            {isWinner ? '#a87a15' : isTurn ? '#083344' : '#05080f'} 100%);
          {player.folded ? 'opacity: 0.4; filter: grayscale(0.75);' : ''}
          {player.allIn && !player.folded
          ? 'animation: allin-shake 0.6s ease-in-out infinite;'
          : ''}
        "
      >
        <div class="avatar-inner" style="width: {Z.avatar - 4}px; height: {Z.avatar - 4}px;">
          <Avatar avatarId={isHero ? heroAvatarId : player.avatarId || 'king'} size="sm" />
        </div>
      </div>

      {#if isDealer}
        <div
          class="dealer-btn"
          style="
            width: {Math.max(14, Z.avatar * 0.45)}px;
            height: {Math.max(14, Z.avatar * 0.45)}px;
            font-size: {Math.max(7, Z.avatar * 0.3)}px;
          "
        >
          D
        </div>
      {/if}
    </div>

    <!-- Panel -->
    <div
      class="panel"
      style="
        min-width: {Z.panelW}px;
        max-width: {Z.panelW + 20}px;
        border-color: {isShowdownWin
        ? '#10b981'
        : isShowdownLose
          ? '#6b7280'
          : isWinner
            ? '#d4af37'
            : 'rgba(255,255,255,0.25)'};
        {isShowdownWin
        ? 'box-shadow: 0 0 8px rgba(16,185,129,0.5), 0 2px 8px rgba(0,0,0,0.8);'
        : ''}
      "
    >
      <p class="name" style="font-size: {Z.nameFont}px;">
        {isHero ? 'You' : player.displayName || 'Player'}
      </p>
      <p class="stack" style="font-size: {Z.stackFont}px;">
        ${fmt(player.stack)}
      </p>
      {#if isHero && player.bestHandName && !player.folded}
        <div class="hand-strength-hero">{player.bestHandName}</div>
      {/if}
    </div>
  </div>

  <!-- CARDS BELOW -->
  {#if !cardsAbove && displayCards.length > 0}
    <div class="cards-abs cards-below">
      {#each displayCards as c, i}
        <div style="margin-left: {i > 0 ? -6 : 0}px; z-index: {i};">
          <PlayingCard rank={c.r} suit={suitChar(c.s)} size="xs" {faceDown} dim={player.folded} />
        </div>
      {/each}
    </div>
  {/if}

  <!-- ACTION / RESULT -->
  {#if isShowdown}
    <div class="pill pill-win" class:lose={isShowdownLose}>
      {#if isShowdownWin}
        <Icon name="check" size={12} color="#34d399" /> WIN
      {:else}
        <Icon name="close" size={12} color="#f87171" /> LOSE
      {/if}
    </div>
    {#if handName}
      <div class="pill pill-hand">{handName}</div>
    {/if}
    {#if payout > 0}
      <div class="pill pill-payout">+${fmt(payout)}</div>
    {/if}
  {:else if player.folded}
    <div class="pill pill-fold">FOLD</div>
  {:else if player.allIn && !player.folded}
    <div class="pill pill-allin">ALL-IN</div>
  {/if}
</button>

<style>
  .player-seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    user-select: none;
    pointer-events: auto;
  }

  .avatar-panel-row {
    display: flex;
    align-items: center;
  }
  .avatar-panel-row.flip {
    flex-direction: row-reverse;
  }

  .avatar-wrap {
    position: relative;
    flex-shrink: 0;
    z-index: 2;
    transform: scale(1.08);
    transform-origin: center;
  }

  .timer-ring-abs {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 1;
  }

  .avatar-ring {
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    position: relative;
    z-index: 2;
  }

  .avatar-inner {
    border-radius: 9999px;
    overflow: hidden;
    background: radial-gradient(circle, #1a3a5c, #05080f);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dealer-btn {
    position: absolute;
    bottom: -2px;
    right: -2px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
    color: #0a0800;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
    z-index: 3;
  }

  .panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    margin-left: -8px;
    padding: 2px 6px 2px 12px;
    border-radius: 6px;
    background: linear-gradient(180deg, rgba(8, 20, 40, 0.96), rgba(5, 12, 25, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.8),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    z-index: 1;
  }
  .avatar-panel-row.flip .panel {
    margin-left: 0;
    margin-right: -8px;
    padding: 2px 12px 2px 6px;
    align-items: flex-end;
  }

  .name {
    font-weight: 800;
    color: #ffffff;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .stack {
    font-weight: 700;
    color: #f4c95d;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
  }

  /* Phase 8: live hand strength — HERO ONLY. Opponents must never see it.
     8px + a 2-line clamp so long names ("FULL HOUSE, FOURS OVER QUEENS") stay
     readable instead of collapsing to "PAIR OF QU…". */
  .hand-strength-hero {
    font-size: 8px;
    font-weight: 700;
    color: rgba(212, 175, 55, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    line-height: 1.15;
    margin-top: 2px;
    max-width: 100%;
    text-align: center;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
  }

  .cards-abs {
    display: flex;
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.85));
    pointer-events: none;
  }
  .cards-above {
    margin-bottom: 2px;
  }
  .cards-below {
    margin-top: 2px;
  }

  .pill {
    padding: 1px 7px;
    border-radius: 9999px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.05em;
    line-height: 1;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
    margin-top: 1px;
  }
  .pill-win {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
  }
  .pill-win.lose {
    background: linear-gradient(135deg, #ef4444, #991b1b);
  }
  .pill-hand {
    background: rgba(0, 0, 0, 0.85);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: 7px;
  }
  .pill-fold {
    background: rgba(107, 114, 128, 0.9);
    color: rgba(255, 255, 255, 0.85);
  }
  .pill-allin {
    background: linear-gradient(135deg, #ef4444, #991b1b);
    color: #ffffff;
    animation: allin-pulse 1s ease-in-out infinite;
  }
  .pill-payout {
    background: rgba(0, 0, 0, 0.9);
    color: #6ee7b7;
    font-variant-numeric: tabular-nums;
  }

  @keyframes winner-glow {
    0%,
    100% {
      filter: drop-shadow(0 0 6px rgba(244, 201, 93, 0.8));
    }
    50% {
      filter: drop-shadow(0 0 16px rgba(244, 201, 93, 1));
    }
  }
  .winner-glow {
    animation: winner-glow 1.4s ease-in-out infinite;
  }

  /* VIP frame: rotating gold conic ring behind the winner's avatar.
     .avatar-ring is position:relative with z-index:2, so this negative-z
     pseudo paints above the ring's background and below the avatar image,
     leaving the 4px overflow visible as a halo. */
  .winner-glow::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: conic-gradient(
      from 45deg,
      rgba(212, 175, 55, 0.9) 0deg,
      rgba(232, 196, 90, 1) 90deg,
      rgba(212, 175, 55, 0.9) 180deg,
      rgba(232, 196, 90, 1) 270deg,
      rgba(212, 175, 55, 0.9) 360deg
    );
    z-index: -1;
    animation: vip-spin 4s linear infinite;
    pointer-events: none;
  }

  @keyframes vip-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes allin-shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-1.5px);
    }
    75% {
      transform: translateX(1.5px);
    }
  }
  @keyframes allin-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }
</style>
