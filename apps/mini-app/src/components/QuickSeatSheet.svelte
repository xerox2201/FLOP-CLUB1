<script lang="ts">
  import { t } from '../i18n';

  export let open: boolean = false;
  export let freeChips: number = 0;
  export let onClose: () => void = () => {};
  export let onConfirm: (data: { variant: string; mode: 'free' | 'real' }) => void = () => {};

  let selectedVariant: string = 'holdem';
  let selectedMode: 'free' | 'real' = 'free';

  const variants = [
    {
      id: 'holdem',
      labelKey: 'games.holdem',
      emoji: '♠️',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0c1a3a 100%)',
      activeBorder: '#3b82f6',
    },
    {
      id: 'omaha4',
      labelKey: 'games.omaha4',
      emoji: '♦️',
      gradient: 'linear-gradient(135deg, #7f1d1d 0%, #3b0a0a 100%)',
      activeBorder: '#ef4444',
    },
    {
      id: 'omaha5',
      labelKey: 'games.omaha5',
      emoji: '♣️',
      gradient: 'linear-gradient(135deg, #14532d 0%, #062a14 100%)',
      activeBorder: '#10b981',
    },
  ];

  function confirm() {
    onConfirm({ variant: selectedVariant, mode: selectedMode });
  }
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 bg-black/75 z-50 backdrop-blur-sm cursor-default"
    on:click={onClose}
  ></button>

  <div class="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto px-3 pb-3">
    <div
      class="rounded-3xl p-5"
      style="background: linear-gradient(180deg, rgba(16,26,58,0.98), rgba(8,13,36,0.98)); border: 1px solid rgba(139,92,246,0.35); box-shadow: 0 -8px 40px rgba(0,0,0,0.7); backdrop-filter: blur(20px);"
    >
      <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4"></div>

      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-extrabold text-white">
          {$t('quickSeat.title')}
        </h2>
        <button
          on:click={onClose}
          aria-label="Close"
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/60"
          style="background: rgba(139,92,246,0.15);"
        >
          ✕
        </button>
      </div>

      <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
        {$t('quickSeat.variant')}
      </p>
      <div class="grid grid-cols-3 gap-2 mb-5">
        {#each variants as v}
          <button
            on:click={() => (selectedVariant = v.id)}
            class="rounded-2xl p-3 flex flex-col items-center gap-1.5 transition"
            style="background: {v.gradient}; border: 2px solid {selectedVariant === v.id
              ? v.activeBorder
              : 'transparent'}; {selectedVariant === v.id
              ? `box-shadow: 0 0 16px ${v.activeBorder}60;`
              : 'opacity: 0.55'};"
          >
            <span class="text-3xl">{v.emoji}</span>
            <span class="text-xs font-bold text-white">{$t(v.labelKey)}</span>
          </button>
        {/each}
      </div>

      <p class="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
        {$t('quickSeat.mode')}
      </p>
      <div
        class="rounded-2xl p-1 flex gap-1 mb-5"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.2);"
      >
        <button
          on:click={() => (selectedMode = 'free')}
          class="flex-1 py-3 rounded-xl text-sm font-bold transition {selectedMode === 'free'
            ? 'bg-gradient-to-b from-emerald-400 to-emerald-700 text-white'
            : 'text-white/60'}"
        >
          🎁 {$t('quickSeat.free')}
        </button>
        <button
          on:click={() => (selectedMode = 'real')}
          class="flex-1 py-3 rounded-xl text-sm font-bold transition {selectedMode === 'real'
            ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
            : 'text-white/60'}"
        >
          💎 {$t('quickSeat.real')}
        </button>
      </div>

      <div class="mb-5 text-center text-xs text-white/50">
        {#if selectedMode === 'free'}
          {$t('home.freeChips')}:
          <span class="text-emerald-400 font-bold">{freeChips.toLocaleString()}</span>
        {:else}
          <span class="text-gold">{$t('quickSeat.realNote')}</span>
        {/if}
      </div>

      <button on:click={confirm} class="w-full btn-gold flex items-center justify-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
        <span class="text-sm font-extrabold tracking-wide">{$t('quickSeat.findTable')}</span>
      </button>
    </div>
  </div>
{/if}
