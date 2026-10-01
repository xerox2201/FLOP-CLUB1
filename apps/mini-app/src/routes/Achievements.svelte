<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
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
  type ToastKind = 'success' | 'error';
  let toast: { message: string; kind: ToastKind } | null = null;
  let toastTimer: any = null;
  type CategoryKey = 'all' | 'hand' | 'tournament' | 'wallet' | 'special';
  let activeFilter: CategoryKey = 'all';
  let claiming: string | null = null;

  function token(): string | null {
    return localStorage.getItem('token');
  }

  function showToast(message: string, kind: ToastKind) {
    toast = { message, kind };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 3000);
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
        showToast('Reward claimed!', 'success');
        await load();
        await auth.refresh();
      } else {
        showToast(data.error || 'Claim failed', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      claiming = null;
    }
  }

  onMount(load);

  $: filtered =
    activeFilter === 'all' ? achievements : achievements.filter((a) => a.category === activeFilter);

  $: unlockedCount = achievements.filter((a) => a.unlocked).length;
  $: totalCount = achievements.length;
  $: claimableCount = achievements.filter((a) => a.unlocked && !a.claimed).length;
  $: completionPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  $: inProgressCount = achievements.filter((a) => !a.unlocked && a.progress > 0).length;

  const CATEGORIES: { key: CategoryKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'hand', label: 'Hands' },
    { key: 'tournament', label: 'Tournaments' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'special', label: 'Special' },
  ];

  const CATEGORY_ACCENT: Record<string, string> = {
    hand: '#f4c95d',
    tournament: '#8b5cf6',
    wallet: '#10b981',
    special: '#22d3ee',
  };

  const CATEGORY_LABEL: Record<string, string> = {
    hand: 'Hands',
    tournament: 'Tournaments',
    wallet: 'Wallet',
    special: 'Special',
  };
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition"
      style="
        background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7));
        border: 1.5px solid rgba(96,165,250,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      "
    >
      <Icon name="arrow-left" size={18} color="#ffffff" />
    </button>

    <div
      class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
      style="
        background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
        border: 1.5px solid rgba(244,201,93,0.55);
        box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(244,201,93,0.2);
      "
    >
      <Icon name="trophy" size={24} color="#f4c95d" />
    </div>

    <div class="flex-1 min-w-0">
      <h1
        class="text-[24px] font-extrabold leading-none tracking-tight"
        style="
          background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px rgba(244,201,93,0.4));
        "
      >
        Achievements
      </h1>
      <p class="text-[10px] text-white/45 mt-1.5 font-bold">
        Collect badges, claim your chip rewards
      </p>
    </div>

    {#if claimableCount > 0}
      <span
        class="text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
        style="
          background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
          color: #0a0800;
          box-shadow: 0 2px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.4);
        "
      >
        {claimableCount} CLAIM
      </span>
    {/if}
  </div>

  {#if loading}
    <!-- ============ LOADING SKELETON ============ -->
    <div class="px-4">
      <div class="grid grid-cols-2 gap-2 mb-4">
        {#each Array(4) as _}
          <div
            class="rounded-2xl h-[64px] shimmer"
            style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
          ></div>
        {/each}
      </div>
      <div class="space-y-2.5">
        {#each Array(4) as _}
          <div
            class="rounded-2xl h-[96px] shimmer"
            style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
          ></div>
        {/each}
      </div>
    </div>
  {:else if error}
    <!-- ============ ERROR ============ -->
    <div class="px-4">
      <div
        class="rounded-2xl p-5 text-center"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.15) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
          border: 1px solid rgba(239,68,68,0.35);
        "
      >
        <div class="flex justify-center mb-2.5">
          <div
            class="w-11 h-11 rounded-2xl flex items-center justify-center"
            style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35);"
          >
            <Icon name="alert" size={20} color="#fca5a5" />
          </div>
        </div>
        <p class="text-sm font-extrabold text-red-300">{error}</p>
        <p class="text-[10px] text-white/45 mt-1 font-bold">Could not load your achievements</p>
        <button
          on:click={load}
          class="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-extrabold active:scale-95 transition"
          style="
            background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
            color: #0a0800;
            box-shadow: 0 2px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.4);
          "
        >
          <Icon name="refresh" size={12} color="#0a0800" />
          <span>Retry</span>
        </button>
      </div>
    </div>
  {:else if totalCount === 0}
    <!-- ============ EMPTY (NO DATA) ============ -->
    <div class="px-4">
      <div
        class="rounded-2xl p-6 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(212,175,55,0.3);
        "
      >
        <div class="flex justify-center mb-3">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center"
            style="
              background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.25), rgba(168,121,34,0.08));
              border: 1px solid rgba(244,201,93,0.4);
            "
          >
            <Icon name="trophy" size={26} color="#f4c95d" />
          </div>
        </div>
        <p class="text-sm font-extrabold text-white">No achievements yet</p>
        <p class="text-[11px] text-white/55 mt-1 font-bold">
          Play hands and tournaments to start earning badges
        </p>
      </div>
    </div>
  {:else}
    <!-- ============ SUMMARY GRID ============ -->
    <div class="grid grid-cols-2 gap-2 px-4 mb-3">
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(16,185,129,0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
          >
            <Icon name="success" size={12} color="#6ee7b7" />
          </div>
          <span class="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider">
            Unlocked
          </span>
        </div>
        <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">
          {unlockedCount}
          <span class="text-[11px] text-white/40 font-bold">/ {totalCount}</span>
        </p>
        <p class="text-[9px] text-white/45 mt-1 font-bold">
          {inProgressCount} in progress
        </p>
      </div>

      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.15) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(244,201,93,0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style="background: rgba(244,201,93,0.2); border: 1px solid rgba(244,201,93,0.4);"
          >
            <Icon name="gift" size={12} color="#f4c95d" />
          </div>
          <span class="text-[9px] font-extrabold text-gold uppercase tracking-wider">
            Claimable
          </span>
        </div>
        <p
          class="text-[17px] font-extrabold tabular-nums leading-none"
          style="color: {claimableCount > 0 ? '#f4c95d' : 'rgba(255,255,255,0.5)'};"
        >
          {claimableCount}
        </p>
        <p class="text-[9px] text-white/45 mt-1 font-bold">
          {claimableCount > 0 ? 'Ready to collect' : 'Nothing pending'}
        </p>
      </div>
    </div>

    <!-- ============ PROGRESS ============ -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-4 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 0% 0%, rgba(139,92,246,0.15) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(139,92,246,0.3);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        "
      >
        <div class="flex items-center gap-2 mb-2.5">
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style="
              background: linear-gradient(180deg, rgba(139,92,246,0.3), rgba(109,40,217,0.12));
              border: 1px solid rgba(139,92,246,0.5);
            "
          >
            <Icon name="trending-up" size={15} color="#c4b5fd" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] uppercase tracking-widest font-extrabold text-violet-300">
              Collection Progress
            </p>
            <p class="text-[9px] text-white/45 font-bold">
              {unlockedCount} of {totalCount} badges unlocked
            </p>
          </div>
          <span class="text-[13px] font-extrabold tabular-nums" style="color: #c4b5fd;">
            {completionPct}%
          </span>
        </div>

        <div class="w-full h-2 rounded-full overflow-hidden" style="background: rgba(0,0,0,0.55);">
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {completionPct}%;
              background: linear-gradient(90deg, #f4e5a8 0%, #d4af37 50%, #a87a15 100%);
              box-shadow: 0 0 12px rgba(212,175,55,0.7);
            "
          ></div>
        </div>
      </div>
    </div>

    <!-- ============ FILTERS ============ -->
    <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1 px-4">
      {#each CATEGORIES as c}
        <button
          on:click={() => (activeFilter = c.key)}
          class="shrink-0 px-3.5 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider active:scale-95 transition"
          style="
            background: {activeFilter === c.key
            ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
            : 'rgba(15,31,58,0.7)'};
            color: {activeFilter === c.key ? '#0a0800' : 'rgba(255,255,255,0.7)'};
            border: 1px solid {activeFilter === c.key
            ? 'rgba(255,235,170,0.5)'
            : 'rgba(212,175,55,0.2)'};
            {activeFilter === c.key
            ? 'box-shadow: 0 2px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.35);'
            : ''}
          "
        >
          {c.label}
        </button>
      {/each}
    </div>

    <!-- ============ LIST ============ -->
    <div class="space-y-2.5 px-4">
      {#each filtered as a (a.id)}
        {@const pct = Math.min(100, (a.progress / a.threshold) * 100)}
        {@const accent = CATEGORY_ACCENT[a.category] ?? '#f4c95d'}
        <div
          class="rounded-2xl p-3.5 relative overflow-hidden"
          style="
            background: {a.unlocked
            ? 'linear-gradient(135deg, rgba(244,201,93,0.12), rgba(168,121,34,0.04))'
            : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
            border: 1px solid {a.unlocked ? 'rgba(244,201,93,0.5)' : 'rgba(255,255,255,0.07)'};
            box-shadow: {a.unlocked
            ? '0 8px 24px rgba(0,0,0,0.45), 0 0 18px rgba(244,201,93,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)'};
          "
        >
          {#if a.unlocked}
            <div
              class="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 pointer-events-none"
              style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
            ></div>
          {/if}

          <div class="flex items-start gap-3 relative">
            <!-- Badge artwork tile -->
            <div
              class="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
              style="
                background: {a.unlocked
                ? 'radial-gradient(ellipse at 50% 40%, rgba(244,201,93,0.35) 0%, rgba(168,121,34,0.12) 60%, transparent 100%), linear-gradient(180deg, #1a2a4a, #0a1428)'
                : 'linear-gradient(180deg, rgba(30,42,74,0.6), rgba(10,20,40,0.8))'};
                border: 1.5px solid {a.unlocked
                ? 'rgba(244,201,93,0.7)'
                : 'rgba(255,255,255,0.12)'};
                {a.unlocked
                ? 'box-shadow: 0 0 20px rgba(244,201,93,0.35), inset 0 1px 0 rgba(255,255,255,0.15);'
                : 'box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);'}
              "
            >
              <img
                src={a.icon}
                alt=""
                class="w-11 h-11 object-contain relative"
                style="
                  filter: {a.unlocked
                  ? 'drop-shadow(0 2px 8px rgba(244,201,93,0.8)) brightness(1.15) contrast(1.1)'
                  : 'grayscale(1) opacity(0.4)'};
                "
                draggable="false"
              />

              {#if !a.unlocked}
                <div
                  class="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style="background: rgba(5,8,15,0.55); backdrop-filter: blur(1px);"
                >
                  <Icon name="lock" size={18} color="rgba(255,255,255,0.7)" />
                </div>
              {/if}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <p
                  class="text-[13px] font-extrabold truncate max-w-full"
                  style="color: {a.unlocked ? '#ffffff' : 'rgba(255,255,255,0.65)'};"
                >
                  {a.name}
                </p>
                {#if a.unlocked && !a.claimed}
                  <span
                    class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse shrink-0"
                    style="background: rgba(16,185,129,0.3); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.5);"
                  >
                    NEW
                  </span>
                {/if}
              </div>

              <p class="text-[10px] text-white/50 leading-snug mt-0.5">{a.description}</p>

              <div class="flex items-center gap-1.5 mt-1.5">
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                  style="background: {accent}1f; color: {accent}; border: 1px solid {accent}45;"
                >
                  {CATEGORY_LABEL[a.category] ?? a.category}
                </span>
                {#if a.unlocked && a.rewardChips > 0}
                  <span
                    class="inline-flex items-center gap-1 text-[9px] text-gold font-bold shrink-0"
                  >
                    <Icon name="coin" size={10} color="#f4c95d" />
                    <span class="tabular-nums">+{a.rewardChips}</span>
                  </span>
                {/if}
                {#if a.unlocked && a.rewardUsd > 0}
                  <span
                    class="inline-flex items-center gap-1 text-[9px] text-gold font-bold shrink-0"
                  >
                    <Icon name="dollar" size={10} color="#f4c95d" />
                    <span class="tabular-nums">+{a.rewardUsd}</span>
                  </span>
                {/if}
              </div>

              {#if !a.unlocked && a.progress > 0}
                <div class="mt-2 flex items-center gap-2">
                  <div
                    class="flex-1 h-1.5 rounded-full overflow-hidden"
                    style="background: rgba(0,0,0,0.5);"
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      style="
                        width: {pct}%;
                        background: linear-gradient(90deg, #3b82f6, #60a5fa);
                        box-shadow: 0 0 8px rgba(96,165,250,0.6);
                      "
                    ></div>
                  </div>
                  <span class="text-[9px] font-mono text-white/50 tabular-nums shrink-0">
                    {a.progress}/{a.threshold}
                  </span>
                </div>
              {:else if a.unlocked}
                <div class="mt-1.5 flex items-center gap-1.5">
                  <Icon name="success" size={11} color="#6ee7b7" />
                  <span class="text-[9px] text-emerald-400 font-bold">Unlocked</span>
                  {#if a.claimed}
                    <span class="text-[9px] text-white/40 font-bold">Claimed</span>
                  {/if}
                </div>
              {:else}
                <div class="mt-1.5 flex items-center gap-1.5">
                  <Icon name="target" size={10} color="rgba(255,255,255,0.35)" />
                  <span class="text-[9px] text-white/35 font-mono">
                    Target: {a.threshold}
                  </span>
                </div>
              {/if}
            </div>

            <!-- Action -->
            <div class="shrink-0 flex items-center">
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
                  {claiming === a.code ? '...' : 'Claim'}
                </button>
              {:else if a.unlocked}
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center"
                  style="background: linear-gradient(180deg, rgba(244,201,93,0.25), rgba(168,121,34,0.1)); border: 1.5px solid rgba(244,201,93,0.5);"
                >
                  <Icon name="check" size={15} color="#f4c95d" />
                </div>
              {:else}
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center"
                  style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08);"
                >
                  <Icon name="lock" size={14} color="rgba(255,255,255,0.3)" />
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      {#if filtered.length === 0}
        <div
          class="rounded-2xl p-6 text-center relative overflow-hidden"
          style="
            background:
              radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.1) 0%, transparent 60%),
              linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
            border: 1px dashed rgba(212,175,55,0.25);
          "
        >
          <div class="flex justify-center mb-3">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center"
              style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
            >
              <Icon name="search" size={22} color="rgba(255,255,255,0.45)" />
            </div>
          </div>
          <p class="text-[13px] font-extrabold text-white/70">No achievements in this category</p>
          <p class="text-[10px] text-white/40 mt-1 font-bold">
            Try another filter to see more badges
          </p>
        </div>
      {/if}
    </div>
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%] flex items-center gap-2"
      style="
        background: rgba(8,13,36,0.96);
        border: 1px solid {toast.kind === 'success'
        ? 'rgba(16,185,129,0.5)'
        : 'rgba(239,68,68,0.5)'};
        box-shadow: 0 8px 24px rgba(0,0,0,0.7);
      "
    >
      <Icon
        name={toast.kind === 'success' ? 'success' : 'error'}
        size={14}
        color={toast.kind === 'success' ? '#6ee7b7' : '#fca5a5'}
      />
      <p class="text-xs font-extrabold text-white">{toast.message}</p>
    </div>
  {/if}
</div>
