<script lang="ts">
  import { auth } from '../stores/auth';
  import { t } from '../i18n';

  let busy = false;

  async function enter() {
    busy = true;
    try {
      await auth.init();
    } catch (e) {
      console.error(e);
    }
    busy = false;
  }
</script>

<div class="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
  <!-- Background glows -->
  <div
    class="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] opacity-30 pointer-events-none"
    style="background: radial-gradient(circle, #6d28d9, transparent 60%);"
  ></div>
  <div
    class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] opacity-20 pointer-events-none"
    style="background: radial-gradient(circle, #22d3ee, transparent 60%);"
  ></div>

  <div class="relative z-10 flex flex-col items-center w-full max-w-sm">
    <!-- Logo -->
    <div class="relative mb-6">
      <div
        class="absolute inset-0 blur-3xl opacity-60"
        style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
      ></div>
      <div class="relative text-7xl">♠️♥️</div>
    </div>

    <h1 class="text-4xl font-extrabold text-gold-gradient tracking-widest mb-2">FLOP CLUB</h1>
    <p class="text-white/60 text-center text-sm mb-10">
      {$t('login.subtitle')}
    </p>

    <button
      on:click={enter}
      disabled={busy}
      class="btn-gold w-full flex items-center justify-center gap-2 text-base"
    >
      {#if busy}
        <div
          class="w-5 h-5 border-2 border-near-black border-t-transparent rounded-full animate-spin"
        ></div>
        <span>{$t('login.signingIn')}</span>
      {:else}
        <span>🎮</span>
        <span>{$t('login.enterBtn')}</span>
      {/if}
    </button>

    <p class="text-[10px] text-white/30 mt-8 text-center leading-relaxed">
      {$t('login.terms')}
    </p>
  </div>
</div>
