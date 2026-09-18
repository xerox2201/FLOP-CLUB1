<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import { getRealtime, realtimeConnected, TOURNAMENT_EVENT_RE } from '../lib/realtime';
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
      return `in ${h}h`;
    } catch { return '—'; }
  }

  const FILTERS: { key: Filter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '#d4af37' },
    { key: 'running', label: 'Live', color: '#10b981' },
    { key: 'registering', label: 'Open', color: '#22d3ee' },
    { key: 'scheduled', label: 'Upcoming', color: '#8b5cf6' },
    { key: 'finished', label: 'Finished', color: '#6b7280' },
  ];

  async function load() {
    error = '';
    try {
      const statusParam = filter === 'all' ? undefined : filter;
      const res = await api.listTournaments({ status: statusParam });
      if (res.ok && res.data) tournaments = res.data.tournaments || [];
      else error = res.error || 'failed';
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  function onAnyEvent(event: string): void {
    if (TOURNAMENT_EVENT_RE.test(event)) load();
  }

  onMount(() => {
    load();
    pollTimer = setInterval(load, 20000);
    return () => { if (pollTimer) clearInterval(pollTimer); };
  });

  $: if ($realtimeConnected) {
    const s = getRealtime();
    if (s) { s.offAny(onAnyEvent); s.onAny(onAnyEvent); }
  }

  onDestroy(() => {
    const s = getRealtime();
    if (s) s.offAny(onAnyEvent);
  });

  function statusColor(status: string): string {
    if (status === 'running') return '#10b981';
    if (status === 'final_table') return '#d4af37';
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
    const map: Record<string, string> = { sng: 'SNG', mtt: 'MTT', freeroll: 'FREE', satellite: 'SAT' };
    return map[t.format] || t.format.toUpperCase();
  }

  // Featured = running tournament with biggest prize pool
  $: featured = tournaments
    .filter((t) => t.status === 'running' || t.status === 'final_table')
    .sort((a, b) => Number(b.totalPrizePool) - Number(a.totalPrizePool))[0] || null;

  $: others = featured ? tournaments.filter((t) => t.id !== featured.id) : tournaments;
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- HEADER -->
  <div class="flex items-center justify-between mt-3 mb-4 px-4">
    <div>
      <h1 class="text-2xl font-extrabold text-white flex items-center gap-2">
        Tournaments
      </h1>
      <p class="text-[11px] text-white/50 mt-0.5">
        {tournaments.length} {tournaments.length === 1 ? 'event' : 'events'}
      </p>
    </div>
    <button
      on:click={load}
      aria-label="Refresh"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9)); border: 1px solid rgba(212,175,55,0.25);"
    >
      <span class="text-base">🔄</span>
    </button>
  </div>

  <!-- FILTERS -->
  <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1 px-4">
    {#each FILTERS as f}
      <button
        on:click={() => { filter = f.key; loading = true; load(); }}
        class="px-3.5 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap active:scale-95 transition-all uppercase tracking-wider"
        style="
          background: {filter === f.key
            ? `linear-gradient(180deg, ${f.color}, ${f.color}bb)`
            : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
          color: {filter === f.key ? '#ffffff' : 'rgba(255,255,255,0.65)'};
          border: 1px solid {filter === f.key ? `${f.color}dd` : 'rgba(212,175,55,0.15)'};
          {filter === f.key ? `box-shadow: 0 3px 12px ${f.color}60;` : ''}
        "
      >
        {f.label}
      </button>
    {/each}
  </div>

  <!-- FEATURED -->
  {#if featured && !loading}
    {@const sc = statusColor(featured.status)}
    <div class="px-4 mb-5">
      <button
        on:click={() => onOpenTournament(featured.id)}
        class="relative w-full rounded-3xl overflow-hidden text-left active:scale-[0.98] transition-all"
        style="
          min-height: 200px;
          border: 1.5px solid {sc}60;
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px {sc}30;
        "
      >
        <!-- Background image -->
        <div
          class="absolute inset-0"
          style="background: linear-gradient(135deg, #0a1428 0%, #1e1704 60%, #3a2d08 100%);"
        ></div>
        <div
          class="absolute inset-0"
          style="
            background-image: url('/bg-tournament.png');
            background-size: cover;
            background-position: center;
            opacity: 0.4;
          "
        ></div>
        <div
          class="absolute inset-0"
          style="
            background:
              radial-gradient(ellipse at 100% 0%, {sc}40 0%, transparent 55%),
              linear-gradient(180deg, rgba(5,8,15,0.4) 0%, rgba(5,8,15,0.85) 100%);
          "
        ></div>

        <!-- Content -->
        <div class="relative p-5 flex gap-4 items-center">
          <!-- Trophy image -->
          <div class="shrink-0">
            <img
              src="/trophy.png"
              alt=""
              class="w-24 h-24 object-contain"
              style="filter: drop-shadow(0 8px 20px rgba(212,175,55,0.7));"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-2">
              <span
                class="text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider"
                style="background: {sc}30; color: {sc}; border: 1px solid {sc}60;"
              >
                ● {statusLabel(featured.status)}
              </span>
            </div>
            <p class="text-[11px] text-gold/80 font-bold uppercase tracking-widest mb-1">
              Featured
            </p>
            <h3 class="text-xl font-extrabold text-white leading-tight mb-2 truncate">
              {featured.name}
            </h3>
            <div class="flex items-baseline gap-2 mb-2">
              <span
                class="text-2xl font-extrabold tabular-nums"
                style="
                  background: linear-gradient(180deg, #f4e5a8, #d4af37 50%, #a87a15);
                  -webkit-background-clip: text;
                  background-clip: text;
                  -webkit-text-fill-color: transparent;
                "
              >
                ${fmt(featured.totalPrizePool)}
              </span>
              <span class="text-[10px] text-gold/70 font-bold uppercase">Prize Pool</span>
            </div>
            <div class="flex items-center gap-3 text-[10px] text-white/60">
              <span>👥 {featured.activeCount || featured.registeredCount}/{featured.maxPlayers}</span>
              <span>💵 ${fmt(featured.buyIn)}</span>
              {#if featured.status === 'running' || featured.status === 'final_table'}
                <span class="text-gold">Lvl {featured.currentLevel}</span>
              {/if}
            </div>
          </div>
        </div>
      </button>
    </div>
  {/if}

  <!-- LOADING -->
  {#if loading}
    <div class="space-y-3 px-4">
      {#each Array(3) as _}
        <div class="rounded-2xl p-4 h-[120px] shimmer"
             style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"></div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-2xl p-4 text-center mx-4" style="background: rgba(153,27,27,0.15); border: 1px solid rgba(239,68,68,0.3);">
      <p class="text-red-300 text-sm font-bold">{error}</p>
    </div>
  {:else if others.length === 0 && !featured}
    <div class="rounded-3xl p-8 text-center mx-4" style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px solid rgba(212,175,55,0.15);">
      <div class="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center">
        <img src="/trophy.png" alt="" class="w-full h-full object-contain opacity-40" />
      </div>
      <p class="text-white/60 text-sm font-bold">No tournaments {filter === 'all' ? 'yet' : `in "${filter}"`}</p>
      <p class="text-white/40 text-[11px] mt-1">Check back soon</p>
    </div>
  {:else}
    <div class="space-y-3 px-4">
      {#each others as t}
        {@const sc = statusColor(t.status)}
        <button
          on:click={() => onOpenTournament(t.id)}
          class="relative w-full text-left rounded-2xl active:scale-[0.98] transition-all overflow-hidden"
          style="
            background: linear-gradient(135deg, rgba(15,31,58,0.9) 0%, rgba(7,14,27,0.95) 100%);
            border: 1.5px solid {sc}40;
            box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 20px {sc}15;
          "
        >
          <div class="absolute left-0 top-0 bottom-0 w-1.5"
               style="background: linear-gradient(180deg, {sc}, {sc}66); box-shadow: 0 0 12px {sc}80;"></div>

          <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 pointer-events-none"
               style="background: radial-gradient(circle, {sc}, transparent 70%);"></div>

          <div class="p-3.5 pl-5 relative">
            <div class="flex items-start justify-between gap-2 mb-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-1.5">
                  <span
                    class="text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider"
                    style="background: {sc}25; color: {sc}; border: 1px solid {sc}60;"
                  >
                    {statusLabel(t.status)}
                  </span>
                  <span class="text-[9px] font-extrabold text-white/60 tracking-wider">{formatLabel(t)}</span>
                  {#if t.mode === 'free'}
                    <span class="text-[9px] font-extrabold tracking-wider" style="color: #6ee7b7;">FREE</span>
                  {/if}
                </div>
                <p class="text-[15px] font-extrabold text-white truncate leading-tight">{t.name}</p>
                <p class="text-[10px] text-white/45 mt-1 font-mono uppercase">{t.variant} · {t.speed}</p>
              </div>

              <div class="text-right shrink-0">
                <div
                  class="text-[14px] font-extrabold tabular-nums leading-none"
                  style="
                    background: linear-gradient(180deg, #f4e5a8, #d4af37 50%, #a87a15);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                  "
                >
                  {t.buyIn > 0 ? `$${fmt(t.buyIn)}` : 'FREE'}
                </div>
                {#if t.guaranteed > 0}
                  <div class="text-[9px] text-gold/60 mt-1 tabular-nums">GTD ${fmt(t.guaranteed)}</div>
                {/if}
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-3" style="border-top: 1px solid rgba(212,175,55,0.1);">
              <div>
                <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">Players</p>
                <p class="text-[12px] font-extrabold text-white tabular-nums">
                  {t.activeCount > 0 ? t.activeCount : t.registeredCount}
                  <span class="text-white/40 font-bold"> / {t.maxPlayers}</span>
                </p>
              </div>
              <div>
                <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">Prize</p>
                <p class="text-[12px] font-extrabold tabular-nums" style="color: #6ee7b7;">${fmt(t.totalPrizePool)}</p>
              </div>
              <div>
                <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">
                  {t.status === 'running' || t.status === 'final_table' ? 'Level' : 'Starts'}
                </p>
                <p class="text-[12px] font-extrabold tabular-nums" style="color: {sc};">
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
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>