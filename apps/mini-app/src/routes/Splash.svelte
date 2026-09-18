<script lang="ts">
  import { onMount } from 'svelte';

  let visible = true;
  onMount(() => {
    const t = setTimeout(() => {
      visible = false;
      window.dispatchEvent(new CustomEvent('splash-done'));
    }, 3000);
    return () => clearTimeout(t);
  });
</script>

<div
  class="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center"
  style="display: {visible ? 'flex' : 'none'};"
>
  <!-- Background -->
  <div class="absolute inset-0" style="background: linear-gradient(180deg, #070e1b 0%, #05080f 100%);"></div>

  <!-- Pattern -->
  <div class="absolute inset-0 opacity-25"
       style="
         background-image: url('/bg-lobby.png');
         background-size: cover;
         background-position: center;
       "></div>

  <!-- Dark overlay -->
  <div class="absolute inset-0" style="background: radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(5,8,15,0.85) 70%);"></div>

  <!-- Gold pulse -->
  <div
    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] pointer-events-none"
    style="background: radial-gradient(circle, rgba(212,175,55,0.3), transparent 60%); filter: blur(20px);"
  ></div>

  <!-- Content -->
  <div class="relative z-10 flex flex-col items-center px-6">
    <!-- Lion -->
    <img
      src="/splash-lion.png"
      alt="Royal Poker"
      class="w-[220px] h-[220px] object-contain select-none"
      style="filter: drop-shadow(0 12px 40px rgba(212,175,55,0.6)); animation: splash-pulse 2s ease-in-out infinite;"
      draggable="false"
    />

    <!-- Title -->
    <h1
      class="text-4xl font-extrabold tracking-[0.2em] text-center mt-6"
      style="
        background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 4px 24px rgba(212,175,55,0.3);
      "
    >
      ROYAL POKER
    </h1>

    <!-- Subtitle -->
    <div class="flex items-center gap-3 mt-3">
      <div class="h-px w-10" style="background: linear-gradient(to right, transparent, #d4af37);"></div>
      <p class="text-[9px] font-extrabold tracking-[0.45em] text-gold/70 uppercase">
        Play · Compete · Win
      </p>
      <div class="h-px w-10" style="background: linear-gradient(to left, transparent, #d4af37);"></div>
    </div>

    <!-- Loading bar -->
    <div class="mt-10 w-56">
      <div class="w-full h-1 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.5);">
        <div
          class="h-full rounded-full"
          style="
            background: linear-gradient(90deg, #f4e5a8, #d4af37, #a87a15);
            animation: splash-bar 2.8s ease-out forwards;
            box-shadow: 0 0 12px rgba(212,175,55,0.7);
          "
        ></div>
      </div>
      <p class="mt-3 text-center text-[9px] font-extrabold uppercase tracking-[0.4em] text-gold/50">
        Loading
      </p>
    </div>
  </div>
</div>

<style>
  @keyframes splash-pulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 12px 40px rgba(212,175,55,0.6)); }
    50% { transform: scale(1.04); filter: drop-shadow(0 12px 50px rgba(212,175,55,0.9)); }
  }
  @keyframes splash-bar {
    0% { width: 0%; }
    100% { width: 100%; }
  }
</style>