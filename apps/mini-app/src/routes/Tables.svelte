<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import { t } from '../i18n';
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

  function variantEmoji(v: string): string {
    if (v === 'holdem') return '♠️';
    if (v === 'omaha4') return '♦️';
    if (v === 'omaha5') return '♣️';
    return '🎴';
  }

  function variantLabel(v: string): string {
    if (v === 'holdem') return "Hold'em";
    if (v === 'omaha4') return 'Omaha 4';
    if (v === 'omaha5') return 'Omaha 5';
    return v;
  }
</script>

<div class="px-4 pb-28">
  <TopBar />
  <h1 class="text-2xl font-extrabold mt-3 mb-4">{$t('tables.title')}</h1>

  <!-- Mode filter -->
  <div
    class="glass rounded-2xl p-1 flex gap-1 mb-3"
    style="border: 1px solid rgba(139,92,246,0.15);"
  >
    <button
      on:click={() => (filterMode = 'all')}
      class="flex-1 py-2 rounded-xl text-xs font-bold transition {filterMode === 'all'
        ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
        : 'text-white/60'}"
    >
      {$t('tables.all')}
    </button>
    <button
      on:click={() => (filterMode = 'free')}
      class="flex-1 py-2 rounded-xl text-xs font-bold transition {filterMode === 'free'
        ? 'bg-gradient-to-b from-emerald-400 to-emerald-700 text-white'
        : 'text-white/60'}"
    >
      {$t('tables.free')}
    </button>
    <button
      on:click={() => (filterMode = 'real')}
      class="flex-1 py-2 rounded-xl text-xs font-bold transition {filterMode === 'real'
        ? 'bg-gradient-to-b from-gold-light to-gold text-near-black'
        : 'text-white/60'}"
    >
      {$t('tables.real')}
    </button>
  </div>

  <!-- Variant filter -->
  <div class="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
    <button
      on:click={() => (filterVariant = 'all')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition {filterVariant ===
      'all'
        ? 'bg-white text-near-black'
        : 'bg-white/10 text-white/70'}"
    >
      {$t('tables.allVariant')}
    </button>
    <button
      on:click={() => (filterVariant = 'holdem')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition {filterVariant ===
      'holdem'
        ? 'bg-blue-600 text-white'
        : 'bg-white/10 text-white/70'}"
    >
      ♠️ {$t('games.holdem')}
    </button>
    <button
      on:click={() => (filterVariant = 'omaha4')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition {filterVariant ===
      'omaha4'
        ? 'bg-red-600 text-white'
        : 'bg-white/10 text-white/70'}"
    >
      ♦️ {$t('games.omaha4')}
    </button>
    <button
      on:click={() => (filterVariant = 'omaha5')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition {filterVariant ===
      'omaha5'
        ? 'bg-emerald-600 text-white'
        : 'bg-white/10 text-white/70'}"
    >
      ♣️ {$t('games.omaha5')}
    </button>
  </div>

  {#if loading}
    <p class="text-white/40 text-center py-12">{$t('tables.loadingTables')}</p>
  {:else if filtered.length === 0}
    <div class="card text-center py-10">
      <p class="text-4xl mb-2">🃏</p>
      <p class="text-white/50 text-sm">{$t('tables.noTables')}</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each filtered as table}
        <button
          on:click={() => onOpenTable(table.id)}
          class="w-full text-left rounded-2xl p-3 active:scale-[0.98] transition"
          style="background: linear-gradient(135deg, rgba(16,26,58,0.9), rgba(8,13,36,0.9)); border: 1px solid rgba(139,92,246,0.2); box-shadow: 0 4px 16px rgba(0,0,0,0.4);"
        >
          <div class="flex items-center gap-3">
            <!-- Icon -->
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style="background: radial-gradient(circle, rgba(34,197,94,0.2), rgba(0,0,0,0.3)); border: 1px solid rgba(34,197,94,0.3);"
            >
              {variantEmoji(table.variant)}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-extrabold text-white truncate">{table.name}</p>
                <span
                  class="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 {table.mode ===
                  'free'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : 'badge-gold'}"
                >
                  {table.mode === 'free' ? 'FREE' : 'REAL'}
                </span>
              </div>
              <p class="text-[11px] text-white/60 mt-0.5">
                {variantLabel(table.variant)} · {table.blinds.sb}/{table.blinds.bb}
              </p>
              <div class="flex items-center gap-3 mt-1.5 text-[10px] text-white/40">
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {table.seats} seats
                </span>
                {#if table.mode === 'real' && table.minBuyIn > 0}
                  <span>Min: ${table.minBuyIn}</span>
                {/if}
              </div>
            </div>

            <!-- Arrow -->
            <span class="text-gold text-xl shrink-0">→</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
