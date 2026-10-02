<script lang="ts">
  import { formatAmount } from '../lib/format';
  import { onMount, onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { api } from '../lib/api';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  type BracketKey = 'bronze' | 'silver' | 'gold';

  const FALLBACK_BRACKETS = [
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

  let brackets: any[] = FALLBACK_BRACKETS;
  let bracket: BracketKey = 'bronze';
  let entries: any[] = [];
  let me: any = null;
  let weekStart = '';
  let poolUsd = 0;
  let paidPlaces = 0;
  let loading = true;
  let now = Date.now();
  let clockTimer: any = null;

  function fmt(n: any): string {
    return formatAmount(n);
  }

  async function load() {
    loading = true;
    try {
      const [cur, mine] = await Promise.all([
        api.request<any>(`/api/weekly-race/current?bracket=${bracket}`),
        api.request<any>('/api/weekly-race/me'),
      ]);
      if (cur.ok && cur.data) {
        if (Array.isArray(cur.data.brackets) && cur.data.brackets.length > 0) {
          brackets = cur.data.brackets;
        }
        entries = cur.data.entries ?? [];
        weekStart = cur.data.weekStart ?? '';
        poolUsd = Number(cur.data.poolUsd ?? 0);
        paidPlaces = Number(cur.data.paidPlaces ?? 0);
      }
      if (mine.ok && mine.data) me = mine.data;
    } catch (e) {
      console.error('[WeeklyRace] load failed', e);
    } finally {
      loading = false;
    }
  }

  function selectBracket(key: BracketKey) {
    bracket = key;
    load();
  }

  onMount(() => {
    load();
    clockTimer = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => {
      if (clockTimer) clearInterval(clockTimer);
    };
  });

  onDestroy(() => {
    if (clockTimer) clearInterval(clockTimer);
  });

  $: resetAt = weekStart ? new Date(`${weekStart}T00:00:00Z`).getTime() + 7 * 86400000 : 0;
  $: remainingMs = Math.max(0, resetAt - now);
  $: countdown = (() => {
    if (remainingMs <= 0) return 'Settling';
    const s = Math.floor(remainingMs / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  })();

  $: activeCfg = brackets.find((b) => b.key === bracket) ?? FALLBACK_BRACKETS[0];
  $: paidEntries = entries.slice(0, paidPlaces);
</script>

<div class="pb-28">
  <TopBar />

  <!-- HEADER -->
  <div class="px-4 mt-2 mb-4">
    <div class="flex items-center gap-3">
      <button
        on:click={onBack}
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);"
      >
        <Icon name="arrow-left" size={16} color="#ffffff" />
      </button>

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
          Weekly Race
        </h1>
        <p class="text-mini text-white/50 mt-1 font-bold">
          Most rake this week wins · resets Monday 00:00 UTC
        </p>
      </div>
    </div>
  </div>

  <!-- POOL + COUNTDOWN -->
  <div class="px-4 mb-3">
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
          <p class="text-micro uppercase tracking-[0.3em] font-extrabold text-gold">
            {activeCfg.label} bracket
          </p>
          <p class="text-mini text-white/50 font-bold mt-1">
            Top {paidPlaces || activeCfg.paidPlaces} paid
          </p>
        </div>
        <div class="text-end">
          <p class="text-micro uppercase tracking-wider text-white/40 font-bold">Resets in</p>
          <p class="text-[13px] font-extrabold text-white tabular-nums">{countdown}</p>
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
          ${fmt(poolUsd || activeCfg.poolUsd)}
        </span>
        <span class="text-mini uppercase tracking-wider text-white/40 font-bold">prize pool</span>
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
            background: {bracket === b.key
            ? 'linear-gradient(180deg, rgba(244,201,93,0.22), rgba(168,121,34,0.08))'
            : 'rgba(0,0,0,0.35)'};
            border: 1px solid {bracket === b.key
            ? 'rgba(244,201,93,0.6)'
            : 'rgba(255,255,255,0.07)'};
            box-shadow: {bracket === b.key ? '0 0 16px rgba(244,201,93,0.2)' : 'none'};
          "
        >
          <p
            class="text-tiny font-extrabold"
            style="color: {bracket === b.key ? b.color : 'rgba(255,255,255,0.6)'};"
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

  <!-- MY RANK -->
  {#if me}
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
          <span class="text-tiny font-extrabold text-black leading-none">
            {me.rank ? `#${me.rank}` : '-'}
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-tiny font-extrabold text-white leading-none">Your position</p>
          <p class="text-micro text-white/50 mt-1 leading-none">
            ${fmt(me.totalRake)} rake · {me.bracketSize} players in {me.bracket}
          </p>
        </div>
        <div class="text-end shrink-0">
          <p class="text-micro text-gold/70 font-bold uppercase tracking-wider leading-none mb-1">
            {me.paid ? 'Won' : 'Est. prize'}
          </p>
          <p class="text-[13px] font-extrabold text-gold tabular-nums leading-none">
            ${fmt(me.prizeUsd)}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- LEADERBOARD -->
  <div class="px-4">
    {#if loading}
      <div class="space-y-1.5">
        {#each Array(6) as _}
          <div
            class="rounded-xl h-[52px]"
            style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"
          ></div>
        {/each}
      </div>
    {:else if entries.length === 0}
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
        <p class="text-mini text-white/50 font-bold mt-1">
          Play real-money hands to enter this week's race
        </p>
      </div>
    {:else}
      <div class="flex items-center gap-2 mb-2">
        <span class="w-1.5 h-1.5 rounded-full bg-gold" style="box-shadow: 0 0 6px #d4af37;"></span>
        <p class="text-mini font-extrabold text-white/60 uppercase tracking-widest">
          {activeCfg.label} standings
        </p>
      </div>

      <div class="space-y-1.5">
        {#each entries as e (e.userId)}
          {@const paidPlace = e.rank <= paidPlaces}
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
              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-tiny font-extrabold tabular-nums"
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
              <p class="text-micro text-white/40 font-bold mt-0.5">
                ${fmt(e.totalRake)} rake
              </p>
            </div>

            {#if e.paid && e.prizeUsd > 0}
              <div class="text-end shrink-0">
                <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums leading-none">
                  +${fmt(e.prizeUsd)}
                </p>
                <p class="text-[8px] text-white/35 font-bold mt-0.5">paid</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      {#if paidEntries.length === 0}
        <p class="text-micro text-white/35 font-bold text-center mt-3">
          Prizes unlock once the week settles
        </p>
      {/if}
    {/if}
  </div>
</div>
