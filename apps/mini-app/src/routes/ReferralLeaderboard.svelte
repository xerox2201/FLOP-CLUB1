<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  let loading = true;
  let error = '';
  let data: { prizePool: number; entries: any[]; me: any } = {
    prizePool: 500,
    entries: [],
    me: { rank: 0, earned: 0, refs: 0 },
  };

  let now = Date.now();
  let clockTimer: any = null;

  function fmt(n: any, digits = 2): string {
    return Number(Number(n || 0).toFixed(digits)).toFixed(digits);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<any>('/api/referral/leaderboard');
      if (res.ok && res.data) data = res.data;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // Countdown to end of month
  $: endOfMonth = (() => {
    const d = new Date(now);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0)).getTime();
  })();

  $: remainingMs = Math.max(0, endOfMonth - now);
  $: countdown = (() => {
    const s = Math.floor(remainingMs / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  })();

  const PRIZES: Record<number, number> = { 1: 150, 2: 100, 3: 75 };
  function prizeForRank(rank: number): number {
    if (rank <= 3) return PRIZES[rank] ?? 0;
    if (rank <= 10) return 25;
    return 0;
  }

  onMount(() => {
    load();
    clockTimer = setInterval(() => (now = Date.now()), 1000);
  });

  onDestroy(() => {
    if (clockTimer) clearInterval(clockTimer);
  });

  $: first = data.entries[0] ?? null;
  $: second = data.entries[1] ?? null;
  $: third = data.entries[2] ?? null;
  $: rest = data.entries.slice(3);
</script>

<div class="pb-28">
  <TopBar />

  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <Icon name="arrow-left" size={18} color="#ffffff" />
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1 flex items-center gap-2">
      <Icon name="trophy" size={22} color="#f4c95d" />
      <span>Referral Ranks</span>
    </h1>
  </div>

  <!-- Prize pool hero -->
  <div class="px-4 mb-4">
    <div
      class="rounded-3xl p-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.28) 0%, transparent 60%),
          radial-gradient(ellipse at 0% 100%, rgba(139,92,246,0.15) 0%, transparent 60%),
          linear-gradient(135deg, #142d52 0%, #1a1240 60%, #05080f 100%);
        border: 1.5px solid rgba(244,201,93,0.45);
        box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(244,201,93,0.15);
      "
    >
      <div
        class="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-25 pointer-events-none"
        style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
      ></div>

      <div class="relative">
        <div class="flex items-center gap-2 mb-1.5">
          <Icon name="trophy" size={14} color="#f4c95d" />
          <p class="text-[10px] uppercase tracking-widest text-gold/80 font-extrabold">
            Monthly Prize Pool
          </p>
        </div>

        <div class="flex items-baseline gap-2 mb-3">
          <span
            class="text-5xl font-extrabold tabular-nums leading-none"
            style="
              background: linear-gradient(180deg, #f4e5a8, #f4c95d 45%, #a87a15);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              letter-spacing: -0.03em;
              filter: drop-shadow(0 0 20px rgba(244,201,93,0.3));
            "
          >
            ${fmt(data.prizePool, 0)}
          </span>
        </div>

        <div
          class="flex items-center justify-between pt-3"
          style="border-top: 1px solid rgba(244,201,93,0.2);"
        >
          <div class="flex items-center gap-2">
            <Icon name="clock" size={11} color="rgba(255,255,255,0.5)" />
            <span class="text-[10px] text-white/60 font-bold">Ends in {countdown}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] text-white/40 font-bold">Top 10 paid</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="px-4 space-y-2">
      {#each Array(4) as _}
        <div class="rounded-2xl h-[64px]" style="background: rgba(15,31,58,0.6);"></div>
      {/each}
    </div>
  {:else if error}
    <div
      class="mx-4 rounded-2xl p-4 text-center"
      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"
    >
      <p class="text-sm text-red-300 font-bold">{error}</p>
      <button on:click={load} class="mt-2 text-[11px] text-gold font-bold">Retry</button>
    </div>
  {:else if data.entries.length === 0}
    <div
      class="mx-4 rounded-2xl p-6 text-center"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px dashed rgba(212,175,55,0.3);"
    >
      <div class="flex justify-center mb-3">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center"
          style="background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);"
        >
          <Icon name="trophy" size={24} color="#d4af37" />
        </div>
      </div>
      <p class="text-sm font-extrabold text-white">Leaderboard starts this month</p>
      <p class="text-[11px] text-white/50 mt-1">Start referring friends to appear here</p>
    </div>
  {:else}
    <!-- Podium -->
    {#if first}
      <div class="px-4 mb-4">
        <div class="grid grid-cols-3 gap-2 items-end">
          <!-- 2nd -->
          <div class="flex flex-col items-center" style="order: 1;">
            {#if second}
              <div
                class="w-14 h-14 rounded-full overflow-hidden mb-1"
                style="border: 2px solid #94a3b8; box-shadow: 0 0 12px rgba(148,163,184,0.5);"
              >
                <img
                  src="/avatars/avatar-{second.avatarId || 'king'}.png"
                  alt={second.displayName}
                  class="w-full h-full object-cover"
                  style="transform: scale(1.15);"
                  draggable="false"
                />
              </div>
              <div
                class="w-full rounded-2xl p-2.5 text-center"
                style="background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95)); border: 1px solid rgba(148,163,184,0.4); min-height: 84px;"
              >
                <span
                  class="text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block mb-1"
                  style="background: rgba(148,163,184,0.25); color: #cbd5e1;">🥈 2nd</span
                >
                <p class="text-[10px] font-extrabold text-white truncate">{second.displayName}</p>
                <p class="text-[11px] font-extrabold text-emerald-400 tabular-nums mt-0.5">
                  ${fmt(second.earned)}
                </p>
                <p class="text-[8px] text-white/40 mt-0.5">${prizeForRank(2)} prize</p>
              </div>
            {/if}
          </div>

          <!-- 1st -->
          <div class="flex flex-col items-center" style="order: 2;">
            <span class="text-base mb-1">👑</span>
            <div
              class="w-16 h-16 rounded-full overflow-hidden mb-1"
              style="border: 2px solid #f4c95d; box-shadow: 0 0 20px rgba(244,201,93,0.7);"
            >
              <img
                src="/avatars/avatar-{first.avatarId || 'king'}.png"
                alt={first.displayName}
                class="w-full h-full object-cover"
                style="transform: scale(1.15);"
                draggable="false"
              />
            </div>
            <div
              class="w-full rounded-2xl p-2.5 text-center"
              style="background: linear-gradient(180deg, rgba(20,45,82,0.95), rgba(7,14,27,0.95)); border: 1.5px solid rgba(244,201,93,0.55); min-height: 100px; box-shadow: 0 0 20px rgba(244,201,93,0.2);"
            >
              <span
                class="text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block mb-1"
                style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
                >🥇 1st</span
              >
              <p class="text-[11px] font-extrabold text-white truncate">{first.displayName}</p>
              <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums mt-0.5">
                ${fmt(first.earned)}
              </p>
              <p class="text-[9px] text-gold font-extrabold mt-0.5">${prizeForRank(1)} prize</p>
            </div>
          </div>

          <!-- 3rd -->
          <div class="flex flex-col items-center" style="order: 3;">
            {#if third}
              <div
                class="w-14 h-14 rounded-full overflow-hidden mb-1"
                style="border: 2px solid #d97706; box-shadow: 0 0 12px rgba(217,119,6,0.5);"
              >
                <img
                  src="/avatars/avatar-{third.avatarId || 'king'}.png"
                  alt={third.displayName}
                  class="w-full h-full object-cover"
                  style="transform: scale(1.15);"
                  draggable="false"
                />
              </div>
              <div
                class="w-full rounded-2xl p-2.5 text-center"
                style="background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95)); border: 1px solid rgba(217,119,6,0.4); min-height: 84px;"
              >
                <span
                  class="text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block mb-1"
                  style="background: rgba(217,119,6,0.25); color: #fbbf24;">🥉 3rd</span
                >
                <p class="text-[10px] font-extrabold text-white truncate">{third.displayName}</p>
                <p class="text-[11px] font-extrabold text-emerald-400 tabular-nums mt-0.5">
                  ${fmt(third.earned)}
                </p>
                <p class="text-[8px] text-white/40 mt-0.5">${prizeForRank(3)} prize</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Rest -->
    {#if rest.length > 0}
      <div class="px-4 mb-4">
        <div class="space-y-1.5">
          {#each rest as e (e.userId)}
            {@const isMe = e.userId === data.me.userId}
            <div
              class="rounded-xl px-3 py-2.5 flex items-center gap-3"
              style="
                background: {isMe
                ? 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.03))'
                : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
                border: 1px solid {isMe ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.06)'};
              "
            >
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-extrabold tabular-nums"
                style="background: rgba(0,0,0,0.4); color: rgba(255,255,255,0.6);"
              >
                #{e.rank}
              </div>
              <div
                class="w-9 h-9 rounded-full overflow-hidden shrink-0"
                style="background: radial-gradient(circle, #1a3a5c, #05080f);"
              >
                <img
                  src="/avatars/avatar-{e.avatarId || 'king'}.png"
                  alt={e.displayName}
                  class="w-full h-full object-cover"
                  style="transform: scale(1.15);"
                  draggable="false"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[12px] font-extrabold text-white truncate">{e.displayName}</p>
                <p class="text-[9px] text-white/40 mt-0.5">
                  {e.refs}
                  {e.refs === 1 ? 'ref' : 'refs'}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums">
                  +${fmt(e.earned)}
                </p>
                {#if prizeForRank(e.rank) > 0}
                  <p class="text-[9px] font-bold text-gold tabular-nums mt-0.5">
                    ${prizeForRank(e.rank)} prize
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Sticky: my rank -->
{#if data.me && data.me.rank > 0}
  <div
    class="fixed bottom-20 left-4 right-4 max-w-[480px] mx-auto rounded-2xl p-3 flex items-center gap-3 z-30"
    style="background: radial-gradient(ellipse at 0% 0%, rgba(244,201,93,0.15) 0%, transparent 60%), linear-gradient(180deg, rgba(8,13,36,0.98), rgba(5,8,15,0.98)); border: 1.5px solid rgba(244,201,93,0.5); backdrop-filter: blur(16px); box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(244,201,93,0.2);"
  >
    <div
      class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); box-shadow: 0 2px 0 #7a560a;"
    >
      <span class="text-[12px] font-extrabold text-black leading-none">
        {data.me.rank <= 3 ? '★' : `#${data.me.rank}`}
      </span>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[11px] font-extrabold text-white">Your Rank</p>
      <p class="text-[9px] text-white/50 mt-0.5">
        {data.me.refs}
        {data.me.refs === 1 ? 'ref' : 'refs'} · +${fmt(data.me.earned)}
      </p>
    </div>
    {#if prizeForRank(data.me.rank) > 0}
      <div class="text-right shrink-0">
        <p class="text-[9px] text-gold/70 font-bold uppercase tracking-wider">Prize</p>
        <p class="text-[13px] font-extrabold text-gold tabular-nums">
          ${prizeForRank(data.me.rank)}
        </p>
      </div>
    {/if}
  </div>
{/if}
