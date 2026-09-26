<script lang="ts">
  import { onMount } from 'svelte';
  import { preferences } from '../lib/preferences';

  export let amount: number = 0;
  export let size: number = 28;
  export let maxStack: number = 5;

  // Animation props
  export let animate: boolean = true; // pop-in on mount
  export let pulse: boolean = false; // winner highlight
  export let collecting: boolean = false; // fly-away when pot collected

  const DENOMS = [
    { value: 1, row: 0, col: 0 },
    { value: 5, row: 0, col: 1 },
    { value: 25, row: 0, col: 2 },
    { value: 100, row: 0, col: 3 },
    { value: 500, row: 1, col: 0 },
    { value: 1000, row: 1, col: 1 },
    { value: 5000, row: 1, col: 2 },
    { value: 10000, row: 1, col: 3 },
    { value: 50000, row: 2, col: 0 },
    { value: 100000, row: 2, col: 1 },
    { value: 500000, row: 2, col: 2 },
    { value: 1000000, row: 2, col: 3 },
  ];

  function breakdown(amt: number) {
    const result: { value: number; row: number; col: number; count: number }[] = [];
    let remaining = Math.round(amt * 100) / 100;
    for (let i = DENOMS.length - 1; i >= 0; i--) {
      const d = DENOMS[i];
      if (remaining >= d.value) {
        const count = Math.floor(remaining / d.value);
        result.push({ ...d, count });
        remaining -= count * d.value;
      }
    }
    if (result.length === 0 && amt > 0) result.push({ ...DENOMS[0], count: 1 });
    return result;
  }

  $: stacks = breakdown(amount);

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
    {#each stacks as s}
      <div
        class="relative"
        style="
          width: {size}px;
          height: {size + (Math.min(s.count, maxStack) - 1) * (size * 0.16)}px;
        "
      >
        {#each Array(Math.min(s.count, maxStack)) as _, i}
          <div
            class="absolute"
            style="
              width: {size}px;
              height: {size}px;
              bottom: {i * (size * 0.16)}px;
              left: 0;
              background-image: url('/chips-set-hq.webp');
              background-size: 400% 300%;
              background-position: {(s.col * 100) / 3}% {(s.row * 100) / 2}%;
              background-repeat: no-repeat;
              filter: drop-shadow(0 {size * 0.06}px {size * 0.1}px rgba(0,0,0,0.7));
              animation-delay: {i * 0.03}s;
            "
          ></div>
        {/each}

        {#if s.count > maxStack}
          <div
            class="absolute -top-2 -right-2 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold z-10"
            style="
              background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
              color: #0a0800;
              box-shadow: 0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,235,170,0.5);
              line-height: 1;
            "
          >
            ×{s.count}
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
