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
</script>

<div class="px-4 pb-28">
  <TopBar />
  <h1 class="text-2xl font-extrabold mt-3 mb-4">{$t('tables.title')}</h1>

  <div class="glass rounded-2xl p-1 flex gap-1 mb-3">
    <button
      on:click={() => (filterMode = 'all')}
      class="flex-1 py-2 rounded-xl text-sm font-semibold transition {filterMode === 'all'
        ? 'bg-gold text-black'
        : 'text-white/70'}">{$t('tables.all')}</button
    >
    <button
      on:click={() => (filterMode = 'free')}
      class="flex-1 py-2 rounded-xl text-sm font-semibold transition {filterMode === 'free'
        ? 'bg-emerald-500 text-white'
        : 'text-white/70'}">{$t('tables.free')}</button
    >
    <button
      on:click={() => (filterMode = 'real')}
      class="flex-1 py-2 rounded-xl text-sm font-semibold transition {filterMode === 'real'
        ? 'bg-gold text-black'
        : 'text-white/70'}">{$t('tables.real')}</button
    >
  </div>

  <div class="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
    <button
      on:click={() => (filterVariant = 'all')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition {filterVariant ===
      'all'
        ? 'bg-white text-black'
        : 'bg-white/10 text-white/70'}">{$t('tables.allVariant')}</button
    >
    <button
      on:click={() => (filterVariant = 'holdem')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition {filterVariant ===
      'holdem'
        ? 'bg-blue-600 text-white'
        : 'bg-white/10 text-white/70'}">♠️ {$t('games.holdem')}</button
    >
    <button
      on:click={() => (filterVariant = 'omaha4')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition {filterVariant ===
      'omaha4'
        ? 'bg-red-600 text-white'
        : 'bg-white/10 text-white/70'}">♦️ {$t('games.omaha4')}</button
    >
    <button
      on:click={() => (filterVariant = 'omaha5')}
      class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition {filterVariant ===
      'omaha5'
        ? 'bg-emerald-600 text-white'
        : 'bg-white/10 text-white/70'}">♣️ {$t('games.omaha5')}</button
    >
  </div>

  {#if loading}
    <p class="text-white/40 text-center py-12">{$t('tables.loadingTables')}</p>
  {:else if filtered.length === 0}
    <p class="text-white/40 text-center py-12">{$t('tables.noTables')}</p>
  {:else}
    <div class="space-y-3">
      {#each filtered as table}
        <button
          on:click={() => onOpenTable(table.id)}
          class="card w-full flex items-center justify-between active:scale-[0.99] transition text-left"
        >
          <div>
            <p class="font-bold">{table.name}</p>
            <p class="text-[11px] text-white/50 uppercase tracking-wide mt-0.5">{table.variant}</p>
            <div class="flex gap-3 text-[11px] text-white/50 mt-2">
              <span>{$t('tables.blinds')} {table.blinds.sb}/{table.blinds.bb}</span>
              <span>·</span>
              <span>{table.seats} {$t('tables.seats')}</span>
            </div>
          </div>
          <div class="text-right">
            <span
              class="inline-block text-[10px] px-2 py-1 rounded-full font-bold {table.mode ===
              'free'
                ? 'bg-emerald-900/70 text-emerald-300'
                : 'bg-gold/20 text-gold'}"
            >
              {table.mode === 'free' ? 'FREE' : 'REAL'}
            </span>
            {#if table.mode === 'real'}
              <p class="text-xs text-gold mt-2 font-semibold">${table.min_buyin}+</p>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
