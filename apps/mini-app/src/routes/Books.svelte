<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  type Period = '24h' | '7d' | '30d' | 'all';

  let period: Period = '24h';
  let loading = true;
  let error = '';
  let data: any = null;
  let refreshTimer: any = null;

  const PERIODS: { key: Period; label: string }[] = [
    { key: '24h', label: '24h' },
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: 'all', label: 'All' },
  ];

  function fmt(n: any, digits = 2): string {
    return Number(Number(n || 0).toFixed(digits)).toFixed(digits);
  }

  function fmtPct(x: any, digits = 1): string {
    return `${(Number(x || 0) * 100).toFixed(digits)}%`;
  }

  function fmtGeneratedAt(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<any>(`/api/books?period=${period}`);
      if (res.ok && res.data) data = res.data;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function setPeriod(p: Period) {
    period = p;
    load();
  }

  onMount(() => {
    load();
    refreshTimer = setInterval(load, 60_000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
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
      <Icon name="chart" size={22} color="#60a5fa" />
      <span>Live Books</span>
    </h1>
  </div>

  <!-- Intro banner -->
  <div class="px-4 mb-3">
    <div
      class="rounded-2xl p-4"
      style="background: radial-gradient(ellipse at 100% 0%, rgba(96,165,250,0.18) 0%, transparent 60%), linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(96,165,250,0.35);"
    >
      <div class="flex items-start gap-3">
        <div
          class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style="background: rgba(96,165,250,0.2); border: 1px solid rgba(96,165,250,0.5);"
        >
          <Icon name="shield" size={20} color="#60a5fa" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[12px] font-extrabold text-blue-200 mb-1">
            Every dollar in. Every dollar out. Live.
          </p>
          <p class="text-[10px] text-white/60 leading-relaxed">
            We publish our books publicly. You see exactly where the money goes. No tricks, no
            hidden rake, no fine print.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Period switcher -->
  <div class="flex gap-1.5 px-4 mb-3">
    {#each PERIODS as p}
      <button
        on:click={() => setPeriod(p.key)}
        class="flex-1 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider active:scale-95 transition-all"
        style="
          background: {period === p.key
          ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
          : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
          color: {period === p.key ? '#0a0800' : 'rgba(255,255,255,0.65)'};
          border: 1px solid {period === p.key ? 'transparent' : 'rgba(212,175,55,0.15)'};
        "
      >
        {p.label}
      </button>
    {/each}
  </div>

  {#if loading && !data}
    <div class="px-4 space-y-3">
      {#each Array(3) as _}
        <div class="rounded-2xl h-[110px]" style="background: rgba(15,31,58,0.6);"></div>
      {/each}
    </div>
  {:else if error}
    <div
      class="mx-4 rounded-2xl p-4 text-center"
      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"
    >
      <p class="text-sm text-red-300 font-bold">{error}</p>
      <button on:click={load} class="mt-2 text-[11px] text-gold font-bold">Retry</button>
    </div>
  {:else if data}
    <!-- Hero: Return % -->
    <div class="px-4 mb-3">
      <div
        class="rounded-3xl p-5 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.25) 0%, transparent 60%),
            radial-gradient(ellipse at 0% 100%, rgba(244,201,93,0.15) 0%, transparent 60%),
            linear-gradient(135deg, #142d52 0%, #0a1a33 60%, #05080f 100%);
          border: 1.5px solid rgba(16,185,129,0.45);
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(16,185,129,0.15);
        "
      >
        <div class="relative">
          <p class="text-[10px] uppercase tracking-widest text-emerald-300/80 font-bold mb-1">
            Returned to Players
          </p>
          <div class="flex items-baseline gap-2 mb-3">
            <span class="text-5xl font-extrabold tabular-nums leading-none text-emerald-400">
              {fmtPct(data.returnPct, 0)}
            </span>
            <span class="text-sm font-bold text-white/50">of rake</span>
          </div>

          <div
            class="grid grid-cols-2 gap-3 pt-3"
            style="border-top: 1px solid rgba(255,255,255,0.1);"
          >
            <div>
              <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Rake Collected</p>
              <p class="text-base font-extrabold text-white tabular-nums leading-none">
                ${fmt(data.rakeCollected)}
              </p>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 12px;">
              <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Rewards Paid</p>
              <p class="text-base font-extrabold text-emerald-400 tabular-nums leading-none">
                ${fmt(data.rewardsPaid)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="px-4 mb-3">
      <div class="grid grid-cols-2 gap-2">
        <div
          class="rounded-2xl p-3.5"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(16,185,129,0.25);"
        >
          <div class="flex items-center gap-1.5 mb-2">
            <Icon name="arrow-right" size={11} color="#6ee7b7" />
            <p class="text-[9px] text-white/45 uppercase font-bold">Deposits</p>
          </div>
          <p class="text-lg font-extrabold text-emerald-400 tabular-nums leading-none">
            ${fmt(data.deposits, 0)}
          </p>
        </div>
        <div
          class="rounded-2xl p-3.5"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(244,201,93,0.25);"
        >
          <div class="flex items-center gap-1.5 mb-2">
            <Icon name="arrow-left" size={11} color="#f4c95d" />
            <p class="text-[9px] text-white/45 uppercase font-bold">Withdrawals</p>
          </div>
          <p class="text-lg font-extrabold text-gold tabular-nums leading-none">
            ${fmt(data.withdrawals, 0)}
          </p>
        </div>
        <div
          class="rounded-2xl p-3.5"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(96,165,250,0.25);"
        >
          <div class="flex items-center gap-1.5 mb-2">
            <Icon name="users" size={11} color="#60a5fa" />
            <p class="text-[9px] text-white/45 uppercase font-bold">Player Balances</p>
          </div>
          <p class="text-lg font-extrabold text-blue-300 tabular-nums leading-none">
            ${fmt(data.playerBalances, 0)}
          </p>
        </div>
        <div
          class="rounded-2xl p-3.5"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(139,92,246,0.25);"
        >
          <div class="flex items-center gap-1.5 mb-2">
            <Icon name="shield" size={11} color="#a78bfa" />
            <p class="text-[9px] text-white/45 uppercase font-bold">House Net</p>
          </div>
          <p class="text-lg font-extrabold text-violet-300 tabular-nums leading-none">
            ${fmt(data.houseNet, 0)}
          </p>
          <p class="text-[9px] text-white/40 mt-1">{fmtPct(data.houseNetPct, 1)} of rake</p>
        </div>
      </div>
    </div>

    <!-- Top reward recipients -->
    {#if data.topRewardRecipients.length > 0}
      <div class="px-4 mb-3">
        <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 mb-2 px-1">
          Top Earners ({period})
        </p>
        <div
          class="rounded-2xl overflow-hidden"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
        >
          {#each data.topRewardRecipients as r, i}
            <div
              class="flex items-center gap-3 px-4 py-2.5"
              style="border-bottom: {i < data.topRewardRecipients.length - 1
                ? '1px solid rgba(212,175,55,0.08)'
                : 'none'};"
            >
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0"
                style="background: rgba(0,0,0,0.4); color: {i === 0
                  ? '#f4c95d'
                  : 'rgba(255,255,255,0.6)'};"
              >
                #{i + 1}
              </div>
              <p class="flex-1 text-[12px] font-extrabold text-white truncate">{r.displayName}</p>
              <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums">
                +${fmt(r.earned)}
              </p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Note -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.25);"
      >
        <p class="text-[10px] text-blue-200 leading-relaxed">
          <b class="text-blue-100">How to read this:</b> Rake collected is the total fee taken from pots.
          Rewards paid is what we returned to players via rakeback, referrals, bonuses, and cashouts.
          House net is what we kept to run the platform. All numbers update live.
        </p>
      </div>
    </div>

    <!-- Generated timestamp -->
    <div class="px-4 mb-3 text-center">
      <p class="text-[9px] text-white/30 font-mono">
        Updated {fmtGeneratedAt(data.generatedAt)} · refreshes every 60s
      </p>
    </div>
  {/if}
</div>
