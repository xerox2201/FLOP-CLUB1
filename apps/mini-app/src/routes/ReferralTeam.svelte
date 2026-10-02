<script lang="ts">
  import { formatAmount } from '../lib/format';
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};
  export let onNavigate: (page: any) => void = () => {};

  let loading = true;
  let error = '';
  let data: { direct: any[]; indirect: any[] } = { direct: [], indirect: [] };
  let tab: 'direct' | 'indirect' = 'direct';

  function fmt(n: any, digits = 2): string {
    return formatAmount(n, digits);
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'Just now';
      if (min < 60) return `${min}m ago`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 30) return `${days}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso ?? '—';
    }
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<{ direct: any[]; indirect: any[] }>('/api/referral/team');
      if (res.ok && res.data) data = res.data;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  $: activeDirect = data.direct.filter((d) => d.isActive).length;
  $: totalDirect = data.direct.length;

  onMount(load);
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
      <Icon name="users" size={22} color="#f4c95d" />
      <span>My Team</span>
    </h1>
  </div>

  <!-- Summary -->
  {#if !loading && !error}
    <div class="px-4 mb-3">
      <div class="grid grid-cols-3 gap-2">
        <div
          class="rounded-2xl p-3 text-center"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(244,201,93,0.3);"
        >
          <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Total</p>
          <p class="text-xl font-extrabold text-white tabular-nums leading-none">{totalDirect}</p>
        </div>
        <div
          class="rounded-2xl p-3 text-center"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(16,185,129,0.3);"
        >
          <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Active</p>
          <p class="text-xl font-extrabold text-emerald-400 tabular-nums leading-none">
            {activeDirect}
          </p>
        </div>
        <div
          class="rounded-2xl p-3 text-center"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(37,99,235,0.3);"
        >
          <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Indirect</p>
          <p class="text-xl font-extrabold text-blue-300 tabular-nums leading-none">
            {data.indirect.length}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="flex gap-1.5 px-4 mb-3">
    <button
      on:click={() => (tab = 'direct')}
      class="flex-1 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider active:scale-95 transition-all"
      style="
        background: {tab === 'direct'
        ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
        : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
        color: {tab === 'direct' ? '#0a0800' : 'rgba(255,255,255,0.65)'};
        border: 1px solid {tab === 'direct' ? 'transparent' : 'rgba(212,175,55,0.15)'};
      "
    >
      Direct ({totalDirect})
    </button>
    <button
      on:click={() => (tab = 'indirect')}
      class="flex-1 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider active:scale-95 transition-all"
      style="
        background: {tab === 'indirect'
        ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
        : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
        color: {tab === 'indirect' ? '#0a0800' : 'rgba(255,255,255,0.65)'};
        border: 1px solid {tab === 'indirect' ? 'transparent' : 'rgba(212,175,55,0.15)'};
      "
    >
      Indirect ({data.indirect.length})
    </button>
  </div>

  {#if loading}
    <div class="px-4 space-y-2">
      {#each Array(3) as _}
        <div class="rounded-2xl h-[72px]" style="background: rgba(15,31,58,0.6);"></div>
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
  {:else if tab === 'direct'}
    {#if data.direct.length === 0}
      <div
        class="mx-4 rounded-2xl p-6 text-center"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px dashed rgba(212,175,55,0.3);"
      >
        <div class="flex justify-center mb-3">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center"
            style="background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);"
          >
            <Icon name="users" size={24} color="#d4af37" />
          </div>
        </div>
        <p class="text-sm font-extrabold text-white">No direct referrals yet</p>
        <p class="text-[11px] text-white/50 mt-1">Share your link to invite friends</p>
        <button
          on:click={() => onNavigate('referral')}
          class="mt-3 px-4 py-2 rounded-xl text-[11px] font-extrabold active:scale-95"
          style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 2px 0 #7a560a;"
        >
          Get link
        </button>
      </div>
    {:else}
      <div class="px-4 space-y-1.5">
        {#each data.direct as d}
          <div
            class="rounded-2xl p-3 flex items-center gap-3"
            style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid {d.isActive
              ? 'rgba(16,185,129,0.3)'
              : 'rgba(255,255,255,0.06)'};"
          >
            <!-- Avatar -->
            <div class="relative shrink-0">
              <div
                class="w-11 h-11 rounded-full overflow-hidden"
                style="background: radial-gradient(circle, #1a3a5c, #05080f); border: 2px solid {d.isActive
                  ? '#10b981'
                  : 'rgba(255,255,255,0.1)'};"
              >
                <img
                  src="/avatars/avatar-{d.avatarId || 'king'}.png"
                  alt={d.displayName}
                  class="w-full h-full object-cover"
                  style="transform: scale(1.15);"
                  draggable="false"
                />
              </div>
              {#if d.isActive}
                <span
                  class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                  style="background: #10b981; border: 2px solid #05080f; box-shadow: 0 0 6px #10b981;"
                ></span>
              {/if}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-[12px] font-extrabold text-white truncate">{d.displayName}</p>
                {#if !d.isActive}
                  <span
                    class="text-[8px] font-bold text-white/40 px-1.5 py-0.5 rounded-full"
                    style="background: rgba(255,255,255,0.06);">INACTIVE</span
                  >
                {/if}
              </div>
              <p class="text-[9px] text-white/45 mt-0.5">
                Joined {fmtDate(d.joinedAt)} · Last active {fmtDate(d.lastActiveAt)}
              </p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[9px] text-white/50 font-mono tabular-nums">
                  rake ${fmt(d.rakeFrom)}
                </span>
                <span class="text-white/20 text-[9px]">·</span>
                <span class="text-[9px] text-cyan-300 font-mono tabular-nums">
                  LVL {Math.floor(d.lifetimeXp / 1000) + 1}
                </span>
              </div>
            </div>

            <!-- Earnings -->
            <div class="text-right shrink-0">
              <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums">
                +${fmt(d.earned)}
              </p>
              <p class="text-[9px] text-white/40 mt-0.5">earned</p>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if data.indirect.length === 0}
    <div
      class="mx-4 rounded-2xl p-6 text-center"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px dashed rgba(37,99,235,0.3);"
    >
      <div class="flex justify-center mb-3">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center"
          style="background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.3);"
        >
          <Icon name="users" size={24} color="#60a5fa" />
        </div>
      </div>
      <p class="text-sm font-extrabold text-white">No indirect referrals yet</p>
      <p class="text-[11px] text-white/50 mt-1 leading-relaxed max-w-[240px] mx-auto">
        When your direct referrals invite their own friends, you'll see them here.
      </p>
    </div>
  {:else}
    <div class="px-4 space-y-1.5">
      {#each data.indirect as g}
        <div
          class="rounded-2xl p-3.5"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(37,99,235,0.25);"
        >
          <div class="flex items-center gap-2 mb-2">
            <Icon name="users" size={14} color="#60a5fa" />
            <p class="text-[12px] font-extrabold text-white flex-1 truncate">
              via <span class="text-blue-300">{g.viaName}</span>
            </p>
            <span class="text-[11px] font-extrabold text-blue-300 tabular-nums">
              {g.count}
              {g.count === 1 ? 'friend' : 'friends'}
            </span>
          </div>
          <div class="flex items-center gap-3 text-[10px]">
            <div>
              <p class="text-white/40 uppercase tracking-wider font-bold text-[8px]">Rake</p>
              <p class="text-white/80 font-mono tabular-nums">${fmt(g.totalRake)}</p>
            </div>
            <div class="ml-auto text-right">
              <p class="text-white/40 uppercase tracking-wider font-bold text-[8px]">Earned</p>
              <p class="text-emerald-400 font-extrabold tabular-nums">+${fmt(g.totalEarned)}</p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
