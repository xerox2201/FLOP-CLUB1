<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { auth } from '../stores/auth';

  export let onBack: () => void = () => {};

  type Achievement = {
    id: number;
    code: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    threshold: number;
    progress: number;
    unlocked: boolean;
    unlockedAt: string | null;
    claimed: boolean;
    claimedAt: string | null;
    rewardChips: number;
    rewardUsd: number;
  };

  let achievements: Achievement[] = [];
  let loading = true;
  let error = '';
  let toast = '';
  type CategoryKey = 'all' | 'hand' | 'tournament' | 'wallet' | 'special';
let activeFilter: CategoryKey = 'all';
  let claiming: string | null = null;

  function token(): string | null {
    return localStorage.getItem('token');
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const t = token();
      const res = await fetch('/api/me/achievements', {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!res.ok) {
        error = `HTTP ${res.status}`;
        return;
      }
      const data = await res.json();
      achievements = data.achievements || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function claim(code: string) {
    claiming = code;
    try {
      const t = token();
      const res = await fetch(`/api/me/achievements/${code}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: '{}',
      });
      const data = await res.json();
      if (res.ok) {
        toast = `✅ Reward claimed!`;
        setTimeout(() => (toast = ''), 3000);
        await load();
        await auth.refresh();
      } else {
        toast = `❌ ${data.error || 'claim failed'}`;
        setTimeout(() => (toast = ''), 3000);
      }
    } catch (e: any) {
      toast = `❌ ${e.message}`;
      setTimeout(() => (toast = ''), 3000);
    } finally {
      claiming = null;
    }
  }

  onMount(load);

  $: filtered = activeFilter === 'all'
    ? achievements
    : achievements.filter((a) => a.category === activeFilter);

  $: unlockedCount = achievements.filter((a) => a.unlocked).length;
  $: totalCount = achievements.length;
  $: claimableCount = achievements.filter((a) => a.unlocked && !a.claimed).length;
  $: completionPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const CATEGORIES: { key: CategoryKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'hand', label: 'Hands' },
    { key: 'tournament', label: 'Tournaments' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'special', label: 'Special' },
  ];
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1">Achievements</h1>
    {#if claimableCount > 0}
      <span
        class="text-[10px] font-extrabold px-2 py-1 rounded-full"
        style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
      >
        {claimableCount} CLAIM
      </span>
    {/if}
  </div>

  {#if loading}
    <div class="space-y-3 px-4">
      {#each Array(4) as _}
        <div class="rounded-2xl p-4 h-[100px] shimmer"
             style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"></div>
      {/each}
    </div>
  {:else if error}
    <div class="mx-4 rounded-2xl p-4 text-center"
         style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);">
      <p class="text-sm text-red-300 font-bold">{error}</p>
      <button on:click={load} class="mt-2 text-[11px] text-gold font-bold">Retry</button>
    </div>
  {:else}
    <!-- HERO STATS -->
    <div class="mx-4 rounded-3xl p-5 mb-4 relative overflow-hidden"
         style="
           background:
             radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.25) 0%, transparent 60%),
             linear-gradient(180deg, rgba(30,58,138,0.4) 0%, rgba(15,31,58,0.85) 50%, rgba(7,14,27,0.95) 100%);
           border: 1.5px solid rgba(212,175,55,0.4);
           box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.15);
         ">
      <div class="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 pointer-events-none"
           style="background: radial-gradient(circle, #d4af37, transparent 70%);"></div>

      <div class="relative">
        <p class="text-[10px] uppercase tracking-widest text-gold/80 font-bold mb-1">Progress</p>
        <div class="flex items-baseline gap-2 mb-4">
          <span class="text-4xl font-extrabold text-white tabular-nums leading-none">{unlockedCount}</span>
          <span class="text-lg text-white/50 font-bold">/ {totalCount}</span>
        </div>

        <div class="w-full h-2.5 rounded-full overflow-hidden mb-2" style="background: rgba(0,0,0,0.55);">
          <div class="h-full rounded-full transition-all"
               style="
                 width: {completionPct}%;
                 background: linear-gradient(90deg, #f4e5a8 0%, #d4af37 50%, #a87a15 100%);
                 box-shadow: 0 0 12px rgba(212,175,55,0.7);
               "></div>
        </div>
        <div class="flex justify-between text-[10px] text-white/50">
          <span>{completionPct}% complete</span>
          {#if claimableCount > 0}
            <span class="text-gold font-bold">{claimableCount} reward{claimableCount > 1 ? 's' : ''} to claim</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- FILTERS -->
    <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1 px-4">
      {#each CATEGORIES as c}
        <button
          on:click={() => (activeFilter = c.key)}
          class="shrink-0 px-3.5 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
          style="
            background: {activeFilter === c.key
              ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
              : 'rgba(15,31,58,0.7)'};
            color: {activeFilter === c.key ? '#0a0800' : 'rgba(255,255,255,0.7)'};
            border: 1px solid {activeFilter === c.key ? 'transparent' : 'rgba(212,175,55,0.2)'};
          "
        >
          {c.label}
        </button>
      {/each}
    </div>

    <!-- LIST -->
    <div class="space-y-2.5 px-4">
      {#each filtered as a}
        {@const pct = Math.min(100, (a.progress / a.threshold) * 100)}
        <div
          class="rounded-2xl p-3.5 flex items-center gap-3 relative overflow-hidden"
          style="
            background: {a.unlocked
              ? 'linear-gradient(135deg, rgba(244,201,93,0.12), rgba(168,121,34,0.04))'
              : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
            border: 1.5px solid {a.unlocked
              ? 'rgba(244,201,93,0.5)'
              : 'rgba(255,255,255,0.06)'};
            {a.unlocked
              ? 'box-shadow: 0 0 18px rgba(244,201,93,0.25), inset 0 1px 0 rgba(255,255,255,0.05);'
              : ''}
          "
        >
          {#if a.unlocked}
            <div class="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 pointer-events-none"
                 style="background: radial-gradient(circle, #f4c95d, transparent 70%);"></div>
          {/if}

          <!-- Badge icon -->
          <div
            class="relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
            style="
              background: {a.unlocked
                ? 'radial-gradient(ellipse at 50% 40%, rgba(244,201,93,0.4) 0%, rgba(168,121,34,0.15) 60%, transparent 100%), linear-gradient(180deg, #1a2a4a, #0a1428)'
                : 'linear-gradient(180deg, rgba(30,42,74,0.6), rgba(10,20,40,0.8))'};
              border: 1.5px solid {a.unlocked ? 'rgba(244,201,93,0.7)' : 'rgba(255,255,255,0.12)'};
              {a.unlocked ? 'box-shadow: 0 0 20px rgba(244,201,93,0.4), inset 0 1px 0 rgba(255,255,255,0.15);' : 'box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);'}
            "
          >
            <img
              src={a.icon}
              alt=""
              class="w-14 h-14 object-contain relative"
              style="
                filter: {a.unlocked
                  ? 'drop-shadow(0 2px 8px rgba(244,201,93,0.8)) drop-shadow(0 0 12px rgba(244,201,93,0.4)) brightness(1.15) contrast(1.1)'
                  : 'grayscale(1) opacity(0.4)'};
              "
            />

            {#if !a.unlocked}
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="background: rgba(5,8,15,0.55); backdrop-filter: blur(1px);">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
            {/if}
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0 relative">
            <div class="flex items-center gap-2 mb-0.5">
              <p class="text-sm font-extrabold truncate" style="color: {a.unlocked ? '#fff' : 'rgba(255,255,255,0.65)'};">
                {a.name}
              </p>
              {#if a.unlocked && !a.claimed}
                <span class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse" style="background: rgba(16,185,129,0.3); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.5);">
                  NEW
                </span>
              {/if}
            </div>
            <p class="text-[10px] text-white/50 truncate">{a.description}</p>

            {#if !a.unlocked && a.progress > 0}
              <div class="mt-2 flex items-center gap-2">
                <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.5);">
                  <div class="h-full rounded-full transition-all"
                       style="width: {pct}%; background: linear-gradient(90deg, #3b82f6, #60a5fa);"></div>
                </div>
                <span class="text-[9px] font-mono text-white/50 tabular-nums shrink-0">
                  {a.progress}/{a.threshold}
                </span>
              </div>
            {:else if a.unlocked}
              <div class="mt-1.5 flex items-center gap-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span class="text-[9px] text-emerald-400 font-bold">Unlocked</span>
                {#if a.rewardChips > 0}
                  <span class="text-[9px] text-gold font-bold">· +{a.rewardChips} chips</span>
                {/if}
                {#if a.rewardUsd > 0}
                  <span class="text-[9px] text-gold font-bold">· +${a.rewardUsd}</span>
                {/if}
              </div>
            {:else}
              <div class="mt-1.5 text-[9px] text-white/35 font-mono">
                Target: {a.threshold}
              </div>
            {/if}
          </div>

          <!-- Action -->
          <div class="shrink-0 ml-1">
            {#if a.unlocked && !a.claimed && (a.rewardChips > 0 || a.rewardUsd > 0)}
              <button
                on:click={() => claim(a.code)}
                disabled={claiming === a.code}
                class="rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider disabled:opacity-40 active:scale-95 transition"
                style="
                  background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
                  color: #0a0800;
                  box-shadow: 0 2px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.4);
                "
              >
                {claiming === a.code ? '…' : 'Claim'}
              </button>
            {:else if a.unlocked}
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center"
                style="background: linear-gradient(180deg, rgba(244,201,93,0.25), rgba(168,121,34,0.1)); border: 1.5px solid rgba(244,201,93,0.5);"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f4c95d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            {:else}
              <div
                class="w-9 h-9 rounded-xl flex items-center justify-center"
                style="background: rgba(0,0,0,0.35); border: 1.5px solid rgba(255,255,255,0.08);"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if filtered.length === 0}
        <div class="rounded-3xl p-8 text-center"
             style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px solid rgba(212,175,55,0.15);">
          <img src="/badges/tourney-win.png" alt="" class="w-16 h-16 mx-auto mb-3 opacity-40 object-contain" />
          <p class="text-white/50 text-sm font-bold">No achievements in this category</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%]"
      style="background: rgba(8,13,36,0.96); border: 1px solid rgba(212,175,55,0.5); box-shadow: 0 8px 24px rgba(0,0,0,0.7);"
    >
      <p class="text-xs font-extrabold text-white">{toast}</p>
    </div>
  {/if}
</div>