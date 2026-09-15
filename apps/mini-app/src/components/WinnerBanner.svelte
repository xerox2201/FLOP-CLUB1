<script lang="ts">
  import PlayingCard from './PlayingCard.svelte';

  export let result: any;

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  // کارت ممکنه string ("As") یا object ({r:'A', s:'s'}) باشه
  function normalizeCard(c: any): { r: string; s: '♠' | '♥' | '♦' | '♣' } | null {
    if (!c) return null;
    if (typeof c === 'string') {
      return { r: c[0], s: suitChar(c[1]) };
    }
    if (typeof c === 'object' && c.r && c.s) {
      return { r: c.r, s: suitChar(c.s) };
    }
    return null;
  }

  // فقط ۵ کارت یکتا (بدون تکرار)
  function cleanBest(best: any[]): { r: string; s: '♠' | '♥' | '♦' | '♣' }[] {
    if (!best) return [];
    const seen = new Set<string>();
    const out: { r: string; s: '♠' | '♥' | '♦' | '♣' }[] = [];
    for (const c of best) {
      const nc = normalizeCard(c);
      if (!nc) continue;
      const key = nc.r + nc.s;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(nc);
      if (out.length === 5) break;
    }
    return out;
  }
</script>

<div
  class="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-none"
>
  <div
    class="glass-strong rounded-3xl p-4 max-w-[420px] w-full border-2 border-gold/40 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar"
  >
    <div class="text-center mb-3">
      <div class="text-3xl mb-1">🏆</div>
      <p class="text-[10px] uppercase tracking-widest text-gold/70 font-bold">
        {result.showdown ? 'Showdown' : 'Winner by Fold'}
      </p>
    </div>

    {#if result.showdown && result.showdownPlayers && result.showdownPlayers.length > 0}
      <div class="space-y-2">
        {#each result.showdownPlayers as p}
          {@const cards = cleanBest(p.best)}
          <div
            class="rounded-2xl p-2 {p.isWinner
              ? 'bg-gold/15 border-2 border-gold/60'
              : 'bg-white/5 border border-white/10'}"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5 min-w-0">
                {#if p.isWinner}
                  <span class="text-base">👑</span>
                {/if}
                <span
                  class="text-xs font-bold truncate {p.isWinner ? 'text-gold' : 'text-white/80'}"
                  >{p.displayName}</span
                >
              </div>
              <span
                class="text-[10px] font-bold shrink-0 ml-2 {p.isWinner
                  ? 'text-gold'
                  : 'text-white/50'}">{p.handName}</span
              >
            </div>

            <div class="flex items-center gap-1 justify-center">
              {#each cards as c}
                <div class={p.isWinner ? 'ring-1 ring-gold rounded-md' : ''}>
                  <PlayingCard rank={c.r} suit={c.s} size="sm" />
                </div>
              {/each}
            </div>

            {#if p.isWinner}
              <div class="text-center mt-2">
                <p class="text-base font-extrabold text-emerald-400">+${fmt(p.payout)}</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-center">
        <p class="text-xs text-white/50 mb-2">Everyone folded</p>
        <p class="font-extrabold text-lg text-gold mb-2">Winner</p>
        <p class="text-2xl font-extrabold text-emerald-400 mb-2">
          +${fmt(result.payouts?.[0]?.amount || 0)}
        </p>
        <p class="text-[10px] text-white/40 italic">Cards mucked</p>
      </div>
    {/if}

    <p class="text-center text-[10px] text-white/40 mt-3">Next hand soon…</p>
  </div>
</div>
