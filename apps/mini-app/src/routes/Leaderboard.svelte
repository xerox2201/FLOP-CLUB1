<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { api } from '../lib/api';
  import Icon from '../components/Icon.svelte';

  export let onNavigate: (page: string) => void = () => {};

  let loading = true;
  let period: any = null;
  let entries: any[] = [];
  let myEntry: any = null;
  let myRank: number | null = null;
  let displayPrizePool = 0;
  let refreshTimer: any = null;
  let now = Date.now();
  let clockTimer: any = null;

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }
  function handsLabel(n: number): string {
    return n === 1 ? 'hand' : 'hands';
  }
  function normalize(e: any, idx: number) {
    return {
      user_id: e.user_id ?? e.userId ?? e.id,
      rank: e.rank ?? idx + 1,
      avatar_id: e.avatar_id ?? e.avatarId ?? 'spade',
      display_name: e.display_name ?? e.name ?? 'Player',
      hands_played: e.hands_played ?? 0,
      total_won_usd: e.total_won_usd ?? 0,
      prize_usd: e.prize_usd ?? 0,
    };
  }

  async function loadAll() {
    try {
      const [cur, me] = await Promise.all([
        api.request<any>('/api/leaderboard/current'),
        api.request<any>('/api/leaderboard/me'),
      ]);
      if (cur.ok && cur.data) {
        period = cur.data.period ?? null;
        const raw = cur.data.entries ?? cur.data.leaderboard ?? [];
        entries = raw.map((e: any, i: number) => normalize(e, i));
        displayPrizePool = cur.data.livePrizePool ?? cur.data.prizePool ?? 0;
      }
      if (me.ok && me.data) {
        myEntry = me.data.entry ? normalize(me.data.entry, 0) : null;
        myRank = me.data.liveRank ?? me.data.rank ?? null;
      }
    } catch (e) {
      console.error('[Leaderboard] load failed', e);
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    try {
      const res = await api.request<any>('/api/leaderboard/current');
      if (res.ok && res.data) {
        const raw = res.data.entries ?? res.data.leaderboard ?? [];
        entries = raw.map((e: any, i: number) => normalize(e, i));
        period = res.data.period ?? null;
        displayPrizePool = res.data.livePrizePool ?? res.data.prizePool ?? 0;
      }
    } catch {
      // silent — keep the last known leaderboard
    }
  }

  onMount(async () => {
    await loadAll();
    refreshTimer = setInterval(refresh, 5000);
    clockTimer = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (clockTimer) clearInterval(clockTimer);
  });

  // Countdown to period end
  $: endAt = period?.period_end ? new Date(period.period_end).getTime() : 0;
  $: remainingMs = Math.max(0, endAt - now);
  $: countdown = (() => {
    if (remainingMs <= 0) return 'Ended';
    const s = Math.floor(remainingMs / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  })();

  // ─── Prize distribution ───
  const PRIZE_DISTRIBUTION = [
    { from: 1, to: 1, pct: 0.21, label: '1st' },
    { from: 2, to: 2, pct: 0.12, label: '2nd' },
    { from: 3, to: 3, pct: 0.08, label: '3rd' },
    { from: 4, to: 4, pct: 0.06, label: '4th' },
    { from: 5, to: 5, pct: 0.05, label: '5th' },
    { from: 6, to: 10, pct: 0.04, label: '6-10' },
    { from: 11, to: 15, pct: 0.025, label: '11-15' },
    { from: 16, to: 20, pct: 0.015, label: '16-20' },
    { from: 21, to: 25, pct: 0.01, label: '21-25' },
    { from: 26, to: 30, pct: 0.006, label: '26-30' },
  ];

  function pctForRank(rank: number): number {
    const tier = PRIZE_DISTRIBUTION.find((t) => rank >= t.from && rank <= t.to);
    return tier ? tier.pct : 0;
  }

  function prizeForRank(rank: number, pool: number): number {
    const pct = pctForRank(rank);
    if (pct === 0) return 0;
    return Math.round(pool * pct * 100) / 100;
  }

  // Season name
  $: seasonName = (() => {
    if (!period?.period_start) return 'Season';
    try {
      const d = new Date(period.period_start);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return 'Season';
    }
  })();

  $: first = entries[0] ?? null;
  $: second = entries[1] ?? null;
  $: third = entries[2] ?? null;
  $: rest = entries.slice(3);

  // ─── Weekly Rake Race (tab) ───
  type RaceBracketKey = 'bronze' | 'silver' | 'gold';

  const RACE_FALLBACK = [
    {
      key: 'bronze',
      label: 'Bronze',
      minRake: 0,
      maxRake: 50,
      poolUsd: 100,
      paidPlaces: 20,
      color: '#c98a3e',
    },
    {
      key: 'silver',
      label: 'Silver',
      minRake: 50,
      maxRake: 500,
      poolUsd: 500,
      paidPlaces: 30,
      color: '#cbd5e1',
    },
    {
      key: 'gold',
      label: 'Gold',
      minRake: 500,
      maxRake: null,
      poolUsd: 2000,
      paidPlaces: 50,
      color: '#f4c95d',
    },
  ];

  let view: 'season' | 'race' = 'season';
  let raceBracket: RaceBracketKey = 'bronze';
  let raceBrackets: any[] = [];
  let raceEntries: any[] = [];
  let raceMe: any = null;
  let raceWeekStart = '';
  let racePoolUsd = 0;
  let racePaidPlaces = 0;
  let raceLoading = false;

  $: brackets = raceBrackets.length > 0 ? raceBrackets : RACE_FALLBACK;
  $: raceBracketLabel = brackets.find((b: any) => b.key === raceBracket)?.label ?? raceBracket;

  function selectView(v: 'season' | 'race') {
    view = v;
    if (v === 'race') loadRace();
  }

  function selectBracket(key: RaceBracketKey) {
    raceBracket = key;
    loadRace();
  }

  async function loadRace() {
    raceLoading = true;
    try {
      const [cur, mine] = await Promise.all([
        api.request<any>(`/api/weekly-race/current?bracket=${raceBracket}`),
        api.request<any>('/api/weekly-race/me'),
      ]);
      if (cur.ok && cur.data) {
        if (Array.isArray(cur.data.brackets) && cur.data.brackets.length > 0) {
          raceBrackets = cur.data.brackets;
        }
        raceEntries = cur.data.entries ?? [];
        raceWeekStart = cur.data.weekStart ?? '';
        racePoolUsd = Number(cur.data.poolUsd ?? 0);
        racePaidPlaces = Number(cur.data.paidPlaces ?? 0);
      }
      if (mine.ok && mine.data) raceMe = mine.data;
    } catch (e) {
      console.error('[Leaderboard] weekly race load failed', e);
    } finally {
      raceLoading = false;
    }
  }

  $: raceResetAt = raceWeekStart
    ? new Date(`${raceWeekStart}T00:00:00Z`).getTime() + 7 * 86400000
    : 0;
  $: raceRemainingMs = Math.max(0, raceResetAt - now);
  $: raceCountdown = (() => {
    if (raceRemainingMs <= 0) return 'Settling';
    const s = Math.floor(raceRemainingMs / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  })();
</script>

<div class="pb-28">
  <TopBar />

  <!-- VIEW TABS -->
  <div class="px-4 mt-2">
    <div
      class="flex gap-1.5 p-1 rounded-2xl"
      style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06);"
    >
      <button
        on:click={() => selectView('season')}
        class="flex-1 rounded-xl py-2 text-[11px] font-extrabold transition"
        style="
          background: {view === 'season'
          ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
          : 'transparent'};
          color: {view === 'season' ? '#0a0800' : 'rgba(255,255,255,0.6)'};
        "
      >
        Season
      </button>
      <button
        on:click={() => selectView('race')}
        class="flex-1 rounded-xl py-2 text-[11px] font-extrabold transition"
        style="
          background: {view === 'race'
          ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
          : 'transparent'};
          color: {view === 'race' ? '#0a0800' : 'rgba(255,255,255,0.6)'};
        "
      >
        Weekly Race
      </button>
    </div>
  </div>

  {#if view === 'season'}
    <!-- HEADER -->
    <div class="px-4 mt-2 mb-4">
      <div class="flex items-center gap-3">
        <!-- Trophy icon -->
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
          style="
          background:
            radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
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
            Leaderboard
          </h1>
          {#if period?.period_start}
            <p class="text-[10px] text-gold/70 mt-1 uppercase tracking-[0.2em] font-extrabold">
              {seasonName}
            </p>
          {:else}
            <p class="text-[10px] text-white/40 mt-1 font-bold">Top players this month</p>
          {/if}
        </div>

        {#if period && remainingMs > 0}
          <div
            class="rounded-2xl px-3 py-2 flex flex-col items-end shrink-0 relative overflow-hidden"
            style="
            background:
              radial-gradient(ellipse at 100% 0%, rgba(239,68,68,0.15) 0%, transparent 70%),
              linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
            border: 1px solid rgba(239,68,68,0.4);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          "
          >
            <div class="flex items-center gap-1 mb-1">
              <span
                class="w-1 h-1 rounded-full bg-red-500 animate-pulse"
                style="box-shadow: 0 0 4px #ef4444;"
              ></span>
              <span
                class="text-[8px] font-extrabold text-red-400 uppercase tracking-wider leading-none"
              >
                Ends in
              </span>
            </div>
            <span class="text-[12px] font-extrabold text-white tabular-nums leading-none">
              {countdown}
            </span>
          </div>
        {/if}
      </div>
    </div>

    <!-- PRIZE POOL HERO -->
    <div class="px-4 mb-4">
      <div
        class="rounded-3xl p-4 relative overflow-hidden"
        style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.28) 0%, transparent 60%),
          radial-gradient(ellipse at 0% 100%, rgba(139,92,246,0.15) 0%, transparent 60%),
          linear-gradient(135deg, #142d52 0%, #1a1240 60%, #05080f 100%);
        border: 1.5px solid rgba(244,201,93,0.45);
        box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(244,201,93,0.15);
      "
      >
        <!-- Decorative glow -->
        <div
          class="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-25 pointer-events-none"
          style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
        ></div>

        <div class="relative">
          <div class="flex items-center gap-2 mb-1.5">
            <Icon name="trophy" size={14} color="#f4c95d" />
            <p class="text-[10px] uppercase tracking-widest text-gold/80 font-extrabold">
              Prize Pool
            </p>
            <span
              class="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4);"
            >
              <span
                class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"
                style="box-shadow: 0 0 4px #34d399;"
              ></span>
              <span class="text-[8px] font-extrabold text-emerald-300 tracking-wider">LIVE</span>
            </span>
          </div>

          <div class="flex items-baseline gap-2 mb-3">
            <span
              class="text-5xl font-extrabold tabular-nums leading-none"
              style="
              background: linear-gradient(180deg, #f4e5a8, #f4c95d 45%, #a87a15);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              letter-spacing: -0.03em;
              filter: drop-shadow(0 0 20px rgba(244,201,93,0.3));
            "
            >
              ${fmt(displayPrizePool)}
            </span>
          </div>

          <div
            class="flex items-center justify-between pt-3"
            style="border-top: 1px solid rgba(244,201,93,0.2);"
          >
            <div class="flex items-center gap-1.5">
              <Icon name="users" size={11} color="rgba(255,255,255,0.5)" />
              <span class="text-[10px] text-white/60 font-bold"> Top 30 paid out </span>
            </div>
            {#if period}
              <span class="text-[9px] font-mono text-white/40">
                {period.period_start?.slice(5, 10)} → {period.period_end?.slice(5, 10)}
              </span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- CONTENT -->
    {#if loading}
      <div class="px-4 space-y-3">
        {#each Array(4) as _}
          <div
            class="rounded-2xl h-[72px]"
            style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"
          ></div>
        {/each}
      </div>
    {:else if entries.length === 0}
      <div class="px-4">
        <div
          class="rounded-2xl p-6 text-center relative overflow-hidden"
          style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(212,175,55,0.3);
        "
        >
          <div class="flex justify-center mb-3">
            <img
              src="/leaderboard-empty.png"
              alt=""
              class="w-32 h-32 object-contain"
              style="filter: drop-shadow(0 8px 24px rgba(244,201,93,0.4));"
              draggable="false"
            />
          </div>
          <p class="text-sm font-extrabold text-white">Season hasn't started</p>
          <p class="text-[11px] text-white/55 mt-1 font-bold">
            Play real-money hands to appear on the board
          </p>
        </div>
      </div>
    {:else}
      <!-- PODIUM -->
      {#if first}
        <div class="px-4 mb-4">
          <div class="grid grid-cols-3 gap-2 items-end">
            <!-- 2nd -->
            <div class="flex flex-col items-center" style="order: 1;">
              {#if second}
                <div class="flex flex-col items-center">
                  <!-- Silver medal — above avatar -->
                  <img
                    src="/medal-silver.png"
                    alt="2nd"
                    class="w-11 h-11 object-contain relative z-30"
                    style="filter: drop-shadow(0 6px 14px rgba(148,163,184,0.8));"
                    draggable="false"
                  />

                  <div
                    class="rounded-full p-[3px] relative z-20 mt-1.5"
                    style="
                    background: linear-gradient(180deg, #e5e7eb, #94a3b8 50%, #475569);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.7), 0 0 16px rgba(148,163,184,0.4);
                  "
                  >
                    <div
                      class="w-16 h-16 rounded-full overflow-hidden"
                      style="background: radial-gradient(circle, #1a3a5c, #05080f);"
                    >
                      <img
                        src="/avatars/avatar-{second.avatar_id}.png"
                        alt={second.display_name}
                        class="w-full h-full object-cover"
                        style="transform: scale(1.18);"
                        draggable="false"
                      />
                    </div>
                  </div>
                </div>

                <div
                  class="w-full rounded-2xl pt-3 pb-2.5 px-2 text-center relative overflow-hidden mt-2"
                  style="
                  min-height: 106px;
                  background:
                    radial-gradient(ellipse at 50% 0%, rgba(148,163,184,0.15) 0%, transparent 60%),
                    linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
                  border: 1px solid rgba(148,163,184,0.35);
                  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                "
                >
                  <p class="text-[11px] font-extrabold text-white truncate leading-tight">
                    {second.display_name}
                  </p>
                  <p
                    class="text-[12px] font-extrabold text-emerald-400 tabular-nums mt-1 leading-none"
                  >
                    +${fmt(second.total_won_usd)}
                  </p>
                  <div
                    class="mt-1.5 pt-1.5 flex items-center justify-center gap-1"
                    style="border-top: 1px solid rgba(148,163,184,0.2);"
                  >
                    <Icon name="trophy" size={9} color="#cbd5e1" />
                    <span
                      class="text-[10px] font-extrabold text-slate-200 tabular-nums leading-none"
                    >
                      ${fmt(prizeForRank(2, displayPrizePool))}
                    </span>
                    <span class="text-[8px] text-white/40 font-bold leading-none"> prize </span>
                  </div>
                  <p class="text-[8px] text-white/35 mt-0.5">
                    {second.hands_played} hands
                  </p>
                </div>
              {:else}
                <div
                  class="w-full rounded-2xl h-[130px]"
                  style="border: 1px dashed rgba(255,255,255,0.08);"
                ></div>
              {/if}
            </div>

            <!-- 1st -->
            <div class="flex flex-col items-center" style="order: 2;">
              {#if first}
                <div class="flex flex-col items-center">
                  <!-- Crown ABOVE everything -->
                  <img
                    src="/crown.webp"
                    alt=""
                    class="w-7 h-7 object-contain relative z-40"
                    style="filter: drop-shadow(0 4px 10px rgba(244,201,93,0.9));"
                    draggable="false"
                  />

                  <!-- Gold medal — above avatar, no overlap -->
                  <img
                    src="/medal-gold.png"
                    alt="1st"
                    class="w-12 h-12 object-contain relative z-30 mt-0.5"
                    style="filter: drop-shadow(0 8px 20px rgba(244,201,93,0.9));"
                    draggable="false"
                  />

                  <!-- Avatar circle below medal -->
                  <div
                    class="rounded-full p-[3px] relative z-20 mt-1.5"
                    style="
                    background: linear-gradient(180deg, #f4e5a8, #d4af37 50%, #a87a15);
                    box-shadow: 0 6px 18px rgba(0,0,0,0.8), 0 0 24px rgba(244,201,93,0.7);
                  "
                  >
                    <div
                      class="w-16 h-16 rounded-full overflow-hidden"
                      style="background: radial-gradient(circle, #1a3a5c, #05080f);"
                    >
                      <img
                        src="/avatars/avatar-{first.avatar_id}.png"
                        alt={first.display_name}
                        class="w-full h-full object-cover"
                        style="transform: scale(1.18);"
                        draggable="false"
                      />
                    </div>
                  </div>
                </div>

                <div
                  class="w-full rounded-2xl pt-3 pb-2.5 px-2 text-center relative overflow-hidden mt-2"
                  style="
                  min-height: 118px;
                  background:
                    radial-gradient(ellipse at 50% 0%, rgba(244,201,93,0.25) 0%, transparent 60%),
                    linear-gradient(180deg, rgba(20,45,82,0.9), rgba(7,14,27,0.95));
                  border: 1.5px solid rgba(244,201,93,0.55);
                  box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 24px rgba(244,201,93,0.25);
                "
                >
                  <p
                    class="text-[12px] font-extrabold leading-tight truncate"
                    style="
                    background: linear-gradient(180deg, #ffffff, #f4e5a8);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                  "
                  >
                    {first.display_name}
                  </p>
                  <p
                    class="text-[13px] font-extrabold text-emerald-400 tabular-nums mt-1 leading-none"
                  >
                    +${fmt(first.total_won_usd)}
                  </p>
                  <div
                    class="mt-1.5 pt-1.5 flex items-center justify-center gap-1"
                    style="border-top: 1px solid rgba(244,201,93,0.2);"
                  >
                    <Icon name="trophy" size={9} color="#f4c95d" />
                    <span class="text-[10px] font-extrabold text-gold tabular-nums leading-none">
                      ${fmt(prizeForRank(1, displayPrizePool))}
                    </span>
                    <span class="text-[8px] text-white/40 font-bold leading-none"> prize </span>
                  </div>
                  <p class="text-[8px] text-white/35 mt-0.5">
                    {first.hands_played} hands
                  </p>
                </div>
              {:else}
                <div
                  class="w-full rounded-2xl h-[160px]"
                  style="border: 1px dashed rgba(255,255,255,0.08);"
                ></div>
              {/if}
            </div>

            <!-- 3rd -->
            <div class="flex flex-col items-center" style="order: 3;">
              {#if third}
                <div class="flex flex-col items-center">
                  <!-- Bronze medal — above avatar -->
                  <img
                    src="/medal-bronze.png"
                    alt="3rd"
                    class="w-11 h-11 object-contain relative z-30"
                    style="filter: drop-shadow(0 6px 14px rgba(217,119,6,0.8));"
                    draggable="false"
                  />

                  <div
                    class="rounded-full p-[3px] relative z-20 mt-1.5"
                    style="
                    background: linear-gradient(180deg, #d97706, #92400e 50%, #451a03);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.7), 0 0 16px rgba(217,119,6,0.4);
                  "
                  >
                    <div
                      class="w-16 h-16 rounded-full overflow-hidden"
                      style="background: radial-gradient(circle, #1a3a5c, #05080f);"
                    >
                      <img
                        src="/avatars/avatar-{third.avatar_id}.png"
                        alt={third.display_name}
                        class="w-full h-full object-cover"
                        style="transform: scale(1.18);"
                        draggable="false"
                      />
                    </div>
                  </div>
                </div>

                <div
                  class="w-full rounded-2xl pt-3 pb-2.5 px-2 text-center relative overflow-hidden mt-2"
                  style="
                  min-height: 96px;
                  background:
                    radial-gradient(ellipse at 50% 0%, rgba(217,119,6,0.15) 0%, transparent 60%),
                    linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
                  border: 1px solid rgba(217,119,6,0.35);
                  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                "
                >
                  <p class="text-[11px] font-extrabold text-white truncate leading-tight">
                    {third.display_name}
                  </p>
                  <p
                    class="text-[12px] font-extrabold text-emerald-400 tabular-nums mt-1 leading-none"
                  >
                    +${fmt(third.total_won_usd)}
                  </p>
                  <div
                    class="mt-1.5 pt-1.5 flex items-center justify-center gap-1"
                    style="border-top: 1px solid rgba(217,119,6,0.2);"
                  >
                    <Icon name="trophy" size={9} color="#d97706" />
                    <span
                      class="text-[10px] font-extrabold tabular-nums leading-none"
                      style="color: #f59e0b;"
                    >
                      ${fmt(prizeForRank(3, displayPrizePool))}
                    </span>
                    <span class="text-[8px] text-white/40 font-bold leading-none"> prize </span>
                  </div>
                  <p class="text-[8px] text-white/35 mt-0.5">
                    {third.hands_played} hands
                  </p>
                </div>
              {:else}
                <div
                  class="w-full rounded-2xl h-[120px]"
                  style="border: 1px dashed rgba(255,255,255,0.08);"
                ></div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- REST -->
      {#if rest.length === 0 && entries.length < 10}
        <div class="px-4 mb-4">
          <div
            class="rounded-2xl p-4 flex items-center gap-3"
            style="
            background:
              radial-gradient(ellipse at 0% 50%, rgba(212,175,55,0.12) 0%, transparent 60%),
              linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
            border: 1px dashed rgba(212,175,55,0.35);
          "
          >
            <div
              class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style="
              background: linear-gradient(180deg, rgba(244,201,93,0.2), rgba(168,121,34,0.08));
              border: 1px solid rgba(244,201,93,0.4);
            "
            >
              <Icon name="target" size={20} color="#f4c95d" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-extrabold text-white mb-1">Climb the ranks</p>
              <p class="text-[10px] text-white/55 font-bold">
                Play real-money hands to appear on this board
              </p>
            </div>
            <Icon name="arrow-right" size={16} color="#f4c95d" />
          </div>
        </div>
      {/if}

      {#if rest.length > 0}
        <div class="px-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-1.5 h-1.5 rounded-full bg-gold" style="box-shadow: 0 0 6px #d4af37;"
            ></span>
            <p class="text-[10px] font-extrabold text-white/60 uppercase tracking-widest">
              Rank 4 — {entries.length}
            </p>
          </div>

          <div class="space-y-1.5">
            {#each rest as e (e.user_id)}
              {@const isMe = e.user_id === myEntry?.user_id}
              {@const rankPrize = prizeForRank(e.rank, displayPrizePool)}
              <div
                class="rounded-xl px-3 py-2.5 flex items-center gap-3 relative overflow-hidden"
                style="
                background:
                  {isMe
                  ? 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.03))'
                  : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
                border: 1px solid {isMe ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.06)'};
                {isMe ? 'box-shadow: 0 0 16px rgba(212,175,55,0.2);' : ''}
              "
              >
                <!-- Rank -->
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-extrabold tabular-nums"
                  style="
                  background: {isMe ? 'rgba(212,175,55,0.2)' : 'rgba(0,0,0,0.4)'};
                  color: {isMe ? '#f4e5a8' : 'rgba(255,255,255,0.55)'};
                  border: 1px solid {isMe ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.08)'};
                "
                >
                  #{e.rank}
                </div>

                <!-- Avatar -->
                <div
                  class="w-9 h-9 rounded-full overflow-hidden shrink-0"
                  style="background: radial-gradient(circle, #1a3a5c, #05080f);"
                >
                  <img
                    src="/avatars/avatar-{e.avatar_id}.png"
                    alt={e.display_name}
                    class="w-full h-full object-cover"
                    style="transform: scale(1.15);"
                    draggable="false"
                  />
                </div>

                <!-- Name -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <p
                      class="text-[12px] font-extrabold truncate leading-tight"
                      style="color: {isMe ? '#f4e5a8' : '#ffffff'};"
                    >
                      {e.display_name}
                    </p>
                    {#if isMe}
                      <span
                        class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
                        style="
                        background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
                        color: #0a0800;
                      "
                      >
                        YOU
                      </span>
                    {/if}
                  </div>
                  <p class="text-[9px] text-white/40 mt-0.5 font-bold">
                    {e.hands_played}
                    {handsLabel(e.hands_played)}
                  </p>
                </div>

                <!-- Amount -->
                <div class="text-right shrink-0">
                  <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums leading-none">
                    +${fmt(e.total_won_usd)}
                  </p>
                  {#if rankPrize > 0}
                    <div class="flex items-center gap-1 justify-end mt-1 leading-none">
                      <Icon name="trophy" size={9} color="#d4af37" />
                      <span class="text-[9px] font-bold text-gold tabular-nums">
                        ${fmt(rankPrize)}
                      </span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  {/if}

  <!-- ============ WEEKLY RAKE RACE ============ -->
  {#if view === 'race'}
    <div class="px-4 mt-3 mb-3">
      <div
        class="rounded-2xl p-4 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.22) 0%, transparent 60%),
            linear-gradient(135deg, #142d52 0%, #1a1240 60%, #05080f 100%);
          border: 1.5px solid rgba(244,201,93,0.4);
          box-shadow: 0 10px 32px rgba(0,0,0,0.5);
        "
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[9px] uppercase tracking-[0.3em] font-extrabold text-gold">
              {raceBracketLabel} bracket
            </p>
            <p class="text-[10px] text-white/50 font-bold mt-1">
              Top {racePaidPlaces || 20} paid
            </p>
          </div>
          <div class="text-right">
            <p class="text-[9px] uppercase tracking-wider text-white/40 font-bold">Resets in</p>
            <p class="text-[13px] font-extrabold text-white tabular-nums">{raceCountdown}</p>
          </div>
        </div>

        <div class="flex items-baseline gap-2 mt-3">
          <span
            class="text-4xl font-extrabold tabular-nums leading-none"
            style="
              background: linear-gradient(180deg, #f4e5a8, #f4c95d 45%, #a87a15);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              letter-spacing: -0.03em;
            "
          >
            ${fmt(racePoolUsd)}
          </span>
          <span class="text-[10px] uppercase tracking-wider text-white/40 font-bold">
            prize pool
          </span>
        </div>
      </div>
    </div>

    <!-- BRACKET SELECTOR -->
    <div class="px-4 mb-3">
      <div class="grid grid-cols-3 gap-2">
        {#each brackets as b (b.key)}
          <button
            on:click={() => selectBracket(b.key)}
            class="rounded-xl py-2.5 px-2 text-center active:scale-95 transition"
            style="
              background: {raceBracket === b.key
              ? 'linear-gradient(180deg, rgba(244,201,93,0.22), rgba(168,121,34,0.08))'
              : 'rgba(0,0,0,0.35)'};
              border: 1px solid {raceBracket === b.key
              ? 'rgba(244,201,93,0.6)'
              : 'rgba(255,255,255,0.07)'};
              box-shadow: {raceBracket === b.key ? '0 0 16px rgba(244,201,93,0.2)' : 'none'};
            "
          >
            <p
              class="text-[11px] font-extrabold"
              style="color: {raceBracket === b.key ? b.color : 'rgba(255,255,255,0.6)'};"
            >
              {b.label}
            </p>
            <p class="text-[8px] font-bold text-white/40 mt-0.5">
              {b.maxRake ? `$${b.minRake}-$${b.maxRake}` : `$${b.minRake}+`}
            </p>
          </button>
        {/each}
      </div>
    </div>

    <!-- FULL PAGE LINK -->
    <div class="px-4 mb-3">
      <button
        on:click={() => onNavigate('weekly-race')}
        class="w-full rounded-xl py-2.5 flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
        style="background: rgba(0,0,0,0.35); border: 1px solid rgba(244,201,93,0.35);"
      >
        <span class="text-[11px] font-extrabold text-gold">Open full Weekly Race page</span>
        <Icon name="arrow-right" size={11} color="#f4c95d" />
      </button>
    </div>

    <!-- MY RANK (pinned) -->
    {#if raceMe}
      <div class="px-4 mb-3">
        <div
          class="rounded-2xl p-3 flex items-center gap-3"
          style="
            background: linear-gradient(90deg, rgba(244,201,93,0.15), rgba(244,201,93,0.02));
            border: 1px solid rgba(244,201,93,0.45);
          "
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style="
              background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
              box-shadow: 0 2px 0 #7a560a;
            "
          >
            <span class="text-[11px] font-extrabold text-black leading-none">
              {raceMe.rank ? `#${raceMe.rank}` : '-'}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-extrabold text-white leading-none">Your position</p>
            <p class="text-[9px] text-white/50 mt-1 leading-none">
              ${fmt(raceMe.totalRake)} rake · {raceMe.bracketSize} players
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[9px] text-gold/70 font-bold uppercase tracking-wider leading-none mb-1">
              {raceMe.paid ? 'Won' : 'Est. prize'}
            </p>
            <p class="text-[13px] font-extrabold text-gold tabular-nums leading-none">
              ${fmt(raceMe.prizeUsd)}
            </p>
          </div>
        </div>
      </div>
    {/if}

    <!-- STANDINGS -->
    <div class="px-4">
      {#if raceLoading}
        <div class="space-y-1.5">
          {#each Array(6) as _}
            <div
              class="rounded-xl h-[52px]"
              style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"
            ></div>
          {/each}
        </div>
      {:else if raceEntries.length === 0}
        <div
          class="rounded-2xl p-6 text-center"
          style="
            background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
            border: 1px dashed rgba(212,175,55,0.3);
          "
        >
          <div class="flex justify-center mb-3">
            <Icon name="trophy" size={28} color="#f4c95d" />
          </div>
          <p class="text-[12px] font-extrabold text-white">No racers yet</p>
          <p class="text-[10px] text-white/50 font-bold mt-1">
            Play real-money hands to enter this week's race
          </p>
        </div>
      {:else}
        <div class="space-y-1.5">
          {#each raceEntries as e (e.userId)}
            {@const paidPlace = e.rank <= (racePaidPlaces || 20)}
            <div
              class="rounded-xl px-3 py-2.5 flex items-center gap-3"
              style="
                background: {paidPlace
                ? 'linear-gradient(90deg, rgba(244,201,93,0.12), rgba(244,201,93,0.02))'
                : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9))'};
                border: 1px solid {paidPlace ? 'rgba(244,201,93,0.35)' : 'rgba(255,255,255,0.06)'};
              "
            >
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-extrabold tabular-nums"
                style="
                  background: {e.rank === 1
                  ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                  : 'rgba(0,0,0,0.4)'};
                  color: {e.rank === 1 ? '#0a0800' : 'rgba(255,255,255,0.6)'};
                  border: 1px solid {e.rank === 1
                  ? 'rgba(255,235,170,0.6)'
                  : 'rgba(255,255,255,0.08)'};
                "
              >
                #{e.rank}
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-[12px] font-extrabold text-white truncate leading-tight">
                  {e.displayName}
                </p>
                <p class="text-[9px] text-white/40 font-bold mt-0.5">
                  ${fmt(e.totalRake)} rake
                </p>
              </div>

              {#if e.paid && e.prizeUsd > 0}
                <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums shrink-0">
                  +${fmt(e.prizeUsd)}
                </p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- STICKY: MY RANK -->
{#if view === 'season' && myRank && (myEntry || myRank > 30)}
  <div
    class="fixed bottom-20 left-4 right-4 max-w-[480px] mx-auto rounded-2xl p-3 flex items-center gap-3 z-30"
    style="
      background:
        radial-gradient(ellipse at 0% 0%, rgba(244,201,93,0.15) 0%, transparent 60%),
        linear-gradient(180deg, rgba(8,13,36,0.98), rgba(5,8,15,0.98));
      border: 1.5px solid rgba(244,201,93,0.5);
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 24px rgba(244,201,93,0.2);
    "
  >
    <div
      class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style="
        background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
        box-shadow: 0 2px 0 #7a560a, 0 4px 12px rgba(212,175,55,0.4);
      "
    >
      <span class="text-[12px] font-extrabold text-black leading-none">
        {myRank <= 3 ? '★' : `#${myRank}`}
      </span>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-[11px] font-extrabold text-white leading-none">Your Rank</p>
      <p class="text-[9px] text-white/50 mt-1 leading-none">
        {myEntry?.hands_played || 0} hands · +${fmt(myEntry?.total_won_usd || 0)}
      </p>
    </div>
    {#if myEntry?.prize_usd > 0}
      <div class="text-right shrink-0">
        <p class="text-[9px] text-gold/70 font-bold uppercase tracking-wider leading-none mb-1">
          Prize
        </p>
        <p class="text-[13px] font-extrabold text-gold tabular-nums leading-none">
          ${fmt(myEntry.prize_usd)}
        </p>
      </div>
    {/if}
  </div>
{/if}
