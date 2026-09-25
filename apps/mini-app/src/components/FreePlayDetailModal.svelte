<script lang="ts">
  import Icon from './Icon.svelte';

  export let open: boolean = false;
  export let stats: {
    free_hands: number;
    free_won: number;
    free_hands_won: number;
    chips: number;
  } | null = null;
  export let onClose: () => void = () => {};

  function fmtChips(n: number): string {
    return Number(n || 0).toLocaleString();
  }

  $: winRate =
    stats && stats.free_hands > 0 ? Math.round((stats.free_hands_won / stats.free_hands) * 100) : 0;
</script>

{#if open && stats}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[95] cursor-default"
    style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] rounded-3xl p-5 w-[90%] max-w-[380px]"
    style="background: linear-gradient(180deg, #101a3a, #080d24); border: 1.5px solid rgba(16,185,129,0.4); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
  >
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center"
          style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4);"
        >
          <Icon name="gift" size={20} />
        </div>
        <h2 class="text-base font-extrabold text-white">Free Play</h2>
      </div>
      <button
        on:click={onClose}
        aria-label="Close"
        class="w-8 h-8 rounded-xl flex items-center justify-center text-white/60"
        style="background: rgba(255,255,255,0.06);"
      >
        <Icon name="close" size={12} color="rgba(255,255,255,0.6)" />
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div
        class="rounded-2xl p-3 text-center"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(16,185,129,0.25);"
      >
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Hands Played</p>
        <p class="text-xl font-extrabold text-white tabular-nums">
          {stats.free_hands.toLocaleString()}
        </p>
      </div>
      <div
        class="rounded-2xl p-3 text-center"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(16,185,129,0.25);"
      >
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Hands Won</p>
        <p class="text-xl font-extrabold text-emerald-400 tabular-nums">
          {stats.free_hands_won.toLocaleString()}
        </p>
      </div>
      <div
        class="rounded-2xl p-3 text-center"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(16,185,129,0.25);"
      >
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Chips Now</p>
        <p class="text-xl font-extrabold text-gold tabular-nums">{fmtChips(stats.chips)}</p>
      </div>
      <div
        class="rounded-2xl p-3 text-center"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(16,185,129,0.25);"
      >
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Total Won</p>
        <p class="text-xl font-extrabold text-emerald-400 tabular-nums">
          {fmtChips(stats.free_won)}
        </p>
      </div>
    </div>

    <div
      class="mt-3 rounded-2xl p-3 text-center"
      style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.05)); border: 1px solid rgba(16,185,129,0.3);"
    >
      <p class="text-[9px] text-emerald-300/80 uppercase tracking-wider font-bold mb-1">
        Free Win Rate
      </p>
      <p class="text-2xl font-extrabold text-emerald-400 tabular-nums">{winRate}%</p>
    </div>

    <p class="text-[10px] text-white/40 text-center mt-3 leading-relaxed">
      Free chips have no cash value.<br />Play unlimited hands — no risk.
    </p>
  </div>
{/if}
