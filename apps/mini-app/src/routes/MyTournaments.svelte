<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { api } from '../lib/api';

  export let onBack: () => void = () => {};

  type Filter = 'all' | 'won' | 'itm' | 'eliminated';

  let filter: Filter = 'all';
  let loading = true;
  let tournaments: any[] = [];
  let stats: any = null;

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return '—'; }
  }

  function statusColor(t: any): string {
    if (t.isWinner) return '#f4c95d';
    if (t.payout > 0) return '#10b981';
    if (t.entryStatus === 'qualified') return '#a78bfa';
    return '#6b7280';
  }

  function statusLabel(t: any): string {
    if (t.isWinner) return '🏆 WON';
    if (t.entryStatus === 'qualified') return '🎟️ QUALIFIED';
    if (t.payout > 0) return '💰 ITM';
    if (t.entryStatus === 'eliminated') return '💀 OUT';
    if (t.entryStatus === 'refunded') return '↩️ REFUNDED';
    return t.entryStatus?.toUpperCase() || '—';
  }

  async function load() {
    loading = true;
    try {
      const res = await api.getMyTournaments(filter, 100);
      if (res.ok && res.data) {
        tournaments = res.data.tournaments || [];
        stats = res.data.stats;
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  function setFilter(f: Filter) {
    filter = f;
    load();
  }

  onMount(load);

  $: roiColor = stats ? (stats.roi >= 0 ? '#6ee7b7' : '#fca5a5') : '#fff';
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <TopBar />

  <div class="flex items-center gap-3 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1">My Tournaments</h1>
  </div>

  {#if stats}
    <!-- Summary stats -->
    <div class="grid grid-cols-3 gap-2 mb-3">
      <div class="rounded-2xl p-3 text-center" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(96,165,250,0.2);">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Played</p>
        <p class="text-lg font-extrabold text-white tabular-nums leading-none">{stats.total}</p>
      </div>
      <div class="rounded-2xl p-3 text-center" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.2);">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Wins</p>
        <p class="text-lg font-extrabold text-gold tabular-nums leading-none">{stats.wins}</p>
      </div>
      <div class="rounded-2xl p-3 text-center" style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(139,92,246,0.2);">
        <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">Points</p>
        <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #a78bfa;">{stats.totalPoints}</p>
      </div>
    </div>

    <div
      class="rounded-2xl p-4 mb-4 relative overflow-hidden"
      style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.05)); border: 1px solid rgba(16,185,129,0.3);"
    >
      <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20" style="background: radial-gradient(circle, #10b981, transparent 70%);"></div>

      <div class="flex items-center justify-between mb-2 relative">
        <p class="text-[10px] uppercase tracking-widest text-emerald-300/80 font-bold">Net Profit</p>
        <p class="text-[10px] font-bold" style="color: {roiColor};">
          ROI {stats.roi >= 0 ? '+' : ''}{stats.roi}%
        </p>
      </div>
      <p class="text-3xl font-extrabold tabular-nums leading-tight relative" style="color: {stats.netProfit >= 0 ? '#6ee7b7' : '#fca5a5'};">
        {stats.netProfit >= 0 ? '+' : ''}${fmt(stats.netProfit)}
      </p>
      <div class="grid grid-cols-3 gap-2 mt-3 pt-3 relative" style="border-top: 1px solid rgba(16,185,129,0.2);">
        <div>
          <p class="text-[9px] text-white/40 uppercase font-bold">Won</p>
          <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums">${fmt(stats.totalWon)}</p>
        </div>
        <div>
          <p class="text-[9px] text-white/40 uppercase font-bold">Invested</p>
          <p class="text-[12px] font-extrabold text-white/70 tabular-nums">${fmt(stats.totalInvested)}</p>
        </div>
        <div>
          <p class="text-[9px] text-white/40 uppercase font-bold">ITM</p>
          <p class="text-[12px] font-extrabold text-cyan tabular-nums">{stats.itm} ({stats.itmPct}%)</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
    {#each [
      { key: 'all' as Filter, label: 'All', color: '#d4af37' },
      { key: 'won' as Filter, label: '🏆 Wins', color: '#f4c95d' },
      { key: 'itm' as Filter, label: '💰 ITM', color: '#10b981' },
      { key: 'eliminated' as Filter, label: '💀 Out', color: '#6b7280' },
    ] as f}
      <button
        on:click={() => setFilter(f.key)}
        class="px-3.5 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap active:scale-95 transition-all uppercase tracking-wider"
        style="background: {filter === f.key ? `linear-gradient(180deg, ${f.color}, ${f.color}bb)` : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'}; color: {filter === f.key ? '#ffffff' : 'rgba(255,255,255,0.65)'}; border: 1px solid {filter === f.key ? `${f.color}dd` : 'rgba(212,175,55,0.15)'};"
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="text-center py-12 text-white/40 text-sm">Loading…</div>
  {:else if tournaments.length === 0}
    <div class="rounded-3xl p-8 text-center" style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px solid rgba(212,175,55,0.15);">
      <div class="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl" style="background: linear-gradient(180deg, rgba(212,175,55,0.15), rgba(168,122,21,0.08)); border: 1px solid rgba(212,175,55,0.3);">
        🎫
      </div>
      <p class="text-white/60 text-sm font-bold">No tournaments yet</p>
      <p class="text-white/40 text-[11px] mt-1">Play a tournament to see it here</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each tournaments as t}
        {@const sc = statusColor(t)}
        <div
          class="rounded-2xl p-3 relative overflow-hidden"
          style="background: linear-gradient(135deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1.5px solid {sc}40;"
        >
          <div class="absolute left-0 top-0 bottom-0 w-1" style="background: linear-gradient(180deg, {sc}, {sc}66);"></div>

          <div class="flex items-start justify-between gap-2 mb-2 pl-1">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                <span
                  class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style="background: {sc}25; color: {sc}; border: 1px solid {sc}60;"
                >
                  {statusLabel(t)}
                </span>
                {#if t.finalPosition}
                  <span class="text-[9px] text-white/60 font-mono">#{t.finalPosition}/{t.totalPlayers}</span>
                {/if}
              </div>
              <p class="text-[13px] font-extrabold text-white truncate">{t.name}</p>
              <p class="text-[10px] text-white/40 mt-0.5">
                {t.variant.toUpperCase()} · {t.format.toUpperCase()} · {t.buyIn > 0 ? `$${fmt(t.buyIn)}` : 'FREE'}
                {#if t.reEntries > 0} · {t.reEntries} re-entry{/if}
              </p>
            </div>
            <div class="text-right shrink-0">
              {#if t.payout > 0}
                <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums">
                  +${fmt(t.payout)}
                </p>
              {/if}
              {#if t.points > 0}
                <p class="text-[10px] font-bold text-gold tabular-nums mt-0.5">
                  +{t.points} pts
                </p>
              {/if}
            </div>
          </div>

          <div class="pl-1 flex items-center justify-between text-[9px] text-white/40 font-mono pt-2" style="border-top: 1px solid rgba(255,255,255,0.06);">
            <span>{fmtDate(t.finishedAt)}</span>
            <span>Prize pool ${fmt(t.prizePool)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>