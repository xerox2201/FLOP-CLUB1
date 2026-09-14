 <script lang="ts">
  import { onDestroy } from 'svelte';

  export let size: number = 60;
  export let strokeWidth: number = 3;
  export let startedAt: number = 0;
  export let limitSec: number = 30;
  export let serverTime: number = 0;
  export let active: boolean = false;
  export let color: string = '#f97316';

  let elapsed = 0;
  let tickInterval: any = null;
  let offset = 0;

  $: if (serverTime > 0) offset = Date.now() - serverTime;

  function computeElapsed() {
    if (!active || startedAt <= 0) return 0;
    const now = Date.now() - offset;
    return Math.max(0, (now - startedAt) / 1000);
  }

  $: remaining = Math.max(0, limitSec - elapsed);
  $: pct = limitSec > 0 ? Math.min(1, elapsed / limitSec) : 0;
  $: radius = (size - strokeWidth) / 2;
  $: circumference = 2 * Math.PI * radius;
  $: dashOffset = circumference * (1 - pct);

  function startTicker() {
    stopTicker();
    tickInterval = setInterval(() => { elapsed = computeElapsed(); }, 100);
  }
  function stopTicker() {
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
  }

  $: if (active && startedAt > 0) {
    elapsed = computeElapsed();
    startTicker();
  } else {
    elapsed = 0;
    stopTicker();
  }

  onDestroy(() => stopTicker());
</script>

{#if active && startedAt > 0}
  <!-- SVG دقیقاً هم‌اندازه‌ی wrapper -->
  <svg
    width={size}
    height={size}
    viewBox="0 0 {size} {size}"
    class="absolute inset-0 pointer-events-none"
    style="transform: rotate(-90deg);"
  >
    <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(0,0,0,0.7)" stroke-width={strokeWidth}/>
    <circle
      cx={size/2} cy={size/2} r={radius}
      fill="none" stroke={color} stroke-width={strokeWidth}
      stroke-linecap="round" stroke-dasharray={circumference} stroke-dashoffset={dashOffset}
      style="transition: stroke-dashoffset 0.1s linear;"
    />
  </svg>

  <!-- شمارنده‌ی عددی روی گوشه‌ی بالا-راست حلقه -->
  <div class="absolute -top-1 -right-1 z-10 pointer-events-none">
    <div class="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold text-white shadow-lg border-2 border-white/40" style="background: {color};">
      {Math.ceil(remaining)}
    </div>
  </div>
{/if}