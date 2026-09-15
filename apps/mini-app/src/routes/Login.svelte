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

<div class="min-h-screen flex flex-col items-center justify-center px-6">
  <div class="relative mb-8">
    <div class="absolute inset-0 blur-3xl bg-gold/30 rounded-full"></div>
    <div class="relative text-8xl">♠️♥️</div>
  </div>
  <h1 class="text-4xl font-extrabold text-gold tracking-wider mb-2">FLOP CLUB</h1>
  <p class="text-white/60 text-center mb-10">{$t('login.subtitle')}</p>

  <button
    on:click={enter}
    disabled={busy}
    class="btn-gold w-full max-w-xs flex items-center justify-center gap-2"
  >
    {#if busy}
      <div
        class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"
      ></div>
      <span>{$t('login.signingIn')}</span>
    {:else}
      <span>🎮</span>
      <span>{$t('login.enterBtn')}</span>
    {/if}
  </button>

  <p class="text-[11px] text-white/30 mt-8 text-center max-w-xs leading-relaxed">
    {$t('login.terms')}
  </p>
</div>
