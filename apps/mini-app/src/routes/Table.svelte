<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';

  export let initialVariant: string = 'all';
  export let initialMode: 'all' | 'free' | 'real' = 'all';
  export let onOpenTable: (id: number) => void = () => {};

  let tables: any[] = [];
  let loading = true;
  let filterMode: 'all' | 'free' | 'real' = initialMode;
  let filterVariant: string = initialVariant;

  onMount(async () => {
    const res = await api.tables();
    if (res.ok && res.data) tables = res.data.tables;
    loading = false;
  });

  $: filtered = tables.filter((tbl) => {
    const okMode = filterMode === 'all' || tbl.mode === filterMode;
    const okVariant = filterVariant === 'all' || tbl.variant === filterVariant;
    return okMode && okVariant;
  });

  // Determine chip icon based on blind level
  function chipColorForTable(tbl: any): string {
    const bb = Number(tbl.blinds?.bb || 0);
    if (tbl.mode === 'free') {
      if (bb <= 1) return '#94a3b8';
      if (bb <= 10) return '#3b82f6';
      return '#10b981';
    }
    if (bb <= 1) return '#f59e0b';
    if (bb <= 20) return '#dc2626';
    if (bb <= 100) return '#0a0a0a';
    if (bb <= 1000) return '#8b5cf6';
    return '#d4af37';
  }

  function variantLabel(v: string): string {
    if (v === 'holdem') return "Texas Hold'em";
    if (v === 'omaha4') return 'Omaha 4';
    if (v === 'omaha5') return 'Omaha 5';
    return v;
  }

  function formatBlinds(tbl: any): string {
    const sb = Number(tbl.blinds?.sb || 0);
    const bb = Number(tbl.blinds?.bb || 0);
    return `${sb} / ${bb}`;
  }

  function playersCount(tbl: any): string {
    const cur = tbl.live_players || 0;
    const max = tbl.maxSeats || tbl.seats || 9;
    return `${cur} / ${max}`;
  }
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1">Cash Games</h1>
  </div>

  <!-- VARIANT TABS -->
  <div class="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1 px-4">
    {#each [
      { key: 'all', label: 'All' },
      { key: 'holdem', label: "Hold'em" },
      { key: 'omaha4', label: 'Omaha 4' },
      { key: 'omaha5', label: 'Omaha 5' },
    ] as v}
      <button
        on:click={() => (filterVariant = v.key)}
        class="px-4 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap active:scale-95 transition-all uppercase tracking-wider"
        style="
          background: {filterVariant === v.key
            ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
            : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
          color: {filterVariant === v.key ? '#0a0800' : 'rgba(255,255,255,0.65)'};
          border: 1px solid {filterVariant === v.key ? 'transparent' : 'rgba(212,175,55,0.15)'};
          {filterVariant === v.key ? 'box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);' : ''}
        "
      >
        {v.label}
      </button>
    {/each}
  </div>

  <!-- MODE FILTER -->
  <div class="flex gap-2 mb-4 px-4">
    <div class="relative flex-1">
      <select bind:value={filterMode}
              class="w-full rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none appearance-none pr-8"
              style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.2);">
        <option value="all">All Stakes</option>
        <option value="free">Free Only</option>
        <option value="real">Real Money</option>
      </select>
      <svg class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="3" stroke-linecap="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
    <button
      on:click={() => {}}
      aria-label="Refresh"
      class="w-10 rounded-xl flex items-center justify-center active:scale-95"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.2);"
    >
      <span class="text-sm">🔄</span>
    </button>
  </div>

  <!-- TABLE LIST -->
  {#if loading}
    <div class="space-y-2 px-4">
      {#each Array(4) as _}
        <div class="rounded-2xl p-3 h-[70px] shimmer"
             style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"></div>
      {/each}
    </div>
  {:else if filtered.length === 0}
    <div class="rounded-2xl p-8 text-center mx-4"
         style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);">
      <div class="text-4xl mb-2">🃏</div>
      <p class="text-white/60 text-sm font-bold">No tables found</p>
      <p class="text-white/40 text-[11px] mt-1">Try a different filter</p>
    </div>
  {:else}
    <div class="space-y-2 px-4">
      {#each filtered as tbl}
        {@const chipColor = chipColorForTable(tbl)}
        {@const isFree = tbl.mode === 'free'}
        <button
          on:click={() => onOpenTable(tbl.id)}
          class="w-full text-left rounded-2xl active:scale-[0.98] transition-all relative overflow-hidden flex items-center gap-3 p-3"
          style="
            background: linear-gradient(135deg, rgba(15,31,58,0.85) 0%, rgba(7,14,27,0.95) 100%);
            border: 1.5px solid {isFree ? 'rgba(16,185,129,0.2)' : 'rgba(212,175,55,0.25)'};
            box-shadow: 0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
          "
        >
          <!-- Chip icon -->
          <div class="shrink-0 relative" style="width: 48px; height: 48px;">
            <!-- Outer metallic ring -->
            <div
              class="absolute inset-0 rounded-full"
              style="
                background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
                box-shadow: 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4);
              "
            ></div>
            <!-- Colored inner -->
            <div
              class="absolute rounded-full"
              style="
                inset: 4px;
                background: radial-gradient(circle at 40% 35%, {chipColor}, {chipColor}dd);
                box-shadow: inset 0 -3px 6px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.15);
              "
            ></div>
            <!-- Inner white ring -->
            <div
              class="absolute rounded-full"
              style="
                inset: 9px;
                border: 1.5px dashed rgba(255,255,255,0.4);
              "
            ></div>
            <!-- Center value -->
            <div class="absolute inset-0 flex items-center justify-center">
              <span
                class="text-[11px] font-extrabold tabular-nums"
                style="
                  color: white;
                  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                "
              >
                ${Number(tbl.blinds?.bb || 0) >= 1000 ? (Number(tbl.blinds.bb) / 1000).toFixed(0) + 'K' : Number(tbl.blinds?.bb || 0)}
              </span>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-[13px] font-extrabold text-white truncate">
                {variantLabel(tbl.variant)}
              </p>
              {#if isFree}
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
                  style="background: rgba(16,185,129,0.25); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.5);"
                >
                  FREE
                </span>
              {:else}
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
                  style="
                    background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
                    color: #0a0800;
                    border: 1px solid rgba(255,235,170,0.5);
                  "
                >
                  REAL
                </span>
              {/if}
            </div>
            <p class="text-[11px] text-white/55 font-mono mt-0.5 tabular-nums">
              {formatBlinds(tbl)}
            </p>
          </div>

          <!-- Players count -->
          <div class="text-right shrink-0 mr-2">
            <p class="text-[10px] text-white/40 uppercase tracking-wider font-bold">Seats</p>
            <p class="text-[13px] font-extrabold text-white tabular-nums">{playersCount(tbl)}</p>
          </div>

          <!-- Join button -->
          <div
            class="shrink-0 rounded-xl px-4 py-2.5 flex items-center justify-center"
            style="
              background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
              box-shadow: 0 3px 0 #7a560a, 0 6px 14px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,235,170,0.5);
            "
          >
            <span class="text-[12px] font-extrabold text-[#0a0800] tracking-wider">Join</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>