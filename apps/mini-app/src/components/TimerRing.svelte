<script lang="ts">
  import { onMount } from 'svelte';

  export let size: number = 80;
  export let strokeWidth: number = 4;
  export let startedAt: number = 0;
  export let limitSec: number = 30;
  export let serverTime: number = Date.now();
  export let active: boolean = true;
  export let color: string = '#3b82f6';
  export let paused: boolean = false;
  export let dangerThreshold: number = 5;
  export let warningThreshold: number = 10;

  let now = Date.now();
  let timer: any = null;

  // Sync offset with server time (client clock may drift)
  let serverOffset = 0;
  $: if (serverTime > 0) {
    const clientAtReceive = Date.now();
    // We assume serverTime was captured ~now
    serverOffset = serverTime - clientAtReceive;
  }

  onMount(() => {
    timer = setInterval(() => (now = Date.now()), 100);
    return () => {
      if (timer) clearInterval(timer);
    };
  });

  // Paused = freeze elapsed at the moment pause started
  let pausedAt: number | null = null;
  $: if (paused && pausedAt === null) {
    pausedAt = now;
  } else if (!paused && pausedAt !== null) {
    pausedAt = null;
  }

  $: effectiveNow = paused && pausedAt !== null ? pausedAt : now + serverOffset;
  $: elapsed = Math.max(0, (effectiveNow - startedAt) / 1000);
  $: remaining = Math.max(0, limitSec - elapsed);
  $: pct = limitSec > 0 ? remaining / limitSec : 0;

  // If a custom color is provided, use it; otherwise use tiered color
  $: useCustomColor = color && color !== '#3b82f6';
  $: tieredColor =
    remaining <= dangerThreshold
      ? '#ef4444'
      : remaining <= warningThreshold
        ? '#f59e0b'
        : '#10b981';
  $: timerColor = useCustomColor ? color : tieredColor;

  $: radius = (size - strokeWidth) / 2;
  $: circumference = 2 * Math.PI * radius;
  $: dashOffset = circumference * (1 - pct);

  $: displaySec = Math.ceil(remaining);
  $: isPulsing = remaining <= dangerThreshold && active && remaining > 0 && !paused;
</script>

{#if active && (remaining > 0 || paused)}
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
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        stroke-width={strokeWidth}
      />

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