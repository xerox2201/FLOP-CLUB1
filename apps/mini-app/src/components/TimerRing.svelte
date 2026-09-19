<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let size: number = 80;
  export let strokeWidth: number = 4;
  export let startedAt: number = 0;
  export let limitSec: number = 30;
  export let serverTime: number = Date.now();
  export let active: boolean = true;
  export let color: string = '#3b82f6';
  export let paused: boolean = false;
  export let dangerThreshold: number = 5;  // seconds
  export let warningThreshold: number = 10;

  let now = Date.now();
  let timer: any = null;

  onMount(() => {
    timer = setInterval(() => (now = Date.now()), 100);
    return () => {
      if (timer) clearInterval(timer);
    };
  });

  $: elapsed = Math.max(0, (now - startedAt) / 1000);
  $: remaining = Math.max(0, limitSec - elapsed);
  $: pct = limitSec > 0 ? remaining / limitSec : 0;

  // Color tiers: blue → yellow → red
    // Color tiers: green → amber → red (standard 80/15/5 distribution)
  $: timerColor =
    remaining <= dangerThreshold ? '#ef4444' :     // 0-5s: red (5%)
    remaining <= warningThreshold ? '#f59e0b' :    // 5-10s: amber (15%)
    '#10b981';                                      // 10-30s: green (80%)

  $: radius = (size - strokeWidth) / 2;
  $: circumference = 2 * Math.PI * radius;
  $: dashOffset = circumference * (1 - pct);

  $: displaySec = Math.ceil(remaining);
  $: isPulsing = remaining <= dangerThreshold && active && remaining > 0;
</script>

{#if active && remaining > 0}
  <div
    class="timer-ring"
    class:pulsing={isPulsing}
    style="width: {size}px; height: {size}px;"
  >
    <svg
      width={size}
      height={size}
      viewBox="0 0 {size} {size}"
      style="transform: rotate(-90deg);"
    >
      <!-- Background track -->
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        stroke-width={strokeWidth}
      />

      <!-- Progress arc -->
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={timerColor}
        stroke-width={strokeWidth}
        stroke-linecap="round"
        stroke-dasharray={circumference}
        stroke-dashoffset={dashOffset}
        style="
          transition: stroke-dashoffset 0.15s linear, stroke 0.3s ease;
          filter: drop-shadow(0 0 6px {timerColor}80);
        "
      />
    </svg>

    <!-- Countdown number -->
    <div
      class="timer-text"
      style="
        color: {timerColor};
        font-size: {size * 0.32}px;
        text-shadow: 0 0 8px {timerColor}80, 0 2px 4px rgba(0,0,0,0.9);
      "
    >
      {displaySec}
    </div>
  </div>
{/if}

<style>
  .timer-ring {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .timer-text {
    position: absolute;
    font-family: 'Sora', sans-serif;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .timer-ring.pulsing {
    animation: timer-pulse 0.8s ease-in-out infinite;
  }

  @keyframes timer-pulse {
    0%, 100% {
      transform: scale(1);
      filter: drop-shadow(0 0 4px rgba(239,68,68,0.4));
    }
    50% {
      transform: scale(1.06);
      filter: drop-shadow(0 0 16px rgba(239,68,68,0.9));
    }
  }
</style>