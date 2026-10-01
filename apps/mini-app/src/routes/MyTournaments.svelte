<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { api } from '../lib/api';
  import Icon from '../components/Icon.svelte';

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
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  function statusColor(t: any): string {
    if (t.isWinner) return '#f4c95d';
    if (t.payout > 0) return '#10b981';
    if (t.entryStatus === 'qualified') return '#a78bfa';
    return '#6b7280';
  }

  function statusLabel(t: any): string {
    if (t.isWinner) return 'WON';
    if (t.entryStatus === 'qualified') return 'QUALIFIED';
    if (t.payout > 0) return 'ITM';
    if (t.entryStatus === 'eliminated') return 'OUT';
    if (t.entryStatus === 'refunded') return 'REFUNDED';
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

  const FILTERS: { key: Filter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '#d4af37' },
    { key: 'won', label: 'Wins', color: '#f4c95d' },
    { key: 'itm', label: 'ITM', color: '#10b981' },
    { key: 'eliminated', label: 'Out', color: '#6b7280' },
  ];
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="flex items-center gap-3 mt-2 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition shrink-0"
      style="
        background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.22), rgba(168,121,34,0.06));
        border: 1.5px solid rgba(244,201,93,0.45);
        box-shadow: 0 4px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1);
      "
    >
      <Icon name="arrow-left" size={18} color="#f4c95d" />
    </button>

    <div class="flex-1 min-w-0">
      <h1
        class="text-[24px] font-extrabold leading-none tracking-tight"
        style="
          background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px rgba(244,201,93,0.35));
        "
      >
        My Tournaments
      </h1>
      <p class="text-[10px] text-white/45 mt-1 font-bold">Your results, payouts and points</p>
    </div>

    <div
      class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
      style="
        background: radial-gradient(circle at 30% 30%, rgba(167,139,250,0.35), rgba(109,40,217,0.1));
        border: 1.5px solid rgba(139,92,246,0.5);
        box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 18px rgba(139,92,246,0.2);
      "
    >
      <Icon name="ticket" size={20} color="#c4b5fd" />
    </div>
  </div>

  <!-- ============ SUMMARY GRID ============ -->
  {#if stats}
    <div class="grid grid-cols-3 gap-2 mb-3">
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(96,165,250,0.14) 0%, transparent 62%),
            linear-gradient(180deg, rgba(15,31,58,0.88), rgba(7,14,27,0.95));
          border: 1px solid rgba(96,165,250,0.28);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(96,165,250,0.2); border: 1px solid rgba(96,165,250,0.4);"
          >
            <Icon name="tables" size={11} color="#60a5fa" />
          </div>
          <span class="text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">
            Played
          </span>
        </div>
        <p class="text-[18px] font-extrabold text-white tabular-nums leading-none">
          {stats.total}
        </p>
        <p class="text-[8px] text-white/40 font-bold mt-1 uppercase tracking-wider">entries</p>
      </div>

      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.16) 0%, transparent 62%),
            linear-gradient(180deg, rgba(15,31,58,0.88), rgba(7,14,27,0.95));
          border: 1px solid rgba(244,201,93,0.3);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(244,201,93,0.2); border: 1px solid rgba(244,201,93,0.45);"
          >
            <Icon name="trophy" size={11} color="#f4c95d" />
          </div>
          <span class="text-[9px] font-extrabold text-gold uppercase tracking-wider"> Wins </span>
        </div>
        <p class="text-[18px] font-extrabold text-gold tabular-nums leading-none">
          {stats.wins}
        </p>
        <p class="text-[8px] text-white/40 font-bold mt-1 uppercase tracking-wider">1st place</p>
      </div>

      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(139,92,246,0.16) 0%, transparent 62%),
            linear-gradient(180deg, rgba(15,31,58,0.88), rgba(7,14,27,0.95));
          border: 1px solid rgba(139,92,246,0.3);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.45);"
          >
            <Icon name="star" size={11} color="#a78bfa" />
          </div>
          <span class="text-[9px] font-extrabold text-violet-300 uppercase tracking-wider">
            Points
          </span>
        </div>
        <p class="text-[18px] font-extrabold tabular-nums leading-none" style="color: #a78bfa;">
          {stats.totalPoints}
        </p>
        <p class="text-[8px] text-white/40 font-bold mt-1 uppercase tracking-wider">earned</p>
      </div>
    </div>

    <!-- ============ NET PROFIT ============ -->
    <div
      class="rounded-2xl p-4 mb-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.18) 0%, transparent 62%),
          linear-gradient(180deg, rgba(15,31,58,0.88), rgba(7,14,27,0.95));
        border: 1px solid rgba(16,185,129,0.32);
        box-shadow: 0 8px 26px rgba(0,0,0,0.5), 0 0 22px rgba(16,185,129,0.1);
      "
    >
      <div
        class="absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-20 pointer-events-none"
        style="background: radial-gradient(circle, #10b981, transparent 70%);"
      ></div>

      <div class="flex items-center gap-2 mb-2 relative">
        <Icon name="trending-up" size={14} color="#6ee7b7" />
        <p class="text-[10px] uppercase tracking-widest text-emerald-300/80 font-extrabold flex-1">
          Net Profit
        </p>
        <span
          class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full tabular-nums"
          style="background: rgba(0,0,0,0.35); color: {roiColor};"
        >
          ROI {stats.roi >= 0 ? '+' : ''}{stats.roi}%
        </span>
      </div>

      <p
        class="text-[32px] font-extrabold tabular-nums leading-none relative"
        style="
          color: {stats.netProfit >= 0 ? '#6ee7b7' : '#fca5a5'};
          letter-spacing: -0.02em;
          filter: drop-shadow(0 0 16px rgba(16,185,129,0.25));
        "
      >
        {stats.netProfit >= 0 ? '+' : ''}${fmt(stats.netProfit)}
      </p>

      <div
        class="grid grid-cols-3 gap-2 mt-3 pt-3 relative"
        style="border-top: 1px solid rgba(16,185,129,0.2);"
      >
        <div>
          <p class="text-[9px] text-white/40 uppercase font-bold tracking-wider">Won</p>
          <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums mt-0.5">
            ${fmt(stats.totalWon)}
          </p>
        </div>
        <div>
          <p class="text-[9px] text-white/40 uppercase font-bold tracking-wider">Invested</p>
          <p class="text-[12px] font-extrabold text-white/70 tabular-nums mt-0.5">
            ${fmt(stats.totalInvested)}
          </p>
        </div>
        <div>
          <p class="text-[9px] text-white/40 uppercase font-bold tracking-wider">ITM</p>
          <p class="text-[12px] font-extrabold text-cyan tabular-nums mt-0.5">
            {stats.itm} ({stats.itmPct}%)
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- ============ FILTERS ============ -->
  <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
    {#each FILTERS as f}
      <button
        on:click={() => setFilter(f.key)}
        class="px-3.5 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap active:scale-95 transition-all uppercase tracking-wider"
        style="background: {filter === f.key
          ? `linear-gradient(180deg, ${f.color}, ${f.color}bb)`
          : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'}; color: {filter ===
        f.key
          ? '#ffffff'
          : 'rgba(255,255,255,0.65)'}; border: 1px solid {filter === f.key
          ? `${f.color}dd`
          : 'rgba(212,175,55,0.15)'};"
      >
        {f.label}
      </button>
    {/each}
  </div>

  <!-- ============ LIST ============ -->
  {#if loading}
    <div class="space-y-2">
      {#each Array(4) as _}
        <div
          class="rounded-2xl p-3"
          style="
            background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
            border: 1px solid rgba(212,175,55,0.1);
          "
        >
          <div class="flex items-center gap-2 mb-3">
            <div class="w-14 h-4 rounded-full" style="background: rgba(255,255,255,0.07);"></div>
            <div class="w-10 h-3 rounded-full" style="background: rgba(255,255,255,0.05);"></div>
          </div>
          <div class="h-3 rounded-full mb-2" style="background: rgba(255,255,255,0.08);"></div>
          <div class="h-2.5 w-2/3 rounded-full" style="background: rgba(255,255,255,0.05);"></div>
          <div
            class="mt-3 pt-2 flex justify-between"
            style="border-top: 1px solid rgba(255,255,255,0.05);"
          >
            <div class="h-2.5 w-16 rounded-full" style="background: rgba(255,255,255,0.05);"></div>
            <div class="h-2.5 w-20 rounded-full" style="background: rgba(255,255,255,0.05);"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if tournaments.length === 0}
    <div
      class="rounded-2xl p-8 text-center relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 62%),
          linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
        border: 1px dashed rgba(212,175,55,0.3);
      "
    >
      <div
        class="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style="
          background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.3), rgba(168,122,21,0.08));
          border: 1px solid rgba(244,201,93,0.4);
          box-shadow: 0 6px 20px rgba(0,0,0,0.45), 0 0 20px rgba(244,201,93,0.15);
        "
      >
        <Icon name="ticket" size={28} color="#f4c95d" />
      </div>
      <p class="text-sm font-extrabold text-white">No tournaments yet</p>
      <p class="text-[11px] text-white/55 mt-1 font-bold">Play a tournament to see it here</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each tournaments as t}
        {@const sc = statusColor(t)}
        <div
          class="rounded-2xl p-3 relative overflow-hidden"
          style="
            background:
              radial-gradient(ellipse at 100% 0%, {sc}14 0%, transparent 60%),
              linear-gradient(135deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
            border: 1px solid {sc}40;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          "
        >
          <div
            class="absolute left-0 top-0 bottom-0 w-1"
            style="background: linear-gradient(180deg, {sc}, {sc}66);"
          ></div>

          <div class="flex items-start justify-between gap-2 mb-2 pl-1.5">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                <span
                  class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style="background: {sc}25; color: {sc}; border: 1px solid {sc}60;"
                >
                  {statusLabel(t)}
                </span>
                {#if t.finalPosition}
                  <span class="text-[9px] text-white/60 font-mono"
                    >#{t.finalPosition}/{t.totalPlayers}</span
                  >
                {/if}
              </div>
              <p class="text-[13px] font-extrabold text-white truncate">{t.name}</p>
              <p class="text-[10px] text-white/40 mt-0.5">
                {t.variant.toUpperCase()} · {t.format.toUpperCase()} · {t.buyIn > 0
                  ? `$${fmt(t.buyIn)}`
                  : 'FREE'}
                {#if t.reEntries > 0}
                  · {t.reEntries} re-entry{/if}
              </p>
            </div>
            <div class="text-right shrink-0">
              {#if t.payout > 0}
                <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums">
                  +${fmt(t.payout)}
                </p>
              {/if}
              {#if t.points > 0}
                <div class="flex items-center gap-1 justify-end mt-0.5">
                  <Icon name="star" size={9} color="#d4af37" />
                  <p class="text-[10px] font-bold text-gold tabular-nums">+{t.points} pts</p>
                </div>
              {/if}
            </div>
          </div>

          <div
            class="pl-1.5 flex items-center justify-between text-[9px] text-white/40 font-mono pt-2"
            style="border-top: 1px solid rgba(255,255,255,0.06);"
          >
            <span class="flex items-center gap-1">
              <Icon name="clock" size={10} color="rgba(255,255,255,0.35)" />
              <span>{fmtDate(t.finishedAt)}</span>
            </span>
            <span>Prize pool ${fmt(t.prizePool)}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
