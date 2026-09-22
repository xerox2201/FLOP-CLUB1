<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';

  export let initialVariant: string = 'all';
  export let initialMode: 'all' | 'free' | 'real' = 'all';
  export let onOpenTable: (id: number) => void = () => {};

  let tables: any[] = [];
  let loading = true;
  let error = '';
  let filterMode: 'all' | 'free' | 'real' = initialMode;
  let filterVariant: 'all' | 'holdem' | 'omaha4' | 'omaha5' = initialVariant as any;
  let filterStatus: 'all' | 'active' | 'has_seats' | 'empty' = 'all';
  let sortBy: 'fullness' | 'id' | 'blinds' = 'fullness';

  let pollTimer: any = null;

  async function loadTables() {
    try {
      const res = await api.tables();
      if (res.ok && res.data) tables = res.data.tables;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadTables();
    pollTimer = setInterval(loadTables, 3000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

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

  $: filtered = tables
    .filter((t) => filterMode === 'all' || t.mode === filterMode)
    .filter((t) => filterVariant === 'all' || t.variant === filterVariant)
    .filter((t) => {
      const l = live(t);
      const m = max(t);
      if (filterStatus === 'empty') return l === 0;
      if (filterStatus === 'active') return l >= 1;
      if (filterStatus === 'has_seats') return l < m;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'id') return Number(a.id) - Number(b.id);
      if (sortBy === 'blinds')
        return Number(b.blinds?.bb ?? 0) - Number(a.blinds?.bb ?? 0);
      const diff = ratio(b) - ratio(a);
      if (diff !== 0) return diff;
      return Number(a.id) - Number(b.id);
    });

  function variantSuit(v: string): string {
    if (v === 'holdem') return '/cards/suit-spade.png';
    if (v === 'omaha4') return '/cards/suit-diamond.png';
    if (v === 'omaha5') return '/cards/suit-club.png';
    return '/cards/suit-heart.png';
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
  function seatStatus(l: number, m: number): { color: string; label: string } {
    if (m <= 0) return { color: '#6b7280', label: '—' };
    if (l >= m) return { color: '#ef4444', label: 'FULL' };
    if (l === 0) return { color: '#6b7280', label: 'EMPTY' };
    if (l >= m - 1) return { color: '#f59e0b', label: 'ALMOST FULL' };
    return { color: '#10b981', label: 'OPEN' };
  }
  function fmtBlind(v: any): string {
    const n = Number(v ?? 0);
    if (n === Math.floor(n)) return String(n);
    return n.toFixed(2).replace(/\.?0+$/, '');
  }
</script>

<div class="px-4 pb-28">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center justify-between mt-3 mb-4">
    <div>
      <h1 class="text-2xl font-extrabold text-white">Tables</h1>
      <p class="text-[11px] text-white/50 mt-0.5">
        {filtered.length} of {tables.length} tables
      </p>
    </div>
    <button
      on:click={loadTables}
      aria-label="Refresh"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.25);"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2.5" stroke-linecap="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  </div>

  <!-- MODE FILTER -->
  <div
    class="rounded-2xl p-1 grid grid-cols-3 gap-1 mb-3"
    style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.15);"
  >
    {#each [{ k: 'all', l: 'All' }, { k: 'free', l: 'Free' }, { k: 'real', l: 'Real' }] as f}
      <button
        on:click={() => (filterMode = f.k as any)}
        class="py-2.5 rounded-xl text-xs font-extrabold transition-all uppercase tracking-wider"
        style="
          background: {filterMode === f.k
            ? f.k === 'free'
              ? 'linear-gradient(180deg, #34d399 0%, #10b981 45%, #047857 100%)'
              : 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
            : 'transparent'};
          color: {filterMode === f.k ? (f.k === 'free' ? '#ffffff' : '#0a0800') : 'rgba(255,255,255,0.6)'};
        "
      >
        {f.l}
      </button>
    {/each}
  </div>

  <!-- VARIANT FILTER -->
  <div class="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
    {#each [
      { k: 'all', l: 'All Games', c: '#d4af37' },
      { k: 'holdem', l: "Hold'em", c: '#3b82f6', icon: '/cards/suit-spade.png' },
      { k: 'omaha4', l: 'Omaha 4', c: '#ef4444', icon: '/cards/suit-diamond.png' },
      { k: 'omaha5', l: 'Omaha 5', c: '#10b981', icon: '/cards/suit-club.png' },
    ] as f}
      <button
        on:click={() => (filterVariant = f.k as any)}
        class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all inline-flex items-center gap-1.5"
        style="
          background: {filterVariant === f.k
            ? `linear-gradient(180deg, ${f.c}, ${f.c}bb)`
            : 'rgba(15,31,58,0.7)'};
          color: {filterVariant === f.k ? '#ffffff' : 'rgba(255,255,255,0.7)'};
          border: 1px solid {filterVariant === f.k ? f.c : 'rgba(212,175,55,0.2)'};
        "
      >
        {#if f.icon}<img src={f.icon} alt="" class="w-3.5 h-3.5 object-contain" />{/if}
        <span>{f.l}</span>
      </button>
    {/each}
  </div>

  <!-- STATUS + SORT -->
  <div class="grid grid-cols-2 gap-2 mb-4">
    <div>
      <p class="text-[9px] uppercase tracking-widest text-white/40 font-extrabold mb-1 px-1">Status</p>
      <div class="relative">
        <select
          bind:value={filterStatus}
          class="w-full rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none appearance-none pr-8"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.2);"
        >
          <option value="all">All</option>
          <option value="active">Active (≥1 player)</option>
          <option value="has_seats">Has open seats</option>
          <option value="empty">Empty only</option>
        </select>
        <svg class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>

    <div>
      <p class="text-[9px] uppercase tracking-widest text-white/40 font-extrabold mb-1 px-1">Sort by</p>
      <div class="relative">
        <select
          bind:value={sortBy}
          class="w-full rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none appearance-none pr-8"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.2);"
        >
          <option value="fullness">Fullness (full first)</option>
          <option value="blinds">Blinds (high first)</option>
          <option value="id">Table ID</option>
        </select>
        <svg class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  </div>

  <!-- LIST -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}
        <div class="rounded-2xl h-[110px]" style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"></div>
      {/each}
    </div>
  {:else if filtered.length === 0}
    <div class="rounded-3xl p-8 text-center" style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px solid rgba(212,175,55,0.15);">
      <div class="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center" style="background: linear-gradient(180deg, rgba(212,175,55,0.15), rgba(168,122,21,0.08)); border: 1px solid rgba(212,175,55,0.3);">
        <img src="/cards/suit-spade.png" alt="" class="w-8 h-8 object-contain opacity-70" />
      </div>
      <p class="text-white/60 text-sm font-bold">No tables match filters</p>
      <p class="text-white/40 text-[11px] mt-1">Try different filters</p>
    </div>
  {:else}
    <div class="space-y-2.5">
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
            background: linear-gradient(135deg, rgba(15,31,58,0.85) 0%, rgba(7,14,27,0.95) 100%);
            border: 1.5px solid {isFree ? 'rgba(16,185,129,0.25)' : 'rgba(212,175,55,0.3)'};
            box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
          "
        >
          <div class="absolute left-0 top-0 bottom-0 w-1" style="background: linear-gradient(180deg, {accent}, {accent}66);"></div>

          <div class="flex items-center gap-3 p-3 pl-4">
            <!-- Icon -->
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden"
              style="
                background: radial-gradient(ellipse at 50% 40%, {accent}25 0%, transparent 70%), linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
                border: 1.5px solid {accent}55;
              "
            >
              <img src={variantSuit(table.variant)} alt="" class="relative z-10 w-8 h-8 object-contain drop-shadow-lg" />
              <span
                class="absolute bottom-0.5 right-1 text-[8px] font-mono font-extrabold leading-none z-20"
                style="color: {accent}; text-shadow: 0 1px 3px rgba(0,0,0,0.9);"
              >
                #{table.id}
              </span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <!-- Row 1 -->
              <div class="flex items-center gap-2 mb-1">
                <p class="font-extrabold text-white text-sm truncate">{table.name}</p>
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 tracking-wider"
                  style="
                    background: {isFree ? 'rgba(16,185,129,0.25)' : 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'};
                    color: {isFree ? '#6ee7b7' : '#0a0800'};
                    border: 1px solid {isFree ? 'rgba(16,185,129,0.5)' : 'rgba(255,235,170,0.5)'};
                  "
                >
                  {isFree ? 'FREE' : 'REAL'}
                </span>
              </div>

              <!-- Row 2 -->
              <p class="text-[11px] text-white/70 font-semibold mb-1">
                {variantLabel(table.variant)}
                <span class="text-white/30 mx-1">·</span>
                <span class="text-cyan-300 font-bold tabular-nums">${fmtBlind(sb)}</span>
                <span class="text-white/40 mx-0.5">/</span>
                <span class="text-cyan-300 font-bold tabular-nums">${fmtBlind(bb)}</span>
                {#if Number(ante) > 0}
                  <span class="text-white/40 text-[10px] ml-1">+a${fmtBlind(ante)}</span>
                {/if}
              </p>

              <!-- Row 3 — Seats count -->
              <div class="flex items-center gap-3 text-[10px]">
                <span class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full shrink-0" style="background: {status.color}; box-shadow: 0 0 8px {status.color};"></span>
                  <span
                    class="font-extrabold tabular-nums text-[13px]"
                    style="color: {status.color}; text-shadow: 0 0 8px {status.color}90, 0 1px 2px rgba(0,0,0,0.95);"
                  >
                    {l}
                  </span>
                  <span class="text-white/50 font-bold">/</span>
                  <span class="font-extrabold text-white tabular-nums text-[12px]">{m}</span>
                  <span class="text-white/70 text-[10px] font-bold uppercase tracking-wider">seats</span>
                </span>
                {#if !isFree && Number(table.minBuyIn) > 0}
                  <span class="text-gold/80">
                    Min <span class="font-bold tabular-nums">${Number(table.minBuyIn).toFixed(0)}</span>
                  </span>
                {/if}
              </div>
            </div>

            <!-- Seat bars + status badge -->
            <div class="shrink-0 flex flex-col items-center gap-1">
              <div class="flex gap-0.5">
                {#each Array(m) as _, i}
                  <span
                    class="w-1 h-6 rounded-sm transition-all"
                    style="
                      background: {i < l ? status.color : 'rgba(255,255,255,0.10)'};
                      box-shadow: {i < l ? `0 0 5px ${status.color}aa` : 'none'};
                    "
                  ></span>
                {/each}
              </div>
              <span
                class="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
                style="
                  background: {status.color};
                  color: #ffffff;
                  border: 1px solid #ffffff50;
                  text-shadow: 0 1px 2px rgba(0,0,0,0.95);
                  box-shadow: 0 0 8px {status.color}80, inset 0 1px 0 rgba(255,255,255,0.25);
                "
              >
                {status.label}
              </span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>