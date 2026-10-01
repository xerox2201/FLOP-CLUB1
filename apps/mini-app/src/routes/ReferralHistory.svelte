<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  type Filter = 'all' | 'direct' | 'indirect' | 'group';

  let filter: Filter = 'all';
  let loading = true;
  let loadingMore = false;
  let error = '';
  let entries: any[] = [];
  let total = 0;
  let thisMonth = 0;
  let offset = 0;
  const LIMIT = 30;

  const FILTERS: { key: Filter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '#d4af37' },
    { key: 'direct', label: 'Direct', color: '#f4c95d' },
    { key: 'indirect', label: 'Indirect', color: '#a78bfa' },
    { key: 'group', label: 'Group', color: '#22d3ee' },
  ];

  function fmt(n: any, digits = 2): string {
    return Number(Number(n || 0).toFixed(digits)).toFixed(digits);
  }

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'Just now';
      if (min < 60) return `${min}m ago`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  async function load(reset = true) {
    if (reset) {
      loading = true;
      offset = 0;
      entries = [];
    } else {
      loadingMore = true;
    }
    error = '';
    try {
      const sourceParam = filter === 'all' ? '' : `&source=${filter}`;
      const res = await api.request<any>(
        `/api/referral/history?limit=${LIMIT}&offset=${offset}${sourceParam}`,
      );
      if (res.ok && res.data) {
        const newEntries = res.data.entries ?? [];
        entries = reset ? newEntries : [...entries, ...newEntries];
        total = res.data.total ?? 0;
        thisMonth = res.data.thisMonth ?? 0;
        offset += newEntries.length;
      } else {
        error = res.error || 'failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  function setFilter(f: Filter) {
    filter = f;
    load(true);
  }

  function loadMore() {
    if (loadingMore || entries.length >= total) return;
    load(false);
  }

  $: hasMore = entries.length < total;

  onMount(() => load(true));
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
      <Icon name="receipt" size={22} color="#6ee7b7" />
      <span>History</span>
    </h1>
  </div>

  <!-- Summary -->
  <div class="px-4 mb-3">
    <div
      class="rounded-2xl p-3.5"
      style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(7,14,27,0.95)); border: 1px solid rgba(16,185,129,0.35);"
    >
      <div class="grid grid-cols-2 gap-3">
        <div>
          <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Lifetime</p>
          <p class="text-xl font-extrabold text-emerald-400 tabular-nums leading-none">
            ${fmt(total)}
          </p>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
          <p class="text-[9px] text-white/45 uppercase font-bold mb-1">This Month</p>
          <p class="text-xl font-extrabold text-emerald-400 tabular-nums leading-none">
            ${fmt(thisMonth)}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="flex gap-1.5 px-4 mb-3 overflow-x-auto no-scrollbar">
    {#each FILTERS as f}
      <button
        on:click={() => setFilter(f.key)}
        class="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider active:scale-95 transition-all"
        style="
          background: {filter === f.key
          ? `linear-gradient(180deg, ${f.color}, ${f.color}bb)`
          : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
          color: {filter === f.key ? '#0a0800' : 'rgba(255,255,255,0.65)'};
          border: 1px solid {filter === f.key ? 'transparent' : 'rgba(212,175,55,0.15)'};
        "
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="px-4 space-y-1.5">
      {#each Array(4) as _}
        <div class="rounded-2xl h-[60px]" style="background: rgba(15,31,58,0.6);"></div>
      {/each}
    </div>
  {:else if error}
    <div
      class="mx-4 rounded-2xl p-4 text-center"
      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"
    >
      <p class="text-sm text-red-300 font-bold">{error}</p>
      <button on:click={() => load(true)} class="mt-2 text-[11px] text-gold font-bold">Retry</button
      >
    </div>
  {:else if entries.length === 0}
    <div
      class="mx-4 rounded-2xl p-6 text-center"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px dashed rgba(212,175,55,0.3);"
    >
      <div class="flex justify-center mb-3">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center"
          style="background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);"
        >
          <Icon name="receipt" size={24} color="#d4af37" />
        </div>
      </div>
      <p class="text-sm font-extrabold text-white">
        No {filter === 'all' ? '' : filter + ' '}earnings yet
      </p>
      <p class="text-[11px] text-white/50 mt-1">Activity will show up here in real time</p>
    </div>
  {:else}
    <div class="px-4 space-y-1.5">
      {#each entries as e, i (i)}
        {@const sourceColor =
          e.source === 'direct'
            ? '#f4c95d'
            : e.source === 'indirect'
              ? '#a78bfa'
              : e.source === 'group'
                ? '#22d3ee'
                : '#6ee7b7'}
        <div
          class="rounded-xl px-3 py-2.5 flex items-center gap-3"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(255,255,255,0.06);"
        >
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style="background: {sourceColor}20; border: 1px solid {sourceColor}50;"
          >
            <span class="text-[10px] font-extrabold" style="color: {sourceColor};">
              L{e.level}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-[11px] font-extrabold text-white truncate">{e.refereeName}</p>
              <span
                class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style="background: {sourceColor}25; color: {sourceColor};"
              >
                {e.source}
              </span>
            </div>
            <p class="text-[9px] text-white/45 mt-0.5">
              {Math.round(e.rate * 100)}% of ${fmt(e.rakeShare)} rake · {fmtDate(e.paidAt)}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums">
              +${fmt(e.amount)}
            </p>
          </div>
        </div>
      {/each}

      {#if hasMore}
        <button
          on:click={loadMore}
          disabled={loadingMore}
          class="w-full mt-2 rounded-2xl py-3 text-[11px] font-extrabold active:scale-[0.98] disabled:opacity-50"
          style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.4); color: #c4b5fd;"
        >
          {loadingMore ? 'Loading…' : `Load more (${total - entries.length} left)`}
        </button>
      {/if}
    </div>
  {/if}
</div>
