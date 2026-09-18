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
  let displayPrizePool = 0;
  let refreshTimer: any = null;

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

  async function loadAll() {
    const [cur, me] = await Promise.all([api.leaderboardCurrent(), api.leaderboardMe()]);
    if (cur.ok && cur.data) {
      period = cur.data.period;
      entries = cur.data.entries;
      displayPrizePool = cur.data.livePrizePool ?? 0;
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
      entries = res.data.entries;
      period = res.data.period;
      displayPrizePool = res.data.livePrizePool ?? 0;
    }
  }

  onMount(async () => {
    await loadAll();
    refreshTimer = setInterval(refresh, 5000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center justify-between mt-3 mb-4">
    <h1 class="text-2xl font-extrabold">{$t('leaderboard.title')}</h1>
    {#if period}
      <span
        class="text-[9px] rounded-full px-2.5 py-1 font-mono text-white/60"
        style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
      >
        {period.period_start?.slice(5, 10)} → {period.period_end?.slice(5, 10)}
      </span>
    {/if}
  </div>

  {#if period}
    <div
      class="rounded-3xl p-4 mb-5 relative overflow-hidden"
      style="background: linear-gradient(135deg, rgba(244,201,93,0.2), rgba(168,121,34,0.08)); border: 1px solid rgba(244,201,93,0.35); box-shadow: 0 8px 24px rgba(0,0,0,0.4);"
    >
      <div
        class="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-25"
        style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
      ></div>

      <div class="flex items-center gap-2 mb-1 relative">
        <p class="text-[10px] uppercase tracking-widest text-gold/80 font-bold">
          {$t('leaderboard.prizePool')}
        </p>
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-[9px] text-emerald-300 font-bold">LIVE</span>
      </div>
      <p class="text-5xl font-extrabold text-gold-gradient tabular-nums leading-tight">
        ${fmt(displayPrizePool)}
      </p>
      <p class="text-[11px] text-white/60 mt-2 relative">
        {$t('leaderboard.top30Paid')}
      </p>
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
      {#each entries as e (e.user_id)}
        {@const isMe = e.user_id === myEntry?.user_id}
        {@const rank = e.rank || 0}
        <div
          class="rounded-2xl p-3 flex items-center gap-3 {isMe ? 'ring-2 ring-gold' : ''}"
          style="background: {rank === 1
            ? 'linear-gradient(135deg, rgba(244,201,93,0.15), rgba(168,121,34,0.05))'
            : rank <= 3
              ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(109,40,217,0.04))'
              : 'rgba(16,26,58,0.6)'}; border: 1px solid {rank === 1
            ? 'rgba(244,201,93,0.4)'
            : 'rgba(139,92,246,0.15)'};"
        >
          <div
            class="text-lg font-extrabold w-9 text-center shrink-0 {rank === 1
              ? 'text-gold'
              : rank <= 3
                ? 'text-white'
                : 'text-white/50'}"
          >
            {medal(rank)}
          </div>
          <Avatar avatarId={e.avatar_id || 'spade'} size="sm" />
          <div class="flex-1 min-w-0">
            <p class="font-bold text-sm truncate text-white">
              {e.display_name}
            </p>
            <p class="text-[10px] text-white/50">
              {e.hands_played}
              {handsLabel(e.hands_played)}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-bold text-emerald-400 tabular-nums">
              +${fmt(e.total_won_usd)}
            </p>
            {#if e.prize_usd > 0}
              <p class="text-[10px] text-gold font-bold tabular-nums">
                🏆 ${fmt(e.prize_usd)}
              </p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if myEntry || myRank}
    <div
      class="fixed bottom-20 left-4 right-4 max-w-[480px] mx-auto rounded-2xl p-3 flex items-center gap-3 z-30"
      style="background: rgba(8,13,36,0.95); border: 1px solid rgba(244,201,93,0.4); backdrop-filter: blur(16px); box-shadow: 0 8px 24px rgba(0,0,0,0.6);"
    >
      <span class="text-gold font-extrabold text-lg tabular-nums">
        {myRank ? `#${myRank}` : '—'}
      </span>
      <div class="flex-1">
        <p class="text-xs font-bold text-white">{$t('leaderboard.yourRank')}</p>
        <p class="text-[10px] text-white/50">
          {myEntry?.hands_played || 0}
          {handsLabel(myEntry?.hands_played || 0)} · +${fmt(myEntry?.total_won_usd || 0)}
        </p>
      </div>
    </div>
  {/if}
</div>
