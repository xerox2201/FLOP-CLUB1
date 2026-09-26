<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { api } from '../lib/api';
  import { t } from '../i18n';
  import Icon from '../components/Icon.svelte';

  let loading = true;
  let period: any = null;
  let entries: any[] = [];
  let myEntry: any = null;
  let myRank: number | null = null;
  let displayPrizePool = 0;
  let refreshTimer: any = null;

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function handsLabel(n: number): string {
    return n === 1 ? 'hand' : 'hands';
  }

  function normalize(e: any, idx: number) {
    return {
      user_id: e.user_id ?? e.userId ?? e.id,
      rank: e.rank ?? idx + 1,
      avatar_id: e.avatar_id ?? e.avatarId ?? 'spade',
      display_name: e.display_name ?? e.name ?? 'Player',
      hands_played: e.hands_played ?? 0,
      total_won_usd: e.total_won_usd ?? 0,
      prize_usd: e.prize_usd ?? 0,
    };
  }

  async function loadAll() {
    try {
      const [cur, me] = await Promise.all([api.getSeasonLeaderboard(), api.getMySeasonRank()]);
      if (cur.ok && cur.data) {
        period = cur.data.period ?? null;
        const raw = cur.data.entries ?? cur.data.leaderboard ?? [];
        entries = raw.map((e: any, i: number) => normalize(e, i));
        displayPrizePool = cur.data.livePrizePool ?? cur.data.prizePool ?? 0;
      }
      if (me.ok && me.data) {
        myEntry = me.data.entry ? normalize(me.data.entry, 0) : null;
        myRank = me.data.liveRank ?? me.data.rank ?? null;
      }
    } catch (e) {
      console.error('[Leaderboard] load failed', e);
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    try {
      const res = await api.getSeasonLeaderboard();
      if (res.ok && res.data) {
        const raw = res.data.entries ?? res.data.leaderboard ?? [];
        entries = raw.map((e: any, i: number) => normalize(e, i));
        period = res.data.period ?? null;
        displayPrizePool = res.data.livePrizePool ?? res.data.prizePool ?? 0;
      }
    } catch {
      // silent refresh — keep last known state
    }
  }

  onMount(async () => {
    await loadAll();
    refreshTimer = setInterval(refresh, 5000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });

  $: first = entries[0] ?? null;
  $: second = entries[1] ?? null;
  $: third = entries[2] ?? null;
  $: rest = entries.slice(3);
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
      style="background: linear-gradient(135deg, rgba(244,201,93,0.2), rgba(168,121,34,0.08)); border: 1px solid rgba(244,201,93,0.35); box-shadow:0 8px 24px rgba(0,0,0,0.4);"
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
      <div class="flex justify-center mb-2">
        <Icon name="medal" size={48} />
      </div>
      <p class="text-white/50 text-sm">{$t('leaderboard.noData')}</p>
    </div>
  {:else}
    <!-- ============ PODIUM ============ -->
    <div class="podium mb-5">
      <!-- 2nd -->
      <div class="slot slot-2">
        {#if second}
          <div class="medal-wrap">
            <img class="medal" src="/medal-silver.png" alt="" aria-hidden="true" />
          </div>
          <div class="avatar-wrap">
            <Avatar avatarId={second.avatar_id} size="md" />
          </div>
          <span class="name">{second.display_name}</span>
          <span class="points">+${fmt(second.total_won_usd)}</span>
        {:else}
          <div class="empty-slot">—</div>
        {/if}
      </div>

      <!-- 1st -->
      <div class="slot slot-1">
        {#if first}
          <img class="crown" src="/crown.webp" alt="" aria-hidden="true" />
          <div class="medal-wrap">
            <img class="medal medal-lg" src="/medal-gold.png" alt="" aria-hidden="true" />
          </div>
          <div class="avatar-wrap">
            <Avatar avatarId={first.avatar_id} size="md" />
          </div>
          <span class="name">{first.display_name}</span>
          <span class="points">+${fmt(first.total_won_usd)}</span>
        {:else}
          <div class="empty-slot">—</div>
        {/if}
      </div>

      <!-- 3rd -->
      <div class="slot slot-3">
        {#if third}
          <div class="medal-wrap">
            <img class="medal" src="/medal-bronze.png" alt="" aria-hidden="true" />
          </div>
          <div class="avatar-wrap">
            <Avatar avatarId={third.avatar_id} size="md" />
          </div>
          <span class="name">{third.display_name}</span>
          <span class="points">+${fmt(third.total_won_usd)}</span>
        {:else}
          <div class="empty-slot">—</div>
        {/if}
      </div>
    </div>

    <!-- ============ REST ============ -->
    {#if rest.length > 0}
      <div class="space-y-2">
        {#each rest as e (e.user_id)}
          {@const isMe = e.user_id === myEntry?.user_id}
          <div
            class="rounded-2xl p-3 flex items-center gap-3 {isMe ? 'ring-2 ring-gold' : ''}"
            style="background: rgba(16,26,58,0.6); border: 1px solid rgba(139,92,246,0.15);"
          >
            <div class="text-sm font-extrabold w-8 text-center shrink-0 text-white/50 tabular-nums">
              #{e.rank}
            </div>
            <Avatar avatarId={e.avatar_id} size="sm" />
            <div class="flex-1 min-w-0">
              <p class="font-bold text-sm truncate text-white">{e.display_name}</p>
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
                <p
                  class="text-[10px] text-gold font-bold tabular-nums flex items-center gap-1 justify-end"
                >
                  <Icon name="trophy" size={10} />
                  <span>${fmt(e.prize_usd)}</span>
                </p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
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

<style>
  .podium {
    display: grid;
    grid-template-columns: 1fr 1.15fr 1fr;
    align-items: end;
    gap: 0.5rem;
  }
  .slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.5rem 1rem;
    border-radius: 16px 16px 0 0;
    background: linear-gradient(180deg, rgba(15, 31, 58, 0.85), rgba(7, 14, 27, 0.95));
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-bottom: none;
    position: relative;
    justify-content: flex-end;
  }
  .slot-1 {
    min-height: 240px;
    border-color: rgba(244, 201, 93, 0.5);
  }
  .slot-2 {
    min-height: 205px;
  }
  .slot-3 {
    min-height: 180px;
  }

  .slot-1::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 16px 16px 0 0;
    background: radial-gradient(ellipse at 50% 0%, rgba(244, 201, 93, 0.15) 0%, transparent 70%);
    pointer-events: none;
  }

  /* medal wrapper — فضای اضافی روبان رو جبران می‌کنه */
  .medal-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 56px;
    width: 100%;
  }
  .slot-1 .medal-wrap {
    height: 72px;
  }

  .medal {
    width: 96px;
    height: 96px;
    object-fit: contain;
    filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.75));
    flex-shrink: 0;
  }
  .slot-1 .medal {
    width: 124px;
    height: 124px;
  }

  .avatar-wrap {
    display: grid;
    place-items: center;
  }
  .empty-slot {
    opacity: 0.3;
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.5);
    align-self: center;
  }
  .name {
    font-size: 0.72rem;
    font-weight: 700;
    max-width: 95%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #fff;
  }
  .points {
    font-size: 0.7rem;
    color: #34d399;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .crown {
    position: absolute;
    top: -18px;
    width: 34px;
    height: 34px;
    filter: drop-shadow(0 3px 8px rgba(244, 201, 93, 0.7));
    z-index: 2;
  }
</style>
