<script lang="ts">
  import { onMount } from 'svelte';
  import { preferences } from '../lib/preferences';
  import { chipBreakdown } from '../lib/table-geometry';

  export let amount: number = 0;
  export let size: number = 28;
  export let maxStack: number = 5;

  // Animation props
  export let animate: boolean = true; // pop-in on mount
  export let pulse: boolean = false; // winner highlight
  export let collecting: boolean = false; // fly-away when pot collected

  interface Column {
    key: string;
    row: number;
    col: number;
    count: number;
    visible: number;
    disc: number;
    offset: number;
    height: number;
  }

  /**
   * Chip columns for the amount, from the shared denomination table, plus the
   * geometry of each stack. The height of a column grows with the number of
   * chips it holds, so the visual weight follows the amount.
   *
   * The per-chip offset tapers once a stack is 4 chips tall, and the diameter
   * shrinks only when an amount needs more than 4 denominations. Both keep the
   * footprint at or below what it has always been: on the mobile felt a bet
   * stack sits next to the board and must never grow into the cards.
   */
  $: columns = ((): Column[] => {
    const stacks = chipBreakdown(amount);
    const scale = Math.max(0.7, Math.min(1, 4 / Math.max(1, stacks.length)));
    const disc = size * scale;
    return stacks.map((s): Column => {
      const visible = Math.max(1, Math.min(s.count, maxStack));
      const offset = disc * (visible >= 4 ? 0.13 : 0.16);
      return {
        key: `${s.denom}-${s.col}-${s.row}`,
        row: s.row,
        col: s.col,
        count: s.count,
        visible,
        disc,
        offset,
        height: disc + (visible - 1) * offset,
      };
    });
  })();

  let mounted = false;
  onMount(() => {
    const t = setTimeout(() => (mounted = true), 15);
    return () => clearTimeout(t);
  });

  $: disabled = !$preferences.animations || $preferences.graphics === 'performance';
  $: popClass = animate && !mounted && !disabled ? 'chip-pop-in' : '';
  $: pulseClass = pulse && !disabled ? 'chip-pulse' : '';
  $: collectClass = collecting && !disabled ? 'chip-collect' : '';
</script>

{#if amount > 0}
  <div class="chip-root {popClass} {pulseClass} {collectClass}" style="gap: {size * 0.1}px;">
    {#each columns as c (c.key)}
      <div class="chip-column" style="width: {c.disc}px; height: {c.height}px;">
        {#each Array(c.visible) as _, i}
          <div
            class="chip-disc"
            style="
              width: {c.disc}px;
              height: {c.disc}px;
              bottom: {i * c.offset}px;
              background-position: {(c.col * 100) / 3}% {(c.row * 100) / 2}%;
              filter: drop-shadow(0 {c.disc * 0.08}px {c.disc * 0.13}px rgba(0,0,0,0.75));
              animation-delay: {i * 0.03}s;
            "
          ></div>
        {/each}

        {#if c.count > maxStack}
          <div
            class="chip-count absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 font-extrabold z-10"
            style="font-size: {Math.max(7, c.disc * 0.36)}px;"
          >
            ×{c.count}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .chip-root {
    display: flex;
    align-items: flex-end;
    will-change: transform, opacity, filter;
  }

  .chip-column {
    position: relative;
  }

  /* One chip disc = one cell of the 4 x 3 sprite sheet, masked to a circle so
     the sheet's square cell can never show a corner. The sprite cell already
     prints its denomination, so the circle IS the denomination. */
  .chip-disc {
    position: absolute;
    left: 0;
    border-radius: 50%;
    overflow: hidden;
    background-image: url('/chips-set-hq.webp');
    background-size: 400% 300%;
    background-repeat: no-repeat;
  }

  .chip-disc::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow:
      inset 0 0 0 1px rgba(212, 175, 55, 0.35),
      inset 0 -1px 2px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }

  /* Overflow badge: how many chips of this denomination the stack stands for
     when it is taller than maxStack. */
  .chip-count {
    background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
    color: #0a0800;
    line-height: 1;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 235, 170, 0.5);
  }

  /* ===== POP IN ===== */
  @keyframes chip-pop-in {
    0% {
      opacity: 0;
      transform: translateY(24px) scale(0.4);
    }
    60% {
      opacity: 1;
      transform: translateY(-4px) scale(1.08);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .chip-pop-in {
    animation: chip-pop-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* ===== WINNER PULSE ===== */
  @keyframes chip-pulse {
    0%,
    100% {
      filter: drop-shadow(0 0 4px rgba(244, 201, 93, 0.5));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 14px rgba(244, 201, 93, 1));
      transform: scale(1.08);
    }
  }
  .chip-pulse {
    animation: chip-pulse 1.1s ease-in-out infinite;
  }

  /* ===== COLLECT (fly away + fade) ===== */
  @keyframes chip-collect {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    40% {
      opacity: 1;
      transform: translateY(-10px) scale(1.15);
    }
    100% {
      opacity: 0;
      transform: translateY(-60px) scale(0.5);
    }
  }
  .chip-collect {
    animation: chip-collect 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    pointer-events: none;
  }
</style>
