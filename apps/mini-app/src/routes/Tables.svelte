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
  let filterVariant: string = initialVariant;

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
    pollTimer = setInterval(loadTables, 4000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  $: filtered = tables.filter((tbl) => {
    const okMode = filterMode === 'all' || tbl.mode === filterMode;
    const okVariant = filterVariant === 'all' || tbl.variant === filterVariant;
    return okMode && okVariant;
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

  // ===== Seat availability =====
  function seatStatus(live: number, max: number): {
    color: string;
    label: string;
    pct: number;
  } {
    const safeMax = Math.max(1, max);
    const pct = Math.min(100, (live / safeMax) * 100);
    if (live >= safeMax) return { color: '#ef4444', label: 'Full', pct };
    if (live >= safeMax - 1) return { color: '#f59e0b', label: 'Almost full', pct };
    if (live === 0) return { color: '#6b7280', label: 'Empty', pct };
    return { color: '#10b981', label: 'Open', pct };
  }
</script>

<div class="px-4 pb-28">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center justify-between mt-3 mb-4">
    <div>
      <h1 class="t-h1 text-white">Tables</h1>
      <p class="text-[11px] text-white/50 mt-0.5">
        {filtered.length} {filtered.length === 1 ? 'table' : 'tables'} available
      </p>
    </div>
    <div
      class="w-10 h-10 rounded-2xl flex items-center justify-center"
      style="
        background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
        border: 1px solid rgba(212,175,55,0.25);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
      "
    >
      <img src="/cards/suit-spade.png" alt="" class="w-5 h-5 object-contain" />
    </div>
  </div>

  <!-- MODE FILTER -->
  <div
    class="rounded-2xl p-1 grid grid-cols-3 gap-1 mb-3"
    style="
      background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
      border: 1px solid rgba(212,175,55,0.15);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    "
  >
    <button
      on:click={() => (filterMode = 'all')}
      class="py-2.5 rounded-xl text-xs font-extrabold transition-all uppercase tracking-wider"
      style="
        background: {filterMode === 'all'
          ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
          : 'transparent'};
        color: {filterMode === 'all' ? '#0a0800' : 'rgba(255,255,255,0.6)'};
        {filterMode === 'all'
          ? 'box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);'
          : ''}
      "
    >
      All
    </button>
    <button
      on:click={() => (filterMode = 'free')}
      class="py-2.5 rounded-xl text-xs font-extrabold transition-all uppercase tracking-wider"
      style="
        background: {filterMode === 'free'
          ? 'linear-gradient(180deg, #34d399 0%, #10b981 45%, #047857 100%)'
          : 'transparent'};
        color: {filterMode === 'free' ? '#ffffff' : 'rgba(255,255,255,0.6)'};
        {filterMode === 'free'
          ? 'box-shadow: 0 2px 0 #064e3b, inset 0 1px 0 rgba(255,255,255,0.3);'
          : ''}
      "
    >
      Free
    </button>
    <button
      on:click={() => (filterMode = 'real')}
      class="py-2.5 rounded-xl text-xs font-extrabold transition-all uppercase tracking-wider"
      style="
        background: {filterMode === 'real'
          ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
          : 'transparent'};
        color: {filterMode === 'real' ? '#0a0800' : 'rgba(255,255,255,0.6)'};
        {filterMode === 'real'
          ? 'box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);'
          : ''}
      "
    >
      Real
    </button>
  </div>

  <!-- VARIANT FILTER -->
  <div class="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
    <button
      on:click={() => (filterVariant = 'all')}
      class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all uppercase tracking-wider inline-flex items-center justify-center"
      style="
        background: {filterVariant === 'all'
          ? 'linear-gradient(180deg, #ffffff, #d4d4d4)'
          : 'rgba(15,31,58,0.7)'};
        color: {filterVariant === 'all' ? '#0a0800' : 'rgba(255,255,255,0.7)'};
        border: 1px solid {filterVariant === 'all'
          ? 'transparent'
          : 'rgba(212,175,55,0.2)'};
      "
    >
      All Games
    </button>
    <button
      on:click={() => (filterVariant = 'holdem')}
      class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all inline-flex items-center gap-1.5"
      style="
        background: {filterVariant === 'holdem'
          ? 'linear-gradient(180deg, #3b82f6, #1e3a8a)'
          : 'rgba(15,31,58,0.7)'};
        color: {filterVariant === 'holdem' ? '#ffffff' : 'rgba(255,255,255,0.7)'};
        border: 1px solid {filterVariant === 'holdem'
          ? 'rgba(96,165,250,0.5)'
          : 'rgba(212,175,55,0.2)'};
        {filterVariant === 'holdem'
          ? 'box-shadow: 0 0 12px rgba(59,130,246,0.4);'
          : ''}
      "
    >
      <img src="/cards/suit-spade.png" alt="" class="w-3.5 h-3.5 object-contain" />
      <span>Hold'em</span>
    </button>
    <button
      on:click={() => (filterVariant = 'omaha4')}
      class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all inline-flex items-center gap-1.5"
      style="
        background: {filterVariant === 'omaha4'
          ? 'linear-gradient(180deg, #ef4444, #991b1b)'
          : 'rgba(15,31,58,0.7)'};
        color: {filterVariant === 'omaha4' ? '#ffffff' : 'rgba(255,255,255,0.7)'};
        border: 1px solid {filterVariant === 'omaha4'
          ? 'rgba(252,165,165,0.5)'
          : 'rgba(212,175,55,0.2)'};
        {filterVariant === 'omaha4'
          ? 'box-shadow: 0 0 12px rgba(239,68,68,0.4);'
          : ''}
      "
    >
      <img src="/cards/suit-diamond.png" alt="" class="w-3.5 h-3.5 object-contain" />
      <span>Omaha 4</span>
    </button>
    <button
      on:click={() => (filterVariant = 'omaha5')}
      class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all inline-flex items-center gap-1.5"
      style="
        background: {filterVariant === 'omaha5'
          ? 'linear-gradient(180deg, #10b981, #047857)'
          : 'rgba(15,31,58,0.7)'};
        color: {filterVariant === 'omaha5' ? '#ffffff' : 'rgba(255,255,255,0.7)'};
        border: 1px solid {filterVariant === 'omaha5'
          ? 'rgba(110,231,183,0.5)'
          : 'rgba(212,175,55,0.2)'};
        {filterVariant === 'omaha5'
          ? 'box-shadow: 0 0 12px rgba(16,185,129,0.4);'
          : ''}
      "
    >
      <img src="/cards/suit-club.png" alt="" class="w-3.5 h-3.5 object-contain" />
      <span>Omaha 5</span>
    </button>
  </div>

  <!-- LOADING -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}
        <div
          class="rounded-2xl p-4 h-[110px]"
          style="
            background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));
            border: 1px solid rgba(212,175,55,0.1);
          "
        >
          <div class="shimmer h-full rounded-xl"></div>
        </div>
      {/each}
    </div>
  {:else if filtered.length === 0}
    <div
      class="rounded-3xl p-8 text-center"
      style="
        background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
        border: 1px solid rgba(212,175,55,0.15);
        box-shadow: var(--shadow-card);
      "
    >
      <div
        class="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style="
          background: linear-gradient(180deg, rgba(212,175,55,0.15), rgba(168,122,21,0.08));
          border: 1px solid rgba(212,175,55,0.3);
        "
      >
        <img src="/cards/suit-spade.png" alt="" class="w-8 h-8 object-contain opacity-70" />
      </div>
      <p class="text-white/60 text-sm font-bold">No tables found</p>
      <p class="text-white/40 text-[11px] mt-1">Try a different filter</p>
    </div>
  {:else}
    <div class="space-y-2.5">
      {#each filtered as table}
        {@const accent = variantColor(table.variant)}
        {@const isFree = table.mode === 'free'}
        {@const live = Number(table.livePlayers ?? 0)}
        {@const max = Number(table.maxSeats ?? table.seats ?? 6)}
        {@const status = seatStatus(live, max)}

        <button
          on:click={() => onOpenTable(table.id)}
          class="w-full text-left rounded-2xl active:scale-[0.98] transition-all relative overflow-hidden"
          style="
            background: linear-gradient(135deg, rgba(15,31,58,0.85) 0%, rgba(7,14,27,0.95) 100%);
            border: 1.5px solid {isFree
              ? 'rgba(16,185,129,0.25)'
              : 'rgba(212,175,55,0.3)'};
            box-shadow:
              0 4px 16px rgba(0,0,0,0.5),
              inset 0 1px 0 rgba(255,255,255,0.05);
          "
        >
          <!-- Left accent strip -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1"
            style="background: linear-gradient(180deg, {accent}, {accent}66);"
          ></div>

          <!-- Radial glow -->
          <div
            class="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-15 pointer-events-none"
            style="background: radial-gradient(circle, {accent}, transparent 70%);"
          ></div>

          <div class="flex items-center gap-3 p-3 pl-4 relative">
            <!-- Icon -->
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden"
              style="
                background:
                  radial-gradient(ellipse at 50% 40%, {accent}25 0%, transparent 70%),
                  linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
                border: 1.5px solid {accent}55;
                box-shadow:
                  inset 0 1px 0 rgba(255,255,255,0.08),
                  0 2px 8px rgba(0,0,0,0.5);
              "
            >
              <img
                src={variantSuit(table.variant)}
                alt=""
                class="relative z-10 w-8 h-8 object-contain drop-shadow-lg"
              />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <p class="font-extrabold text-white text-sm truncate">
                  {table.name}
                </p>
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 tracking-wider"
                  style="
                    background: {isFree
                      ? 'rgba(16,185,129,0.25)'
                      : 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'};
                    color: {isFree ? '#6ee7b7' : '#0a0800'};
                    border: 1px solid {isFree
                      ? 'rgba(16,185,129,0.5)'
                      : 'rgba(255,235,170,0.5)'};
                    box-shadow: {isFree ? 'none' : '0 1px 0 rgba(122,86,10,0.6)'};
                  "
                >
                  {isFree ? 'FREE' : 'REAL'}
                </span>
              </div>

              <p class="text-[11px] text-white/60 font-mono">
                {variantLabel(table.variant)} · <span class="text-cyan/80">${table.blinds.sb}/${table.blinds.bb}</span>
              </p>

              <div class="flex items-center gap-3 mt-1.5 text-[10px]">
                <span class="flex items-center gap-1.5">
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    style="background: {status.color}; box-shadow: 0 0 6px {status.color};"
                  ></span>
                  <span class="font-extrabold text-[11px] tabular-nums" style="color: {status.color};">
                    {live}
                  </span>
                  <span class="text-white/40">/</span>
                  <span class="font-semibold text-[10px] text-white/70 tabular-nums">{max}</span>
                  <span class="text-white/40">seats</span>
                </span>
                {#if table.mode === 'real' && table.minBuyIn > 0}
                  <span class="text-gold/80">
                    Min: <span class="font-bold">${table.minBuyIn}</span>
                  </span>
                {/if}
              </div>
            </div>

            <!-- Seat bar (right side) -->
            <div class="shrink-0 flex flex-col items-end gap-1">
              <div class="flex gap-0.5">
                {#each Array(max) as _, i}
                  <span
                    class="w-1 h-5 rounded-sm transition-all"
                    style="
                      background: {i < live
                        ? status.color
                        : 'rgba(255,255,255,0.08)'};
                      box-shadow: {i < live ? `0 0 4px ${status.color}80` : 'none'};
                    "
                  ></span>
                {/each}
              </div>
              <span
                class="text-[8px] font-extrabold uppercase tracking-wider"
                style="color: {status.color};"
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