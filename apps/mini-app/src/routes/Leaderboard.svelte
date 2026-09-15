<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { api } from '../lib/api';
  import { t } from '../i18n';

  let loading = true;
  let period: any = null;
  let entries: any[] = [];
  let myEntry: any = null;
  let myRank: number | null = null;
  let prizePool = 0;
  let displayPrizePool = 0;
  let refreshTimer: any = null;
  let animTimer: any = null;

  function fmt(n: any): string {
    return Number(Number(n).toFixed(2)).toFixed(2);
  }
  function medal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }
  function handsLabel(n: number): string {
    return n === 1 ? 'hand' : 'hands';
  }

  function animatePrizePool(target: number) {
    if (animTimer) clearInterval(animTimer);
    const start = displayPrizePool;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) {
      displayPrizePool = target;
      return;
    }
    const steps = 20;
    const stepValue = diff / steps;
    let current = 0;
    animTimer = setInterval(() => {
      current++;
      if (current >= steps) {
        displayPrizePool = target;
        clearInterval(animTimer);
        animTimer = null;
      } else displayPrizePool = start + stepValue * current;
    }, 30);
  }

  async function loadAll() {
    const [cur, me] = await Promise.all([api.leaderboardCurrent(), api.leaderboardMe()]);
    if (cur.ok && cur.data) {
      period = cur.data.period;
      entries = cur.data.entries;
      const newPool = cur.data.livePrizePool ?? 0;
      if (Math.abs(newPool - prizePool) > 0.001) animatePrizePool(newPool);
      prizePool = newPool;
    }
    if (me.ok && me.data) {
      myEntry = me.data.entry;
      myRank = me.data.liveRank;
    }
    loading = false;
  }

  async function refresh() {
    const res = await api.leaderboardCurrent();
    if (res.ok && res.data) {
      const newPool = res.data.livePrizePool ?? 0;
      if (Math.abs(newPool - prizePool) > 0.001) {
        animatePrizePool(newPool);
        prizePool = newPool;
      }
      entries = res.data.entries;
      period = res.data.period;
    }
  }

  onMount(async () => {
    await loadAll();
    refreshTimer = setInterval(refresh, 5000);
  });
  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (animTimer) clearInterval(animTimer);
  });
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center justify-between mt-3 mb-4">
    <h1 class="text-2xl font-extrabold">{$t('leaderboard.title')}</h1>
    {#if period}
      <span class="text-[10px] glass rounded-full px-3 py-1 font-mono"
        >{period.period_start?.slice(0, 10)} → {period.period_end?.slice(0, 10)}</span
      >
    {/if}
  </div>

  {#if period}
    <div class="card bg-gradient-to-br from-amber-800/30 to-amber-950/30 border-amber-700/40 mb-5">
      <div class="flex items-center gap-2 mb-1">
        <p class="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold">
          {$t('leaderboard.prizePool')}
        </p>
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-[9px] text-emerald-300 font-bold">LIVE</span>
      </div>
      <p class="text-5xl font-extrabold text-gold tabular-nums leading-tight">
        ${fmt(displayPrizePool)}
      </p>
      <p class="text-[11px] text-white/60 mt-2">{$t('leaderboard.top30Paid')}</p>
    </div>
  {/if}

  {#if loading}
    <p class="text-white/40 text-center py-12">{$t('common.loading')}</p>
  {:else if entries.length === 0}
    <div class="card text-center py-10">
      <p class="text-4xl mb-2">🏅</p>
      <p class="text-white/50 text-sm">{$t('leaderboard.noData')}</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each entries as e}
        <div
          class="card flex items-center gap-3 {e.user_id === myEntry?.user_id
            ? 'ring-2 ring-gold'
            : ''}"
        >
          <div class="text-lg font-extrabold w-10 text-center shrink-0">{medal(e.rank || 0)}</div>
          <Avatar avatarId={e.avatar_id || 'spade'} size="sm" />
          <div class="flex-1 min-w-0">
            <p class="font-bold text-sm truncate">{e.display_name}</p>
            <p class="text-[10px] text-white/50">{e.hands_played} {handsLabel(e.hands_played)}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-bold text-emerald-400">+${fmt(e.total_won_usd)}</p>
            {#if e.prize_usd > 0}
              <p class="text-[10px] text-gold font-semibold">🏆 ${fmt(e.prize_usd)}</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if myEntry || myRank}
    <div
      class="fixed bottom-20 left-4 right-4 max-w-[480px] mx-auto glass-strong rounded-2xl p-3 flex items-center gap-3 z-30"
    >
      <span class="text-gold font-extrabold text-lg">{myRank ? `#${myRank}` : '—'}</span>
      <div class="flex-1">
        <p class="text-xs font-bold">{$t('leaderboard.yourRank')}</p>
        <p class="text-[10px] text-white/50">
          {myEntry?.hands_played || 0}
          {handsLabel(myEntry?.hands_played || 0)} · +${fmt(myEntry?.total_won_usd || 0)}
        </p>
      </div>
    </div>
  {/if}
</div>
