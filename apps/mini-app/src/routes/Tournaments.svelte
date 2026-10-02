<script lang="ts">
  import { formatAmount } from '../lib/format';
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import { getRealtime, realtimeConnected, TOURNAMENT_EVENT_RE } from '../lib/realtime';
  import TopBar from '../components/TopBar.svelte';
  import WorldClock from '../components/WorldClock.svelte';
  import Icon from '../components/Icon.svelte';

  export let onOpenTournament: (id: number) => void = () => {};

  type Filter = 'all' | 'running' | 'registering' | 'scheduled' | 'finished';

  let filter: Filter = 'all';
  let tournaments: any[] = [];
  let loading = true;
  let error = '';
  let pollTimer: any = null;

  function fmt(n: any): string {
    return formatAmount(n);
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
    } catch {
      return '—';
    }
  }

  const FILTERS: { key: Filter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '#d4af37' },
    { key: 'running', label: 'Live', color: '#10b981' },
    { key: 'registering', label: 'Open', color: '#22d3ee' },
    { key: 'scheduled', label: 'Upcoming', color: '#3b82f6' },
    { key: 'finished', label: 'Finished', color: '#6b7280' },
  ];

  async function load() {
    error = '';
    try {
      const statusParam = filter === 'all' ? undefined : filter;
      const res = await api.listTournaments({ status: statusParam });
      if (res.ok && res.data) tournaments = res.data.tournaments || [];
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function onAnyEvent(event: string): void {
    if (TOURNAMENT_EVENT_RE.test(event)) load();
  }

  onMount(() => {
    load();
    pollTimer = setInterval(load, 20000);
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  });

  $: if ($realtimeConnected) {
    const s = getRealtime();
    if (s) {
      s.offAny(onAnyEvent);
      s.onAny(onAnyEvent);
    }
  }

  onDestroy(() => {
    const s = getRealtime();
    if (s) s.offAny(onAnyEvent);
  });

  function statusColor(status: string): string {
    if (status === 'running') return '#10b981';
    if (status === 'final_table') return '#d4af37';
    if (status === 'registering') return '#22d3ee';
    if (status === 'scheduled') return '#3b82f6';
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

  // Featured = running tournament with biggest prize pool
  $: featured =
    tournaments
      .filter((t) => t.status === 'running' || t.status === 'final_table')
      .sort((a, b) => Number(b.totalPrizePool) - Number(a.totalPrizePool))[0] || null;

  $: others = featured ? tournaments.filter((t) => t.id !== featured.id) : tournaments;

  // ─── Summary (derived from the loaded list only) ───
  $: liveCount = tournaments.filter(
    (t) => t.status === 'running' || t.status === 'final_table',
  ).length;
  $: openCount = tournaments.filter((t) => t.status === 'registering').length;
  $: upcomingCount = tournaments.filter((t) => t.status === 'scheduled').length;
  $: playersTotal = tournaments.reduce(
    (sum: number, t: any) =>
      sum + Number(Number(t.activeCount) > 0 ? t.activeCount : t.registeredCount || 0),
    0,
  );
  $: prizeTotal = tournaments.reduce(
    (sum: number, t: any) => sum + Number(t.totalPrizePool || 0),
    0,
  );
  $: freeCount = tournaments.filter((t) => t.mode === 'free' || Number(t.buyIn) === 0).length;
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- HERO -->
  <div class="px-4 mt-2 mb-4">
    <div
      class="rounded-3xl p-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.2) 0%, transparent 60%),
          radial-gradient(ellipse at 0% 100%, rgba(37,99,235,0.14) 0%, transparent 60%),
          linear-gradient(135deg, rgba(20,45,82,0.9) 0%, rgba(15,31,58,0.9) 55%, rgba(7,14,27,0.98) 100%);
        border: 1.5px solid rgba(244,201,93,0.4);
        box-shadow: 0 10px 32px rgba(0,0,0,0.6), 0 0 28px rgba(244,201,93,0.12);
      "
    >
      <div
        class="absolute -top-14 -right-14 w-44 h-44 rounded-full opacity-20 pointer-events-none"
        style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
      ></div>

      <div class="relative flex items-center gap-3">
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style="
            background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
            border: 1.5px solid rgba(244,201,93,0.55);
            box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(244,201,93,0.2);
          "
        >
          <Icon name="trophy" size={24} color="#f4c95d" />
        </div>

        <div class="flex-1 min-w-0">
          <h1
            class="text-[26px] font-extrabold leading-none tracking-tight"
            style="
              background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              filter: drop-shadow(0 2px 8px rgba(244,201,93,0.4));
            "
          >
            Tournaments
          </h1>
          <p class="text-[11px] text-white/50 mt-1 font-bold truncate">
            {loading
              ? 'Loading schedule…'
              : `${tournaments.length} ${tournaments.length === 1 ? 'event' : 'events'} · buy-in, GTD and live levels`}
          </p>
        </div>

        <button
          on:click={load}
          aria-label="Refresh"
          class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all"
          style="
            background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(11,19,36,0.95));
            border: 1px solid rgba(212,175,55,0.3);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          "
        >
          <Icon name="refresh" size={18} color="#f4c95d" />
        </button>
      </div>

      {#if featured}
        <div
          class="relative flex items-center gap-2 mt-3 pt-3"
          style="border-top: 1px solid rgba(244,201,93,0.2);"
        >
          <span
            class="w-1.5 h-1.5 rounded-full animate-pulse"
            style="background: #34d399; box-shadow: 0 0 6px #34d399;"
          ></span>
          <span class="text-[10px] text-white/60 font-bold uppercase tracking-wider">Live now</span>
          <span class="text-[11px] font-extrabold text-white truncate flex-1">{featured.name}</span>
          <span class="text-[11px] font-extrabold text-gold tabular-nums shrink-0">
            ${fmt(featured.totalPrizePool)}
          </span>
        </div>
      {/if}
    </div>
  </div>

  <!-- SUMMARY GRID -->
  <div class="grid grid-cols-2 gap-2 px-4 mb-4">
    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(16,185,129,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
        >
          <Icon name="play" size={12} color="#6ee7b7" />
        </div>
        <span class="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider">Live</span
        >
      </div>
      <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">
        {loading ? '—' : liveCount}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">running or final table</p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(34,211,238,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(34,211,238,0.2); border: 1px solid rgba(34,211,238,0.4);"
        >
          <Icon name="ticket" size={12} color="#22d3ee" />
        </div>
        <span class="text-[9px] font-extrabold text-cyan-300 uppercase tracking-wider">
          Registering
        </span>
      </div>
      <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">
        {loading ? '—' : openCount}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">open for late entry</p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(37,99,235,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(37,99,235,0.3);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(37,99,235,0.2); border: 1px solid rgba(37,99,235,0.4);"
        >
          <Icon name="clock" size={12} color="#93c5fd" />
        </div>
        <span class="text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">
          Upcoming
        </span>
      </div>
      <p class="text-[17px] font-extrabold text-white tabular-nums leading-none">
        {loading ? '—' : upcomingCount}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">scheduled to start</p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(244,201,93,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(244,201,93,0.2); border: 1px solid rgba(244,201,93,0.4);"
        >
          <Icon name="dollar" size={12} color="#f4c95d" />
        </div>
        <span class="text-[9px] font-extrabold text-gold uppercase tracking-wider">Prize Pool</span>
      </div>
      <p class="text-[17px] font-extrabold text-gold tabular-nums leading-none">
        ${loading ? '—' : fmt(prizeTotal)}
      </p>
      <p class="text-[9px] text-white/45 mt-1 font-bold">
        {loading ? '' : `${playersTotal} players · ${freeCount} free`}
      </p>
    </div>
  </div>

  <!-- WORLD CLOCK -->
  <WorldClock />

  <!-- FILTERS -->
  <div class="flex items-center gap-1.5 mb-2.5 px-4">
    <span class="w-1.5 h-1.5 rounded-full bg-gold" style="box-shadow: 0 0 6px #d4af37;"></span>
    <p class="text-[10px] font-extrabold text-white/60 uppercase tracking-widest">
      Filter schedule
    </p>
  </div>

  <!-- FILTERS -->
  <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1 px-4">
    {#each FILTERS as f}
      <button
        on:click={() => {
          filter = f.key;
          loading = true;
          load();
        }}
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
            background-image: url('/bg-tournament.webp');
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
              src="/trophy.webp"
              alt=""
              class="w-24 h-24 object-contain"
              style="filter: drop-shadow(0 8px 20px rgba(212,175,55,0.7));"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-2">
              <span
                class="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider"
                style="background: {sc}30; color: {sc}; border: 1px solid {sc}60;"
              >
                <span
                  class="w-1 h-1 rounded-full"
                  style="background: {sc}; box-shadow: 0 0 4px {sc};"
                ></span>
                {statusLabel(featured.status)}
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
              <span class="flex items-center gap-1">
                <Icon name="users" size={11} />
                <span>{featured.activeCount || featured.registeredCount}/{featured.maxPlayers}</span
                >
              </span>
              <span class="flex items-center gap-1">
                <Icon name="dollar" size={11} />
                <span>${fmt(featured.buyIn)}</span>
              </span>
              {#if featured.status === 'running' || featured.status === 'final_table'}
                <span class="text-gold">Lvl {featured.currentLevel}</span>
              {/if}
            </div>
          </div>
        </div>
      </button>
    </div>
  {/if}

  <!-- LIST HEADER -->
  {#if !loading && !error && (featured || others.length > 0)}
    <div class="flex items-center gap-2 mb-2 px-4">
      <span class="w-1.5 h-1.5 rounded-full bg-gold" style="box-shadow: 0 0 6px #d4af37;"></span>
      <p class="text-[10px] font-extrabold text-white/60 uppercase tracking-widest">
        {featured ? 'More events' : 'All events'}
      </p>
      <span class="ml-auto text-[10px] font-mono text-white/40 tabular-nums">
        {others.length}
        {others.length === 1 ? 'event' : 'events'}
      </span>
    </div>
  {/if}

  <!-- LOADING -->
  {#if loading}
    <div class="space-y-3 px-4">
      {#each Array(3) as _}
        <div
          class="rounded-2xl p-4 h-[120px] shimmer"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else if error}
    <div
      class="rounded-2xl p-4 mx-4 flex flex-col items-center gap-2 text-center"
      style="background: rgba(153,27,27,0.15); border: 1px solid rgba(239,68,68,0.3);"
    >
      <Icon name="warning" size={20} color="#ef4444" />
      <p class="text-red-300 text-sm font-bold">{error}</p>
      <p class="text-[10px] text-white/40 font-bold">Use the refresh button to retry</p>
    </div>
  {:else if others.length === 0 && !featured}
    <div class="px-4">
      <div
        class="rounded-3xl p-8 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
          border: 1px dashed rgba(212,175,55,0.3);
        "
      >
        <div class="flex justify-center mb-3">
          <div
            class="w-16 h-16 rounded-2xl flex items-center justify-center"
            style="
              background: linear-gradient(180deg, rgba(244,201,93,0.18), rgba(168,121,34,0.06));
              border: 1px solid rgba(244,201,93,0.35);
            "
          >
            <Icon name="trophy" size={30} color="rgba(244,201,93,0.65)" />
          </div>
        </div>
        <p class="text-sm font-extrabold text-white">
          No tournaments {filter === 'all' ? 'yet' : `in "${filter}"`}
        </p>
        <p class="text-[11px] text-white/55 mt-1 font-bold">
          New events are added every day — check back soon
        </p>
      </div>
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
          <div
            class="absolute left-0 top-0 bottom-0 w-1.5"
            style="background: linear-gradient(180deg, {sc}, {sc}66); box-shadow: 0 0 12px {sc}80;"
          ></div>

          <div
            class="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 pointer-events-none"
            style="background: radial-gradient(circle, {sc}, transparent 70%);"
          ></div>

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
                  <span class="text-[9px] font-extrabold text-white/60 tracking-wider"
                    >{formatLabel(t)}</span
                  >
                  {#if t.mode === 'free'}
                    <span class="text-[9px] font-extrabold tracking-wider" style="color: #6ee7b7;"
                      >FREE</span
                    >
                  {/if}
                </div>
                <p class="text-[15px] font-extrabold text-white truncate leading-tight">{t.name}</p>
                <p class="text-[10px] text-white/45 mt-1 font-mono uppercase">
                  {t.variant} · {t.speed}
                </p>
              </div>

              <div class="text-right shrink-0">
                <div
                  class="text-[15px] font-extrabold tabular-nums leading-none"
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
                  <div class="text-[10px] text-gold/75 mt-1 tabular-nums">
                    GTD ${fmt(t.guaranteed)}
                  </div>
                {/if}
              </div>
            </div>

            <div
              class="grid grid-cols-3 gap-2 pt-3"
              style="border-top: 1px solid rgba(212,175,55,0.1);"
            >
              <div>
                <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">
                  Players
                </p>
                <p class="text-[14px] font-extrabold text-white tabular-nums">
                  {t.activeCount > 0 ? t.activeCount : t.registeredCount}
                  <span class="text-white/40 font-bold"> / {t.maxPlayers}</span>
                </p>
              </div>
              <div>
                <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">
                  Prize
                </p>
                <p class="text-[14px] font-extrabold tabular-nums" style="color: #6ee7b7;">
                  ${fmt(t.totalPrizePool)}
                </p>
              </div>
              <div>
                <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold mb-0.5">
                  {t.status === 'running' || t.status === 'final_table' ? 'Level' : 'Starts'}
                </p>
                <p class="text-[14px] font-extrabold tabular-nums" style="color: {sc};">
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
