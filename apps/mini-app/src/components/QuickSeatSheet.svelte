<script lang="ts">
  import { t } from '../i18n';

  export let open: boolean = false;
  export let freeChips: number = 0;
  export let onClose: () => void = () => {};
  export let onConfirm: (data: { variant: string; mode: 'free' | 'real' }) => void = () => {};

  let selectedVariant: string = 'holdem';
  let selectedMode: 'free' | 'real' = 'free';

  const variants = [
    { id: 'holdem',  labelKey: 'games.holdem',  emoji: '♠️', color: 'from-blue-700 to-blue-950' },
    { id: 'omaha4',  labelKey: 'games.omaha4',  emoji: '♦️', color: 'from-red-700 to-red-950' },
    { id: 'omaha5',  labelKey: 'games.omaha5',  emoji: '♣️', color: 'from-emerald-700 to-emerald-950' },
  ];

  function confirm() {
    onConfirm({ variant: selectedVariant, mode: selectedMode });
  }
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm cursor-default"
    on:click={onClose}
  ></button>

  <div class="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto px-3 pb-3">
    <div class="glass-strong rounded-3xl p-5 shadow-2xl">
      <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4"></div>

      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-extrabold">{$t('quickSeat.title')}</h2>
        <button on:click={onClose} aria-label="Close" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70">✕</button>
      </div>

      <p class="text-xs uppercase tracking-wider text-white/50 font-bold mb-2">{$t('quickSeat.variant')}</p>
      <div class="grid grid-cols-3 gap-2 mb-5">
        {#each variants as v}
          <button
            on:click={() => selectedVariant = v.id}
            class="rounded-2xl p-3 bg-gradient-to-br {v.color} flex flex-col items-center gap-1 transition {selectedVariant === v.id ? 'ring-2 ring-gold scale-105' : 'opacity-60'}"
          >
            <span class="text-3xl">{v.emoji}</span>
            <span class="text-xs font-bold">{$t(v.labelKey)}</span>
          </button>
        {/each}
      </div>

      <p class="text-xs uppercase tracking-wider text-white/50 font-bold mb-2">{$t('quickSeat.mode')}</p>
      <div class="glass rounded-2xl p-1 flex gap-1 mb-5">
        <button
          on:click={() => selectedMode = 'free'}
          class="flex-1 py-3 rounded-xl text-sm font-bold transition {selectedMode === 'free' ? 'bg-emerald-600 text-white' : 'text-white/60'}"
        >
          🎁 {$t('quickSeat.free')}
        </button>
        <button
          on:click={() => selectedMode = 'real'}
          class="flex-1 py-3 rounded-xl text-sm font-bold transition {selectedMode === 'real' ? 'bg-gold text-black' : 'text-white/60'}"
        >
          💎 {$t('quickSeat.real')}
        </button>
      </div>

      <div class="mb-5 text-center text-xs text-white/50">
        {#if selectedMode === 'free'}
          {$t('home.freeChips')}: <span class="text-emerald-400 font-bold">{freeChips.toLocaleString()}</span>
        {:else}
          <span class="text-gold">{$t('quickSeat.realNote')}</span>
        {/if}
      </div>

      <button on:click={confirm} class="w-full btn-gold flex items-center justify-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
        </svg>
        <span>{$t('quickSeat.findTable')}</span>
      </button>
    </div>
  </div>
{/if}