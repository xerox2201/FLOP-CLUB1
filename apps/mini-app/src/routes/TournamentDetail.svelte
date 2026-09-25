<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import { getRealtime, realtimeConnected, TOURNAMENT_EVENT_RE } from '../lib/realtime';
  import { pushNotif } from '../lib/notifications';
  import Avatar from '../components/Avatar.svelte';

  export let tournamentId: number;
  export let onBack: () => void = () => {};
  export let onOpenTable: (tid: number, virtualTableId: number) => void = () => {};

  let t: any = null;
  let loading = true;
  let error = '';
  let acting = false;
  let toast = '';
  let expandBlinds = false;

  let nowTick = Date.now();
  let fetchedAt = 0;
  let pollTimer: any = null;
  let tickTimer: any = null;

  $: myUserId = $auth.user?.id;
  $: isLive = t?.status === 'running' || t?.status === 'final_table';
  $: isPaused = t?.status === 'paused';
  $: isFinished = t?.status === 'finished' || t?.status === 'cancelled';
  $: canRegisterNow = t && (t.status === 'registering' || t.status === 'scheduled');

  // Timer
  $: elapsedSinceFetch = fetchedAt > 0 ? Math.max(0, (nowTick - fetchedAt) / 1000) : 0;
  $: remainingSec = t && !isPaused
    ? Math.max(0, Math.round((t.nextLevelIn ?? 0) - elapsedSinceFetch))
    : 0;
  $: totalSec = t?.currentLevelData?.durationSec ?? 0;
  $: elapsedSec = Math.max(0, totalSec - remainingSec);
  $: progressPct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;

  // Blinds
  $: allBlinds = t?.blindStructure ?? [];
  $: currentLevel = t?.currentLevel ?? 0;
  $: visibleBlinds = (() => {
    if (expandBlinds) return allBlinds;
    if (allBlinds.length === 0) return [];
    const start = Math.max(1, currentLevel - 2);
    const end = currentLevel + 2;
    return allBlinds.filter((b: any) => b.level >= start && b.level <= end);
  })();

  // Players
  $: allPlayers = t?.players ?? [];
  $: top30 = allPlayers.slice(0, 30);
  $: selfPlayer = myUserId
    ? allPlayers.find((p: any) => Number(p.userId) === Number(myUserId))
    : null;
  $: showSelfPinned =
    !!selfPlayer && !top30.some((p: any) => p.userId === selfPlayer.userId);
  $: activePlayers = allPlayers.filter((p: any) => p.status === 'active');
  $: avgStack =
    activePlayers.length > 0
      ? activePlayers.reduce((s: number, p: any) => s + Number(p.stack || 0), 0) /
        activePlayers.length
      : 0;
  $: displayPlayerCount = isLive || isFinished
    ? (t?.totalPlayers ?? 0)
    : (t?.registeredCount ?? 0);

  function fmt(n: any, d = 2): string {
    return Number(Number(n || 0).toFixed(d)).toFixed(d);
  }
  function fmtInt(n: any): string {
    return Math.round(Number(n || 0)).toLocaleString();
  }
  function fmtTime(sec: number): string {
    if (sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return '—'; }
  }
  function statusColor(s: string): string {
    if (s === 'running') return '#10b981';
    if (s === 'final_table') return '#d4af37';
    if (s === 'registering') return '#22d3ee';
    if (s === 'scheduled') return '#8b5cf6';
    if (s === 'finished') return '#6b7280';
    if (s === 'paused') return '#f59e0b';
    if (s === 'cancelled') return '#ef4444';
    return '#6b7280';
  }
  function statusLabel(s: string): string {
    return String(s).replace('_', ' ').toUpperCase();
  }
  function rankIcon(idx: number): string {
    if (idx === 0) return '🥇';
    if (idx === 1) return '🥈';
    if (idx === 2) return '🥉';
    return '';
  }
  function flash(msg: string) {
    toast = msg;
    setTimeout(() => (toast = ''), 2500);
  }
  function copyId() {
    try {
      navigator.clipboard.writeText(String(tournamentId));
      flash('📋 ID copied');
    } catch {}
  }

  async function load() {
    error = '';
    try {
      const res = await api.getTournament(tournamentId);
      if (res.ok && res.data) {
        t = res.data;
        fetchedAt = Date.now();
      } else if (!t) {
        error = res.error || 'not_found';
      }
    } catch (e: any) {
      if (!t) error = e.message;
    } finally {
      loading = false;
    }
  }

  async function doRegister() {
    if (acting) return;
    acting = true;
    try {
      const res = await api.registerTournament(tournamentId);
      if (res.ok) { flash('✅ Registered!'); await load(); }
      else flash('❌ ' + (res.error || 'failed'));
    } catch (e: any) { flash('❌ ' + e.message); }
    finally { acting = false; }
  }

  async function doUnregister() {
    if (acting) return;
    acting = true;
    try {
      const res = await api.unregisterTournament(tournamentId);
      if (res.ok) { flash('↩️ Unregistered'); await load(); }
      else flash('❌ ' + (res.error || 'failed'));
    } catch (e: any) { flash('❌ ' + e.message); }
    finally { acting = false; }
  }

  function onAnyEvent(event: string, ...args: any[]): void {
    const m = event.match(TOURNAMENT_EVENT_RE);
    if (!m) return;
    const tid = Number(m[1]);
    if (tid !== tournamentId) return;
    const type = m[2];
    const data = args[0] ?? {};

    if (type === 'level') {
      pushNotif({
        icon: '⏫',
        title: `Level ${data.level ?? '?'} — blinds up`,
        message: `${data.sb ?? '?'}/${data.bb ?? '?'}${data.ante ? ` · ante ${data.ante}` : ''}`,
        color: '#f4c95d',
      });
    } else if (type === 'elimination') {
      pushNotif({
        icon: '💀',
        title: `${data.displayName ?? 'Player'} eliminated`,
        message: `Position #${data.finalPosition ?? '?'}`,
        color: '#ef4444',
      });
    } else if (type === 'final_table') {
      pushNotif({ icon: '🏆', title: 'FINAL TABLE', color: '#f4c95d' });
    } else if (type === 'finished') {
      pushNotif({ icon: '🏁', title: 'Tournament finished', color: '#10b981' });
    }
    load();
  }

  onMount(() => {
    load();
    pollTimer = setInterval(load, 3000);
    tickTimer = setInterval(() => { nowTick = Date.now(); }, 1000);
    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (tickTimer) clearInterval(tickTimer);
    };
  });

  $: if ($realtimeConnected) {
    const s = getRealtime();
    if (s) { s.offAny(onAnyEvent); s.onAny(onAnyEvent); }
  }

  onDestroy(() => {
    const s = getRealtime();
    if (s) s.offAny(onAnyEvent);
    if (pollTimer) clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
  });
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <!-- HEADER -->
  <div class="flex items-center gap-2 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 shrink-0"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6" /></svg>
    </button>

    <div class="flex-1 min-w-0">
      <h1 class="text-base font-extrabold text-white truncate leading-tight">
        {t?.name || 'Tournament'}
      </h1>
      {#if t}
        <div class="flex items-center gap-1.5 mt-0.5">
          <span
            class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full tracking-widest uppercase"
            style="background: {statusColor(t.status)}25; color: {statusColor(t.status)}; border: 1px solid {statusColor(t.status)}60;"
          >
            {statusLabel(t.status)}
          </span>
          <button
            on:click={copyId}
            class="text-[9px] text-white/40 font-mono active:text-white/80"
          >
            #{t.id} 📋
          </button>
        </div>
      {/if}
    </div>

    {#if isLive}
      <div class="flex items-center gap-1 px-2 py-1 rounded-full shrink-0"
           style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4);">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider">Live</span>
      </div>
    {/if}
  </div>

  {#if loading && !t}
    <div class="text-center py-12 text-white/40 text-sm">Loading…</div>
  {:else if error && !t}
    <div class="rounded-2xl p-4 text-center"
         style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);">
      <p class="text-red-300 text-sm font-bold">{error}</p>
    </div>
  {:else if t}
    <!-- PRIZE POOL -->
    <div
      class="rounded-3xl p-5 mb-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.22) 0%, transparent 60%),
          linear-gradient(135deg, #142d52 0%, #0a1a33 60%, #05080f 100%);
        border: 1.5px solid rgba(244,201,93,0.42);
        box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 32px rgba(244,201,93,0.18);
      "
    >
      <div class="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-20 pointer-events-none"
           style="background: radial-gradient(circle, #f4c95d, transparent 70%);"></div>

      <p class="text-[10px] uppercase tracking-widest text-gold/80 font-bold mb-1 relative">
        Prize Pool
      </p>
      <div class="flex items-baseline gap-2 mb-2 relative">
        <span
          class="text-4xl font-extrabold tabular-nums leading-none"
          style="
            background: linear-gradient(180deg, #f4e5a8, #d4af37 50%, #a87a15);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.03em;
          "
        >
          ${fmt(t.totalPrizePool)}
        </span>
      </div>

      {#if t.guaranteed > 0}
        <div class="flex items-center gap-2 text-[10px] mb-3 relative">
          <span class="text-white/60">
            Guaranteed <span class="text-white font-bold">${fmt(t.guaranteed)}</span>
          </span>
          {#if t.overlay > 0}
            <span class="text-white/30">·</span>
            <span class="text-orange-300 font-bold">Overlay ${fmt(t.overlay)}</span>
          {:else}
            <span class="text-white/30">·</span>
            <span class="text-emerald-300 font-bold">No overlay</span>
          {/if}
        </div>
      {/if}

      <div class="grid grid-cols-3 gap-2 pt-3 relative" style="border-top: 1px solid rgba(244,201,93,0.2);">
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Players</p>
          <p class="text-base font-extrabold text-white tabular-nums leading-none">
            {displayPlayerCount}<span class="text-white/40 text-xs">/{t.maxPlayers}</span>
          </p>
        </div>
        <div class="text-center" style="border-left: 1px solid rgba(255,255,255,0.06); border-right: 1px solid rgba(255,255,255,0.06);">
          <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Avg Stack</p>
          <p class="text-base font-extrabold text-white tabular-nums leading-none">
            {avgStack > 0 ? fmtInt(avgStack) : '—'}
          </p>
        </div>
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Blinds</p>
          <p class="text-base font-extrabold tabular-nums leading-none" style="color: #67e8f9;">
            {#if t.currentLevelData}
              {fmtInt(t.currentLevelData.sb)}/{fmtInt(t.currentLevelData.bb)}
            {:else}
              —
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- LEVEL TIMER -->
    {#if isLive || isPaused}
      <div
        class="rounded-3xl p-4 mb-3 relative overflow-hidden"
        style="
          background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
          border: 1.5px solid {isPaused ? 'rgba(245,158,11,0.5)' : 'rgba(251,146,60,0.4)'};
          {isPaused ? 'box-shadow: 0 0 24px rgba(245,158,11,0.2);' : ''}
        "
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-base">{isPaused ? '⏸️' : '⏱️'}</span>
            <p class="text-[10px] uppercase tracking-widest font-extrabold"
               style="color: {isPaused ? '#fbbf24' : '#fb923c'};">
              {isPaused ? 'Paused' : `Level ${currentLevel}`}
            </p>
          </div>
          {#if !isPaused}
            <p class="text-[9px] text-white/40 font-bold">Next in</p>
          {/if}
        </div>

        {#if !isPaused}
          <div class="flex items-baseline justify-center mb-3">
            <span
              class="text-4xl font-extrabold tabular-nums leading-none"
              style="
                color: {remainingSec <= 30 ? '#fca5a5' : '#fb923c'};
                text-shadow: 0 0 16px {remainingSec <= 30 ? 'rgba(239,68,68,0.6)' : 'rgba(251,146,60,0.5)'};
                font-variant-numeric: tabular-nums;
              "
            >
              {fmtTime(remainingSec)}
            </span>
          </div>

          <div class="w-full h-1.5 rounded-full overflow-hidden mb-3" style="background: rgba(0,0,0,0.5);">
            <div
              class="h-full rounded-full transition-all"
              style="
                width: {progressPct}%;
                background: linear-gradient(90deg, #fb923c, #f97316);
                box-shadow: 0 0 10px rgba(251,146,60,0.6);
              "
            ></div>
          </div>
        {:else}
          <p class="text-center text-[11px] text-amber-300 font-bold mb-3">
            Level will resume when tournament is resumed
          </p>
        {/if}

        {#if t.currentLevelData}
          <div class="grid grid-cols-3 gap-2 pt-3" style="border-top: 1px solid rgba(255,255,255,0.08);">
            <div class="text-center">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Small Blind</p>
              <p class="text-sm font-extrabold text-white tabular-nums">
                {fmtInt(t.currentLevelData.sb)}
              </p>
            </div>
            <div class="text-center" style="border-left: 1px solid rgba(255,255,255,0.06); border-right: 1px solid rgba(255,255,255,0.06);">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Big Blind</p>
              <p class="text-sm font-extrabold text-white tabular-nums">
                {fmtInt(t.currentLevelData.bb)}
              </p>
            </div>
            <div class="text-center">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Ante</p>
              <p class="text-sm font-extrabold text-white tabular-nums">
                {t.currentLevelData.ante > 0 ? fmtInt(t.currentLevelData.ante) : '—'}
              </p>
            </div>
          </div>

          {#if t.nextLevelData}
            <div class="mt-3 pt-2 text-center" style="border-top: 1px solid rgba(255,255,255,0.06);">
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">
                Next · L{t.nextLevelData.level}
              </p>
              <p class="text-[11px] font-extrabold text-white/70 tabular-nums mt-0.5">
                {fmtInt(t.nextLevelData.sb)}/{fmtInt(t.nextLevelData.bb)}
                {#if t.nextLevelData.ante > 0}
                  <span class="text-white/50">+a{fmtInt(t.nextLevelData.ante)}</span>
                {/if}
              </p>
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- YOUR STATUS -->
    {#if t.yourEntry}
      {@const ye = t.yourEntry}
      <div
        class="rounded-3xl p-4 mb-3"
        style="
          background: linear-gradient(180deg,
            {ye.isRegistered ? 'rgba(16,185,129,0.1)' : 'rgba(15,31,58,0.7)'},
            rgba(7,14,27,0.95));
          border: 1.5px solid {ye.isRegistered ? 'rgba(16,185,129,0.42)' : 'rgba(212,175,55,0.22)'};
        "
      >
        <div class="flex items-center gap-2 mb-3">
          <span class="text-base">{ye.isRegistered ? '✅' : '🎯'}</span>
          <p class="text-[10px] uppercase tracking-widest font-extrabold flex-1"
             style="color: {ye.isRegistered ? '#6ee7b7' : '#a78bfa'};">
            Your Status
          </p>
          <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style="background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);">
            {ye.entryStatus}
          </span>
        </div>

        {#if ye.isRegistered}
          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="text-center">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Seat</p>
              <p class="text-base font-extrabold text-white tabular-nums">{ye.seat ?? '—'}</p>
            </div>
            <div class="text-center" style="border-left: 1px solid rgba(255,255,255,0.06); border-right: 1px solid rgba(255,255,255,0.06);">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Stack</p>
              <p class="text-base font-extrabold text-gold tabular-nums">
                {ye.stack != null ? `$${fmtInt(ye.stack)}` : '—'}
              </p>
            </div>
            <div class="text-center">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Table</p>
              <p class="text-base font-extrabold text-white tabular-nums">{ye.tableNumber ?? '—'}</p>
            </div>
          </div>

          <div class="flex gap-2">
            {#if ye.virtualTableId && isLive && ye.entryStatus === 'playing'}
              <button
                on:click={() => onOpenTable(tournamentId, ye.virtualTableId)}
                class="flex-1 rounded-xl py-3 text-[12px] font-extrabold active:scale-95"
                style="background: linear-gradient(180deg, #22c55e, #15803d); color: white; box-shadow: 0 3px 0 #14532d;"
              >
                🎰 Go to Table
              </button>
            {/if}
            {#if ye.entryStatus === 'registered' && !isLive}
              <button
                on:click={doUnregister}
                disabled={acting}
                class="flex-1 rounded-xl py-3 text-[12px] font-extrabold active:scale-95 disabled:opacity-40"
                style="background: rgba(220,38,38,0.15); color: #fca5a5; border: 1px solid rgba(220,38,38,0.35);"
              >
                Unregister
              </button>
            {/if}
          </div>
        {:else if ye.entryStatus === 'eliminated'}
          <div class="rounded-xl p-3 text-center mb-3"
               style="background: rgba(107,114,128,0.15); border: 1px solid rgba(107,114,128,0.3);">
            <p class="text-[11px] text-white/60 font-bold">
              Eliminated {ye.finalPosition ? `· #${ye.finalPosition}` : ''}
            </p>
            {#if ye.payoutAmount > 0}
              <p class="text-[11px] text-emerald-400 font-extrabold mt-1">
                Won ${fmt(ye.payoutAmount)}
              </p>
            {/if}
          </div>

          {#if ye.canReEnter}
            <button
              on:click={doRegister}
              disabled={acting}
              class="w-full rounded-xl py-3.5 text-[13px] font-extrabold active:scale-95 disabled:opacity-40"
              style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 3px 0 #7a560a;"
            >
              Re-enter · ${fmt(t.buyIn + t.fee)}
            </button>
          {/if}
        {:else if ye.canRegister}
          <button
            on:click={doRegister}
            disabled={acting}
            class="w-full rounded-xl py-3.5 text-[13px] font-extrabold active:scale-95 disabled:opacity-40"
            style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 3px 0 #7a560a;"
          >
            {t.buyIn > 0 ? `Register · $${fmt(t.buyIn + t.fee)}` : 'Register — Free'}
          </button>
        {/if}
      </div>
    {:else if myUserId && canRegisterNow}
      <button
        on:click={doRegister}
        disabled={acting}
        class="w-full rounded-3xl py-4 text-[13px] font-extrabold mb-3 active:scale-[0.98] disabled:opacity-40"
        style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 4px 0 #7a560a;"
      >
        {t.buyIn > 0 ? `Register · $${fmt(t.buyIn + t.fee)}` : 'Register — Free'}
      </button>
    {/if}

    <!-- PAYOUTS -->
    {#if t.payouts && t.payouts.length > 0}
      <div
        class="rounded-3xl p-4 mb-3"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.95)); border: 1.5px solid rgba(212,175,55,0.2);"
      >
        <div class="flex items-center gap-2 mb-3">
          <span class="text-base">🏆</span>
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 flex-1">
            Payouts
          </p>
        </div>
        <div class="space-y-1.5">
          {#each t.payouts as po}
            <div class="flex items-center justify-between text-[11px] py-1">
              <span class="font-bold text-white/80">
                {po.position === 1 ? '1st' : po.position === 2 ? '2nd' : po.position === 3 ? '3rd' : `#${po.position}`}
              </span>
              <div class="flex items-center gap-3">
                <span class="text-white/50 font-mono tabular-nums">
                  {(po.percentage * 100).toFixed(1)}%
                </span>
                <span class="text-gold font-extrabold tabular-nums min-w-[68px] text-right">
                  ${fmt(po.amount)}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- PLAYERS -->
    {#if allPlayers.length > 0}
      <div
        class="rounded-3xl p-4 mb-3"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.95)); border: 1.5px solid rgba(212,175,55,0.2);"
      >
        <div class="flex items-center gap-2 mb-3">
          <span class="text-base">👥</span>
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 flex-1">
            Players ({allPlayers.length})
          </p>
        </div>

        <div class="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar">
          {#each top30 as p, idx}
            {@const isMe = Number(p.userId) === Number(myUserId)}
            {@const isWinner = p.status === 'winner' || p.finalPosition === 1}
            {@const isElim = p.status === 'eliminated'}
            <div
              class="flex items-center gap-2.5 p-2 rounded-xl"
              style="
                background: {isMe
                  ? 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))'
                  : 'rgba(0,0,0,0.25)'};
                border: 1px solid {isMe
                  ? 'rgba(212,175,55,0.42)'
                  : 'rgba(255,255,255,0.04)'};
                {isElim ? 'opacity: 0.5;' : ''}
              "
            >
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px]"
                style="
                  background: {isWinner
                    ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                    : 'rgba(0,0,0,0.4)'};
                  border: 1px solid {isWinner
                    ? 'rgba(255,235,170,0.5)'
                    : 'rgba(255,255,255,0.08)'};
                  font-weight: 800;
                  color: {isWinner ? '#0a0800' : 'rgba(255,255,255,0.7)'};
                "
              >
                {rankIcon(idx) || `#${idx + 1}`}
              </div>

              <div class="w-8 h-8 rounded-full overflow-hidden shrink-0"
                   style="background: radial-gradient(circle, #1a3a5c, #05080f);">
                <Avatar avatarId={p.avatarId || 'king'} size="sm" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p
                    class="text-[12px] font-extrabold truncate"
                    style="
                      color: {isMe ? '#f4e5a8' : isElim ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)'};
                      {isElim ? 'text-decoration: line-through;' : ''}
                    "
                  >
                    {isMe ? 'You' : p.displayName}
                  </p>
                  {#if isMe}
                    <span
                      class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
                      style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
                    >
                      YOU
                    </span>
                  {/if}
                </div>
                <p class="text-[9px] text-white/40 font-mono">
                  {p.seat != null ? `Seat ${p.seat}` : ''}
                  {#if p.finalPosition}
                    · Finished #{p.finalPosition}
                  {/if}
                </p>
              </div>

              <div class="text-right shrink-0">
                <p
                  class="text-[12px] font-extrabold tabular-nums"
                  style="color: {isElim ? 'rgba(255,255,255,0.3)' : '#d4af37'};"
                >
                  {isElim ? '—' : `$${fmtInt(p.stack)}`}
                </p>
              </div>
            </div>
          {/each}

          {#if showSelfPinned && selfPlayer}
            <div class="pt-2 mt-1" style="border-top: 1px dashed rgba(212,175,55,0.3);">
              <div
                class="flex items-center gap-2.5 p-2 rounded-xl"
                style="
                  background: linear-gradient(90deg, rgba(212,175,55,0.18), rgba(212,175,55,0.05));
                  border: 1px solid rgba(212,175,55,0.55);
                  box-shadow: 0 0 16px rgba(212,175,55,0.2);
                "
              >
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-extrabold"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7);"
                >
                  #{allPlayers.indexOf(selfPlayer) + 1}
                </div>
                <div class="w-8 h-8 rounded-full overflow-hidden shrink-0"
                     style="background: radial-gradient(circle, #1a3a5c, #05080f);">
                  <Avatar avatarId={selfPlayer.avatarId || 'king'} size="sm" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <p class="text-[12px] font-extrabold truncate" style="color: #f4e5a8;">You</p>
                    <span
                      class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
                      style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
                    >
                      YOU
                    </span>
                  </div>
                  <p class="text-[9px] text-white/40 font-mono">
                    {selfPlayer.seat != null ? `Seat ${selfPlayer.seat}` : ''}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-[12px] font-extrabold text-gold tabular-nums">
                    ${fmtInt(selfPlayer.stack)}
                  </p>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- BLIND STRUCTURE -->
    {#if allBlinds.length > 0}
      <div
        class="rounded-3xl p-4 mb-3"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.95)); border: 1.5px solid rgba(212,175,55,0.2);"
      >
        <button
          on:click={() => (expandBlinds = !expandBlinds)}
          class="w-full flex items-center gap-2 mb-3 active:opacity-80"
        >
          <span class="text-base">📊</span>
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 flex-1 text-left">
            Blind Structure
          </p>
          <span class="text-[10px] font-bold text-white/50">
            {expandBlinds ? 'Collapse' : 'Expand'}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="3" stroke-linecap="round"
            class="text-white/50 transition-transform"
            style="transform: rotate({expandBlinds ? 180 : 0}deg);"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <div class="space-y-1">
          {#each visibleBlinds as b}
            {@const isCurrent = b.level === currentLevel && isLive}
            {@const isPast = b.level < currentLevel}
            <div
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style="
                background: {isCurrent ? 'linear-gradient(90deg, rgba(251,146,60,0.18), rgba(251,146,60,0.04))' : 'rgba(0,0,0,0.22)'};
                border: 1px solid {isCurrent ? 'rgba(251,146,60,0.55)' : 'transparent'};
                {isPast ? 'opacity: 0.5;' : ''}
              "
            >
              <span
                class="text-[10px] font-extrabold font-mono w-8 shrink-0"
                style="color: {isCurrent ? '#fb923c' : isPast ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)'};"
              >
                L{b.level}
              </span>

              {#if b.isBreak}
                <span class="text-[10px] font-bold text-cyan-300 flex-1">
                  ☕ Break · {Math.round(b.durationSec / 60)}min
                </span>
              {:else}
                <span
                  class="text-[11px] font-extrabold tabular-nums shrink-0"
                  style="color: {isCurrent ? '#fb923c' : 'rgba(255,255,255,0.85)'}; min-width: 78px;"
                >
                  {fmtInt(b.sb)}/{fmtInt(b.bb)}
                </span>
                <span class="text-[9px] text-white/40 font-mono shrink-0 tabular-nums" style="min-width: 42px;">
                  {b.ante > 0 ? `a${fmtInt(b.ante)}` : '—'}
                </span>
                <span class="text-[9px] text-white/40 shrink-0 flex-1">
                  {Math.round(b.durationSec / 60)}min
                </span>
              {/if}

              {#if isCurrent}
                <span class="text-[8px] font-extrabold text-orange-300 uppercase tracking-wider shrink-0">
                  🔵 Current
                </span>
              {:else if isPast}
                <span class="text-[9px] text-emerald-400/70 shrink-0">✓</span>
              {/if}
            </div>
          {/each}

          {#if !expandBlinds && allBlinds.length > 5 && currentLevel > 3}
            <p class="text-center text-[9px] text-white/30 pt-1">
              Showing L{Math.max(1, currentLevel - 2)}–L{currentLevel + 2} of {allBlinds.length}
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- INFO -->
    <div
      class="rounded-2xl p-3.5 mb-3 space-y-2 text-[11px] font-mono"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.12);"
    >
      <div class="flex justify-between">
        <span class="text-white/40">Variant</span>
        <span class="text-white/85 uppercase">{t.variant}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-white/40">Format</span>
        <span class="text-white/85 uppercase">{t.format} · {t.speed}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-white/40">Buy-in</span>
        <span class="text-white/85">
          {t.buyIn > 0 ? `$${fmt(t.buyIn)} + $${fmt(t.fee)}` : 'Free'}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-white/40">Stack</span>
        <span class="text-white/85 tabular-nums">{fmtInt(t.startingStack)}</span>
      </div>
      {#if t.lateRegLevel > 0}
        <div class="flex justify-between">
          <span class="text-white/40">Late reg</span>
          <span class="text-white/85">until L{t.lateRegLevel}</span>
        </div>
      {/if}
      {#if t.allowReEntry}
        <div class="flex justify-between">
          <span class="text-white/40">Re-entry</span>
          <span class="text-white/85">{t.maxReEntries}x</span>
        </div>
      {/if}
      <div class="flex justify-between">
        <span class="text-white/40">Starts</span>
        <span class="text-white/85">{fmtDate(t.scheduledStart)}</span>
      </div>
      {#if t.rakeCollected > 0}
        <div class="flex justify-between pt-2" style="border-top: 1px solid rgba(212,175,55,0.1);">
          <span class="text-white/40">Rake collected</span>
          <span class="text-emerald-400 font-bold tabular-nums">${fmt(t.rakeCollected)}</span>
        </div>
      {/if}
    </div>
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%]"
      style="background: rgba(8,13,36,0.96); border: 1px solid rgba(212,175,55,0.5); box-shadow: 0 8px 24px rgba(0,0,0,0.7);"
    >
      <p class="text-xs font-extrabold text-white">{toast}</p>
    </div>
  {/if}
</div>