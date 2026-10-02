<script lang="ts">
  import { onMount } from 'svelte';

  let visible = true;
  onMount(() => {
    const t = setTimeout(() => {
      visible = false;
      window.dispatchEvent(new CustomEvent('splash-done'));
    }, 3200);
    return () => clearTimeout(t);
  });
</script>

<div
  class="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-between"
  style="display: {visible ? 'flex' : 'none'};"
>
  <!-- Full-screen background image -->
  <img
    src="/splash-flop-club.jpg"
    alt=""
    class="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
    draggable="false"
  />

  <!-- Cinematic vignette -->
  <div
    class="absolute inset-0 pointer-events-none"
    style="
      background:
        linear-gradient(
          180deg,
          rgba(5,8,15,0.7) 0%,
          transparent 25%,
          transparent 65%,
          rgba(5,8,15,0.9) 100%
        ),
        radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(5,8,15,0.4) 100%);
    "
  ></div>

  <!-- TOP: Title -->
  <div class="relative z-10 flex flex-col items-center w-full pt-16 px-6">
    <h1
      class="text-4xl font-extrabold tracking-[0.25em] text-center"
      style="
        background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 4px 24px rgba(212,175,55,0.5));
      "
    >
      FLOP CLUB
    </h1>

    <div class="flex items-center gap-3 mt-3">
      <div
        class="h-px w-10"
        style="background: linear-gradient(to right, transparent, #d4af37);"
      ></div>
      <p class="text-micro font-extrabold tracking-[0.45em] text-gold/80 uppercase">
        Play · Compete · Win
      </p>
      <div
        class="h-px w-10"
        style="background: linear-gradient(to left, transparent, #d4af37);"
      ></div>
    </div>
  </div>

  <!-- BOTTOM: Loading bar -->
  <div class="relative z-10 w-56 mb-16">
    <div class="w-full h-1 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.6);">
      <div
        class="h-full rounded-full"
        style="
          background: linear-gradient(90deg, #f4e5a8, #d4af37, #a87a15);
          animation: splash-bar 2.8s ease-out forwards;
          box-shadow: 0 0 12px rgba(212,175,55,0.8);
        "
      ></div>
    </div>
    <p class="mt-3 text-center text-micro font-extrabold uppercase tracking-[0.4em] text-gold/60">
      Loading
    </p>
  </div>
</div>

<style>
  @keyframes splash-bar {
    0% {
      width: 0%;
    }
    100% {
      width: 100%;
    }
  }
</style>
