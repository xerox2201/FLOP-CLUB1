<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let initialVariant: string = 'all';
  export let initialMode: 'all' | 'free' | 'real' = 'all';
  export let onOpenTable: (id: number) => void = () => {};

  let tables: any[] = [];
  let loading = true;
  let error = '';
  let refreshing = false;

  let filterMode: 'all' | 'free' | 'real' = initialMode;
  let filterVariant: 'all' | 'holdem' | 'omaha4' | 'omaha5' = initialVariant as any;
  let sortBy: 'active' | 'fullness' | 'blinds' | 'id' = 'active';

  let pollTimer: any = null;

  async function loadTables(manual = false) {
    if (manual) refreshing = true;
    try {
      const res = await api.tables();
      if (res.ok && res.data) {
        tables = res.data.tables;
        error = '';
      } else {
        error = res.error || 'failed to load';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
      if (manual) setTimeout(() => (refreshing = false), 400);
    }
  }

  onMount(() => {
    loadTables();
    pollTimer = setInterval(() => loadTables(), 5000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  // ─── helpers ───
  function live(t: any): number {
    return Number(t.livePlayers ?? 0);
  }
  function max(t: any): number {
    return Number(t.maxSeats ?? t.seats ?? 6);
  }
  function ratio(t: any): number {
    const m = max(t);
    return m > 0 ? live(t) / m : 0;
  }
  function variantLabel(v: string): string {
    if (v === 'holdem') return "Hold'em";
    if (v === 'omaha4') return 'Omaha 4';
    if (v === 'omaha5') return 'Omaha 5';
    return v;
  }
  function variantColor(v: string): string {
    if (v === 'holdem') return '#3b82f6';
    if (v === 'omaha4') return '#ef4444';
    if (v === 'omaha5') return '#10b981';
    return '#d4af37';
  }
  function fmtBlind(v: any): string {
    const n = Number(v ?? 0);
    if (n === Math.floor(n)) return String(n);
    return n.toFixed(2).replace(/\.?0+$/, '');
  }
  function seatStatus(l: number, m: number): { color: string; label: string } {
    if (m <= 0) return { color: '#6b7280', label: '—' };
    if (l >= m) return { color: '#ef4444', label: 'FULL' };
    if (l === 0) return { color: '#6b7280', label: 'EMPTY' };
    if (l >= m - 1) return { color: '#f59e0b', label: '1 LEFT' };
    if (l >= Math.ceil(m / 2)) return { color: '#10b981', label: 'HOT' };
    return { color: '#22d3ee', label: 'OPEN' };
  }

  // ─── filter + sort ───
  $: filtered = tables
    .filter((t) => filterMode === 'all' || t.mode === filterMode)
    .filter((t) => filterVariant === 'all' || t.variant === filterVariant)
    .sort((a, b) => {
      if (sortBy === 'id') return Number(a.id) - Number(b.id);
      if (sortBy === 'blinds') return Number(b.blinds?.bb ?? 0) - Number(a.blinds?.bb ?? 0);
      if (sortBy === 'fullness') {
        const diff = ratio(b) - ratio(a);
        if (diff !== 0) return diff;
        return Number(a.id) - Number(b.id);
      }
      // active
      const la = live(a);
      const lb = live(b);
      if (la > 0 && lb === 0) return -1;
      if (la === 0 && lb > 0) return 1;
      if (la !== lb) return lb - la;
      return Number(a.id) - Number(b.id);
    });

  $: totalPlayers = filtered.reduce((s, t) => s + live(t), 0);
  $: totalActive = filtered.filter((t) => live(t) > 0).length;
  $: totalSeatsOpen = filtered.reduce((s, t) => s + Math.max(0, max(t) - live(t)), 0);

  // ─── sort cycle ───
  const SORTS: { key: 'active' | 'fullness' | 'blinds' | 'id'; label: string; icon: string }[] = [
    { key: 'active', label: 'Active', icon: 'fire' },
    { key: 'fullness', label: 'Fullness', icon: 'users' },
    { key: 'blinds', label: 'Blinds', icon: 'dollar' },
    { key: 'id', label: 'ID', icon: 'menu' },
  ];
  function cycleSort() {
    const idx = SORTS.findIndex((s) => s.key === sortBy);
    sortBy = SORTS[(idx + 1) % SORTS.length].key;
  }
  $: currentSort = SORTS.find((s) => s.key === sortBy) || SORTS[0];
</script>

<div class="pb-28 lg:pb-8">
  <TopBar />

  <!-- HEADER -->
  <div class="px-4 mt-2 mb-3">
    <div class="flex items-start justify-between mb-2">
      <div>
        <h1 class="text-2xl font-extrabold text-white leading-none">Tables</h1>
        <p class="text-[11px] text-white/45 mt-1">Pick a table and join the action</p>
      </div>
      <button
        on:click={() => loadTables(true)}
        aria-label="Refresh"
        class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all shrink-0"
        style="
          background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.08));
          border: 1px solid rgba(212,175,55,0.45);
          box-shadow: 0 0 12px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.06);
        "
      >
        <div class={refreshing ? 'animate-spin' : ''}>
          <Icon name="refresh" size={16} color="#f4c95d" />
        </div>
      </button>
    </div>

    <!-- Live stats bar -->
    <div
      class="flex items-center gap-3 px-3 py-2 rounded-xl"
      style="background: rgba(15,31,58,0.55); border: 1px solid rgba(255,255,255,0.06);"
    >
      <div class="flex items-center gap-1.5">
        <span
          class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
          style="box-shadow: 0 0 6px #34d399;"
        ></span>
        <span class="text-[12px] font-extrabold text-emerald-300 tabular-nums">{totalPlayers}</span>
        <span class="text-[10px] text-white/45 font-bold uppercase tracking-wider">playing</span>
      </div>
      <span class="w-px h-3" style="background: rgba(255,255,255,0.12);"></span>
      <div class="flex items-center gap-1.5">
        <span class="text-[12px] font-extrabold text-gold tabular-nums">{totalActive}</span>
        <span class="text-[10px] text-white/45 font-bold uppercase tracking-wider">active</span>
      </div>
      <span class="w-px h-3" style="background: rgba(255,255,255,0.12);"></span>
      <div class="flex items-center gap-1.5">
        <span class="text-[12px] font-extrabold text-cyan-300 tabular-nums">{totalSeatsOpen}</span>
        <span class="text-[10px] text-white/45 font-bold uppercase tracking-wider">open</span>
      </div>
    </div>
  </div>

  <!-- MODE FILTER -->
  <div class="flex gap-1.5 px-4 mb-2 overflow-x-auto no-scrollbar">
    {#each [{ k: 'all', l: 'All Games', icon: 'target', color: '#d4af37' }, { k: 'free', l: 'Free Play', icon: 'gift', color: '#10b981' }, { k: 'real', l: 'Real Money', icon: 'dollar', color: '#f4c95d' }] as f}
      <button
        on:click={() => (filterMode = f.k as any)}
        class="shrink-0 px-3 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 active:scale-95"
        style="
          background: {filterMode === f.k
          ? `linear-gradient(180deg, ${f.color}, ${f.color}cc)`
          : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
          color: {filterMode === f.k ? '#0a0800' : 'rgba(255,255,255,0.65)'};
          border: 1px solid {filterMode === f.k ? f.color : 'rgba(212,175,55,0.15)'};
        "
      >
        <Icon name={f.icon} size={12} color={filterMode === f.k ? '#0a0800' : f.color} />
        <span>{f.l}</span>
      </button>
    {/each}
  </div>

  <!-- VARIANT + SORT -->
  <div class="flex items-center gap-1.5 px-4 mb-4">
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
      {#each [{ k: 'all', l: 'All', color: '#d4af37' }, { k: 'holdem', l: "Hold'em", color: '#3b82f6' }, { k: 'omaha4', l: 'Omaha 4', color: '#ef4444' }, { k: 'omaha5', l: 'Omaha 5', color: '#10b981' }] as f}
        <button
          on:click={() => (filterVariant = f.k as any)}
          class="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all active:scale-95"
          style="
            background: {filterVariant === f.k
            ? `linear-gradient(180deg, ${f.color}30, ${f.color}15)`
            : 'rgba(15,31,58,0.55)'};
            color: {filterVariant === f.k ? f.color : 'rgba(255,255,255,0.5)'};
            border: 1px solid {filterVariant === f.k ? f.color + '80' : 'rgba(255,255,255,0.06)'};
          "
        >
          {f.l}
        </button>
      {/each}
    </div>

    <button
      on:click={cycleSort}
      class="shrink-0 rounded-lg px-2.5 py-1.5 flex items-center gap-1 active:scale-95 transition-all"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.35);"
      aria-label="Change sort"
    >
      <Icon name={currentSort.icon} size={11} color="#c4b5fd" />
      <span class="text-[10px] font-extrabold text-violet-300">{currentSort.label}</span>
    </button>
  </div>

  <!-- LIST -->
  {#if loading}
    <div class="px-4 space-y-2.5">
      {#each Array(4) as _}
        <div
          class="rounded-2xl h-[110px]"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else if error && tables.length === 0}
    <div class="px-4">
      <div
        class="rounded-2xl p-4 text-center"
        style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35);"
      >
        <p class="text-sm text-red-300 font-bold">{error}</p>
        <button on:click={() => loadTables(true)} class="mt-2 text-[11px] text-gold font-bold">
          Retry
        </button>
      </div>
    </div>
  {:else if filtered.length === 0}
    <div class="px-4">
      <div
        class="rounded-2xl p-8 text-center"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.1) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(212,175,55,0.3);
        "
      >
        <div class="flex justify-center mb-3">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center"
            style="background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);"
          >
            <Icon name="search" size={22} color="#d4af37" />
          </div>
        </div>
        <p class="text-sm font-bold text-white/75">No tables match your filters</p>
        <p class="text-[11px] text-white/45 mt-1">Try a different variant or mode</p>
        <button
          on:click={() => {
            filterMode = 'all';
            filterVariant = 'all';
          }}
          class="mt-4 px-4 py-2 rounded-xl text-[11px] font-extrabold active:scale-95"
          style="
            background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
            color: #0a0800;
            box-shadow: 0 2px 0 #7a560a;
          "
        >
          Reset filters
        </button>
      </div>
    </div>
  {:else}
    <div class="px-4 space-y-2.5">
      {#each filtered as table (table.id)}
        {@const accent = variantColor(table.variant)}
        {@const isFree = table.mode === 'free'}
        {@const l = live(table)}
        {@const m = max(table)}
        {@const status = seatStatus(l, m)}
        {@const sb = table.blinds?.sb ?? 0}
        {@const bb = table.blinds?.bb ?? 0}
        {@const ante = table.blinds?.ante ?? 0}

        <button
          on:click={() => onOpenTable(table.id)}
          class="w-full text-left rounded-2xl active:scale-[0.98] transition-all relative overflow-hidden"
          style="
            background:
              radial-gradient(ellipse at 100% 0%, {accent}15 0%, transparent 50%),
              linear-gradient(135deg, rgba(15,31,58,0.85) 0%, rgba(7,14,27,0.95) 100%);
            border: 1.5px solid {l > 0 ? accent + '50' : 'rgba(255,255,255,0.06)'};
            box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
          "
        >
          <!-- Left accent stripe -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1"
            style="background: linear-gradient(180deg, {accent}, {accent}66);"
          ></div>

          <div class="pl-4 pr-3 py-3">
            <!-- Top: badges row -->
            <div class="flex items-center gap-1.5 mb-2">
              <span
                class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style="background: {accent}20; color: {accent}; border: 1px solid {accent}50;"
              >
                {variantLabel(table.variant)}
              </span>
              <span
                class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style="
                  background: {isFree ? 'rgba(16,185,129,0.18)' : 'rgba(244,201,93,0.18)'};
                  color: {isFree ? '#6ee7b7' : '#f4c95d'};
                  border: 1px solid {isFree ? 'rgba(16,185,129,0.4)' : 'rgba(244,201,93,0.4)'};
                "
              >
                {isFree ? 'Free' : 'Real'}
              </span>
              <span class="ml-auto text-[9px] text-white/50 font-mono font-bold">#{table.id}</span>
            </div>

            <!-- Middle: name + status -->
            <div class="flex items-center gap-2 mb-2">
              <p class="text-[14px] font-extrabold text-white truncate flex-1 leading-tight">
                {table.name}
              </p>
              <div class="shrink-0 flex items-center gap-2">
                <span
                  class="w-2.5 h-2.5 rounded-full"
                  style="background: {status.color}; box-shadow: 0 0 10px {status.color};"
                ></span>
                <span
                  class="text-[10px] font-extrabold uppercase tracking-wider"
                  style="color: {status.color};"
                >
                  {status.label}
                </span>
              </div>
            </div>

            <!-- Bottom: blinds + seats -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-[10px] text-white/40 uppercase tracking-wider font-bold">
                  Blinds
                </span>
                <span
                  class="text-[12px] font-extrabold text-cyan-300 tabular-nums whitespace-nowrap"
                >
                  ${fmtBlind(sb)}<span class="text-white/40 mx-0.5">/</span>${fmtBlind(bb)}
                </span>
                {#if Number(ante) > 0}
                  <span class="text-[10px] text-white/40 font-mono">+a{fmtBlind(ante)}</span>
                {/if}
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <div class="flex gap-0.5">
                  {#each Array(m) as _, i}
                    <span
                      class="w-[3px] h-3.5 rounded-sm transition-all"
                      style="
                        background: {i < l ? status.color : 'rgba(255,255,255,0.10)'};
                        box-shadow: {i < l ? `0 0 4px ${status.color}80` : 'none'};
                      "
                    ></span>
                  {/each}
                </div>
                <span
                  class="text-[11px] font-extrabold tabular-nums"
                  style="color: {status.color};"
                >
                  {l}<span class="text-white/55 font-bold">/{m}</span>
                </span>
              </div>
            </div>

            {#if !isFree && Number(table.minBuyIn) > 0}
              <div
                class="flex items-center gap-1 mt-2 pt-2"
                style="border-top: 1px solid rgba(255,255,255,0.05);"
              >
                <Icon name="dollar" size={10} color="rgba(244,201,93,0.6)" />
                <span class="text-[9px] text-white/40 font-bold uppercase tracking-wider">
                  Min buy-in
                </span>
                <span class="text-[10px] font-extrabold text-gold tabular-nums">
                  ${Number(table.minBuyIn).toFixed(0)}
                </span>
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
