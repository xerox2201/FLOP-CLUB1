<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';

  export let onOpenTournament: (id: number) => void = () => {};

  type Filter = 'all' | 'running' | 'registering' | 'scheduled' | 'finished';

  let filter: Filter = 'all';
  let tournaments: any[] = [];
  let loading = true;
  let error = '';
  let pollTimer: any = null;

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function fmtTime(iso: string | null): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const diff = d.getTime() - Date.now();
      if (diff < 0) return 'Started';
      const min = Math.floor(diff / 60000);
      if (min < 60) return `in ${min}m`;
      const h = Math.floor(min / 60);
      return `in ${h}h ${min % 60}m`;
    } catch {
      return '—';
    }
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'running', label: 'Running' },
    { key: 'registering', label: 'Open' },
    { key: 'scheduled', label: 'Upcoming' },
    { key: 'finished', label: 'Finished' },
  ];

  async function load() {
    error = '';
    try {
      const statusParam = filter === 'all' ? undefined : filter;
      const res = await api.listTournaments({ status: statusParam });
      if (res.ok && res.data) {
        tournaments = res.data.tournaments || [];
      } else {
        error = res.error || 'failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function statusColor(status: string): string {
    if (status === 'running') return '#10b981';
    if (status === 'final_table') return '#f4c95d';
    if (status === 'registering') return '#22d3ee';
    if (status === 'scheduled') return '#8b5cf6';
    if (status === 'finished') return '#6b7280';
    return '#ef4444';
  }

  function statusLabel(status: string): string {
    if (status === 'final_table') return 'FINAL';
    return status.replace('_', ' ').toUpperCase();
  }

  function formatLabel(t: any): string {
    const map: Record<string, string> = {
      sng: 'SNG',
      mtt: 'MTT',
      freeroll: 'FREE',
      satellite: 'SAT',
    };
    return map[t.format] || t.format.toUpperCase();
  }

  onMount(() => {
    load();
    pollTimer = setInterval(load, 5000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <TopBar />
  <div class="flex items-center justify-between mt-3 mb-4">
    <h1 class="text-2xl font-extrabold">🏆 Tournaments</h1>
    <button
      on:click={load}
      aria-label="Refresh"
      class="w-9 h-9 rounded-full flex items-center justify-center text-white/60 active:scale-95"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
    >
      🔄
    </button>
  </div>

  <div class="flex gap-1.5 mb-4 overflow-x-auto pb-1">
    {#each FILTERS as f}
      <button
        on:click={() => {
          filter = f.key;
          loading = true;
          load();
        }}
        class="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap active:scale-95 transition"
        style="background: {filter === f.key
          ? 'linear-gradient(180deg, #ffe9a8 0%, #f4c95d 50%, #a87922 100%)'
          : 'rgba(139,92,246,0.12)'}; color: {filter === f.key
          ? '#050611'
          : 'rgba(255,255,255,0.7)'}; border: 1px solid {filter === f.key
          ? 'transparent'
          : 'rgba(139,92,246,0.2)'};"
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="text-center py-12 text-white/40 text-sm">Loading…</div>
  {:else if error}
    <div
      class="rounded-xl p-4 text-center"
      style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);"
    >
      <p class="text-red-300 text-sm">{error}</p>
    </div>
  {:else if tournaments.length === 0}
    <div class="card p-8 text-center">
      <p class="text-4xl mb-2">🎫</p>
      <p class="text-white/50 text-sm">
        No tournaments {filter === 'all' ? 'yet' : `in "${filter}"`}
      </p>
    </div>
  {:else}
    <div class="space-y-2.5">
      {#each tournaments as t}
        {@const sc = statusColor(t.status)}
        <button
          on:click={() => onOpenTournament(t.id)}
          class="relative w-full text-left rounded-2xl p-3 active:scale-[0.98] transition overflow-hidden"
          style="background: linear-gradient(135deg, rgba(16,26,58,0.9), rgba(8,13,36,0.9)); border: 1px solid rgba(139,92,246,0.2); box-shadow: 0 4px 16px rgba(0,0,0,0.4);"
        >
          <!-- Status strip -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style="background: {sc};"
          ></div>

          <div class="flex items-start justify-between mb-2 pl-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1">
                <span
                  class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style="background: {sc}25; color: {sc}; border: 1px solid {sc}50;"
                >
                  {statusLabel(t.status)}
                </span>
                <span class="text-[9px] font-bold text-white/40">{formatLabel(t)}</span>
                {#if t.mode === 'free'}
                  <span class="text-[9px] font-bold text-emerald-400">FREE</span>
                {/if}
              </div>
              <p class="text-sm font-extrabold text-white truncate">{t.name}</p>
              <p class="text-[10px] text-white/40 mt-0.5">
                {t.variant.toUpperCase()} · {t.speed}
              </p>
            </div>
            <div class="text-right shrink-0 ml-2">
              <div class="text-[12px] font-extrabold text-gold tabular-nums leading-none">
                {t.buyIn > 0 ? `$${fmt(t.buyIn)}` : 'FREE'}
              </div>
              {#if t.guaranteed > 0}
                <div class="text-[9px] text-gold/60 mt-0.5">
                  GTD ${fmt(t.guaranteed)}
                </div>
              {/if}
            </div>
          </div>

          <div
            class="grid grid-cols-3 gap-2 mt-2 pt-2 pl-2"
            style="border-top: 1px solid rgba(139,92,246,0.15);"
          >
            <div>
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Players</p>
              <p class="text-[11px] font-bold text-white tabular-nums">
                {t.activeCount > 0 ? t.activeCount : t.registeredCount} / {t.maxPlayers}
              </p>
            </div>
            <div>
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Prize</p>
              <p class="text-[11px] font-bold text-emerald-400 tabular-nums">
                ${fmt(t.totalPrizePool)}
              </p>
            </div>
            <div>
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">
                {t.status === 'running' || t.status === 'final_table' ? 'Level' : 'Starts'}
              </p>
              <p class="text-[11px] font-bold text-white tabular-nums">
                {#if t.status === 'running' || t.status === 'final_table'}
                  Lvl {t.currentLevel}
                {:else if t.scheduledStart}
                  {fmtTime(t.scheduledStart)}
                {:else}
                  When full
                {/if}
              </p>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
