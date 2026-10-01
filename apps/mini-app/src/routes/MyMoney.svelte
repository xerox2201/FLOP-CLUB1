<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onNavigate: (page: any) => void = () => {};
  export let onBack: () => void = () => {};

  let period: '30d' | '90d' | 'lifetime' = '30d';
  let loading = true;
  let error = '';
  let data: any = null;

  const PERIODS: { key: '30d' | '90d' | 'lifetime'; label: string }[] = [
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: 'lifetime', label: 'Lifetime' },
  ];

  function fmt(n: any, digits = 2): string {
    return Number(Number(n || 0).toFixed(digits)).toFixed(digits);
  }
  function pct(x: any, digits = 1): string {
    return `${(Number(x || 0) * 100).toFixed(digits)}%`;
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<any>(`/api/my/money?period=${period}`);
      if (res.ok && res.data) data = res.data;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function setPeriod(p: '30d' | '90d' | 'lifetime') {
    period = p;
    load();
  }

  onMount(load);
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
      <Icon name="dollar" size={22} color="#6ee7b7" />
      <span>My Money</span>
    </h1>
  </div>

  <!-- Period switcher -->
  <div class="flex gap-1.5 mb-4 px-4">
    {#each PERIODS as p}
      <button
        on:click={() => setPeriod(p.key)}
        class="flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all active:scale-95 uppercase tracking-wider"
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

  {#if loading}
    <div class="px-4 space-y-3">
      {#each Array(3) as _}
        <div class="rounded-2xl h-[120px]" style="background: rgba(15,31,58,0.6);"></div>
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
    <!-- Rake vs Return hero -->
    <div class="px-4 mb-3">
      <div
        class="rounded-3xl p-5 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.22) 0%, transparent 60%),
            radial-gradient(ellipse at 0% 100%, rgba(244,201,93,0.15) 0%, transparent 60%),
            linear-gradient(135deg, #142d52 0%, #0a1a33 60%, #05080f 100%);
          border: 1.5px solid rgba(16,185,129,0.45);
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(16,185,129,0.15);
        "
      >
        <div class="relative">
          <p class="text-[10px] uppercase tracking-widest text-emerald-300/80 font-bold mb-1">
            Total Returned
          </p>
          <div class="flex items-baseline gap-2 mb-3">
            <span class="text-5xl font-extrabold tabular-nums leading-none text-emerald-400">
              ${fmt(data.totalReturned)}
            </span>
            {#if data.rakePaid > 0}
              <span class="text-sm font-bold text-white/50">
                / {pct(data.returnPct, 0)} of rake
              </span>
            {/if}
          </div>

          <div
            class="grid grid-cols-2 gap-3 pt-3"
            style="border-top: 1px solid rgba(255,255,255,0.08);"
          >
            <div>
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Rake Paid</p>
              <p class="text-base font-extrabold text-white tabular-nums leading-none">
                ${fmt(data.rakePaid)}
              </p>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 8px;">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Platform Kept</p>
              <p class="text-base font-extrabold text-white/70 tabular-nums leading-none">
                ${fmt(data.platformKept)}
              </p>
            </div>
          </div>

          <div class="mt-3 pt-3" style="border-top: 1px solid rgba(255,255,255,0.08);">
            <p class="text-[10px] text-white/60 leading-relaxed">
              {data.note}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Breakdown -->
    <div class="px-4 mb-3">
      <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 mb-2 px-1">
        Where Your Money Goes
      </p>
      <div
        class="rounded-2xl overflow-hidden"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
      >
        {#each data.breakdown as b, i}
          <div
            class="flex items-center gap-3 px-4 py-3"
            style="border-bottom: {i < data.breakdown.length - 1
              ? '1px solid rgba(212,175,55,0.08)'
              : 'none'};"
          >
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-bold text-white/85">{b.label}</p>
            </div>
            <p
              class="text-[13px] font-extrabold tabular-nums"
              style="color: {b.amount > 0 ? '#6ee7b7' : 'rgba(255,255,255,0.35)'};"
            >
              +${fmt(b.amount)}
            </p>
          </div>
        {/each}

        <div
          class="flex items-center gap-3 px-4 py-3"
          style="background: rgba(16,185,129,0.08); border-top: 1px solid rgba(16,185,129,0.25);"
        >
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-extrabold text-emerald-300">Total Returned</p>
          </div>
          <p class="text-[14px] font-extrabold text-emerald-400 tabular-nums">
            ${fmt(data.totalReturned)}
          </p>
        </div>
      </div>
    </div>

    <!-- Table performance -->
    <div class="px-4 mb-3">
      <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 mb-2 px-1">
        Table Performance
      </p>
      <div
        class="rounded-2xl p-3.5"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(212,175,55,0.25);"
      >
        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Cash Table Winnings</p>
            <p class="text-lg font-extrabold text-white tabular-nums leading-none">
              ${fmt(data.tableWon)}
            </p>
          </div>
          <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 8px;">
            <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Tournament Prizes</p>
            <p class="text-lg font-extrabold text-gold tabular-nums leading-none">
              ${fmt(data.tournamentPrizes)}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Books CTA -->
    <div class="px-4 mb-3">
      <button
        on:click={() => onNavigate('books')}
        class="w-full rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.98] transition-all"
        style="
          background: radial-gradient(ellipse at 100% 0%, rgba(96,165,250,0.15) 0%, transparent 60%),
                      linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1px solid rgba(96,165,250,0.3);
        "
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(96,165,250,0.2); border: 1px solid rgba(96,165,250,0.4);"
        >
          <Icon name="chart" size={18} color="#60a5fa" />
        </div>
        <div class="flex-1 min-w-0 text-left">
          <p class="text-[12px] font-extrabold text-white">Live Books</p>
          <p class="text-[10px] text-white/50 mt-0.5">See every dollar in and out — publicly</p>
        </div>
        <Icon name="arrow-right" size={14} color="#60a5fa" />
      </button>
    </div>
  {/if}
</div>
