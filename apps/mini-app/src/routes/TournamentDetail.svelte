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
  let pausedBanner = false;

  async function doPause() {
    if (!confirm('Pause this tournament?')) return;
    acting = true;
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_secret') || ''}`,
        },
        body: '{}',
      });
      const data = await res.json();
      if (res.ok) { toast = '⏸️ Paused'; await load(); }
      else toast = '❌ ' + (data.error || 'failed');
    } catch (e: any) { toast = '❌ ' + e.message; }
    finally { acting = false; setTimeout(() => (toast = ''), 3000); }
  }

  async function doResume() {
    acting = true;
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_secret') || ''}`,
        },
        body: '{}',
      });
      const data = await res.json();
      if (res.ok) { toast = '▶️ Resumed'; await load(); }
      else toast = '❌ ' + (data.error || 'failed');
    } catch (e: any) { toast = '❌ ' + e.message; }
    finally { acting = false; setTimeout(() => (toast = ''), 3000); }
  }
  let pollTimer: any = null;

  $: myUserId = $auth.user?.id;
  $: isRegistered = t?.players?.some((p: any) => p.userId === myUserId && p.status === 'active') || false;
  $: myTournamentPlayer = t?.players?.find((p: any) => p.userId === myUserId);
  $: myVirtualTableId = myTournamentPlayer?.virtualTableId ?? null;
  $: canGoToTable =
    !!myVirtualTableId &&
    (t?.status === 'running' || t?.status === 'final_table') &&
    myTournamentPlayer?.status === 'active';
  $: canRegister = t && (t.status === 'registering' || t.status === 'scheduled');
  $: canStart = t && canRegister && t.registeredCount >= t.minPlayers;

  function fmt(n: any, d = 2): string {
    return Number(Number(n || 0).toFixed(d)).toFixed(d);
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

  function statusColor(status: string): string {
    if (status === 'running') return '#10b981';
    if (status === 'final_table') return '#d4af37';
    if (status === 'registering') return '#22d3ee';
    if (status === 'scheduled') return '#8b5cf6';
    if (status === 'finished') return '#6b7280';
    if (status === 'paused') return '#f59e0b';
    return '#ef4444';
  }

  function statusLabel(status: string): string {
    return status.replace('_', ' ').toUpperCase();
  }

  async function load() {
    error = '';
    try {
      const res = await api.getTournament(tournamentId);
      if (res.ok && res.data) t = res.data;
      else error = res.error || 'not_found';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
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
    pollTimer = setInterval(load, 15000);
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

  async function doRegister() {
    acting = true;
    try {
      const res = await api.registerTournament(tournamentId);
      if (res.ok) { toast = '✅ Registered!'; await load(); }
      else toast = '❌ ' + (res.error || 'failed');
    } catch (e: any) { toast = '❌ ' + e.message; }
    finally { acting = false; setTimeout(() => (toast = ''), 3000); }
  }

  async function doUnregister() {
    acting = true;
    try {
      const res = await api.unregisterTournament(tournamentId);
      if (res.ok) { toast = '↩️ Unregistered'; await load(); }
      else toast = '❌ ' + (res.error || 'failed');
    } catch (e: any) { toast = '❌ ' + e.message; }
    finally { acting = false; setTimeout(() => (toast = ''), 3000); }
  }

  async function doStart() {
    if (!confirm('Start this tournament now?')) return;
    acting = true;
    try {
      const res = await api.startTournament(tournamentId);
      if (res.ok) { toast = '🚀 Started!'; await load(); }
      else toast = '❌ ' + (res.error || 'failed');
    } catch (e: any) { toast = '❌ ' + e.message; }
    finally { acting = false; setTimeout(() => (toast = ''), 3000); }
  }
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <!-- ============ HEADER ============ -->
  <div class="flex items-center gap-3 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="
        background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7));
        border: 1.5px solid rgba(96,165,250,0.3);
      "
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="white" stroke-width="2.5" stroke-linecap="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-lg font-extrabold flex-1 truncate text-white">
      {t?.name || 'Tournament'}
    </h1>
  </div>

  {#if loading}
    <div class="text-center py-12 text-white/40 text-sm">Loading…</div>
  {:else if error}
    <div
      class="rounded-2xl p-4 text-center"
      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"
    >
      <p class="text-red-300 text-sm font-bold">{error}</p>
    </div>
  {:else if t}
    {@const sc = statusColor(t.status)}

    <!-- ============ HERO CARD ============ -->
    <div
      class="rounded-3xl p-5 mb-4 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 50% 0%, {sc}30 0%, transparent 60%),
          linear-gradient(180deg, rgba(30,58,138,0.4) 0%, rgba(15,31,58,0.85) 50%, rgba(7,14,27,0.95) 100%);
        border: 1.5px solid {sc}50;
        box-shadow:
          0 12px 40px rgba(0,0,0,0.6),
          0 0 30px {sc}20,
          inset 0 1px 0 rgba(255,255,255,0.08);
      "
    >
      <div class="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-20 pointer-events-none"
           style="background: radial-gradient(circle, {sc}, transparent 70%);"></div>

      <!-- Status + id -->
      <div class="flex items-center justify-between mb-3 relative">
        <span
          class="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest"
          style="
            background: {sc}25;
            color: {sc};
            border: 1px solid {sc}60;
            box-shadow: 0 0 12px {sc}40;
          "
        >
          {statusLabel(t.status)}
        </span>
        <span class="text-[10px] text-white/40 font-mono">#{t.id}</span>
      </div>

      <!-- Buy-in -->
      <div class="flex items-baseline gap-2 relative mb-1">
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
          {t.buyIn > 0 ? `$${fmt(t.buyIn)}` : 'Free'}
        </span>
        {#if t.fee > 0}
          <span class="text-[11px] text-white/50">+ ${fmt(t.fee)} fee</span>
        {/if}
      </div>

      <!-- Stats grid -->
      <div
        class="grid grid-cols-3 gap-2 mt-4 pt-4 relative"
        style="border-top: 1px solid {sc}25;"
      >
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">
            Registered
          </p>
          <p class="text-lg font-extrabold text-white tabular-nums leading-none">
            {t.registeredCount}
            <span class="text-white/40 text-sm">/{t.maxPlayers}</span>
          </p>
        </div>
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">
            Prize Pool
          </p>
          <p class="text-lg font-extrabold tabular-nums leading-none" style="color: #6ee7b7;">
            ${fmt(t.totalPrizePool)}
          </p>
        </div>
        <div class="text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-1">
            Stack
          </p>
          <p class="text-lg font-extrabold text-white tabular-nums leading-none">
            {fmt(t.startingStack, 0)}
          </p>
        </div>
      </div>
    </div>

    <!-- ============ INFO ============ -->
    <div
      class="rounded-2xl p-3.5 mb-3 space-y-2.5 text-[11px] font-mono"
      style="
        background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9));
        border: 1px solid rgba(212,175,55,0.15);
        box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
      "
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
        <span class="text-white/40">Starts</span>
        <span class="text-white/85">{fmtDate(t.scheduledStart)}</span>
      </div>
      {#if t.status === 'running' || t.status === 'final_table'}
        <div class="flex justify-between">
          <span class="text-white/40">Current Level</span>
          <span class="text-gold font-bold">Lvl {t.currentLevel}</span>
        </div>
      {/if}
      {#if t.guaranteed > 0}
        <div class="flex justify-between">
          <span class="text-white/40">Guaranteed</span>
          <span class="text-emerald-400 font-bold">${fmt(t.guaranteed)}</span>
        </div>
      {/if}
    </div>

    <!-- ============ PAYOUTS ============ -->
    {#if t.payouts && t.payouts.length > 0}
      <div
        class="rounded-2xl p-3.5 mb-3"
        style="
          background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9));
          border: 1px solid rgba(212,175,55,0.15);
          box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
        "
      >
        <div class="t-label text-gold/70 mb-2">Payouts</div>
        <div class="space-y-1.5">
          {#each t.payouts as po}
            <div class="flex justify-between text-[11px]">
              <span class="text-white/60 font-mono">#{po.position}</span>
              <span class="text-gold font-extrabold tabular-nums">
                {(Number(po.percentage) * 100).toFixed(1)}%
                {#if t.totalPrizePool > 0}
                  · <span class="text-emerald-400">${fmt(t.totalPrizePool * Number(po.percentage))}</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ============ PLAYERS ============ -->
    {#if t.players && t.players.length > 0}
      <div
        class="rounded-2xl p-3.5 mb-3"
        style="
          background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9));
          border: 1px solid rgba(212,175,55,0.15);
          box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.04);
        "
      >
        <div class="t-label text-gold/70 mb-2">
          Players ({t.players.length})
        </div>
        <div class="space-y-1.5 max-h-72 overflow-y-auto no-scrollbar">
          {#each t.players as p}
            {@const isWinner = p.status === 'winner'}
            {@const isElim = p.status === 'eliminated'}
            {@const isMe = p.userId === myUserId}
            <div
              class="flex items-center gap-2.5 p-2 rounded-xl"
              style="
                background: {isMe
                  ? 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))'
                  : 'rgba(0,0,0,0.25)'};
                border: 1px solid {isMe
                  ? 'rgba(212,175,55,0.4)'
                  : 'rgba(255,255,255,0.04)'};
                {isElim ? 'opacity: 0.5;' : ''}
              "
            >
              <!-- Rank icon -->
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                style="
                  background: {isWinner
                    ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                    : 'rgba(0,0,0,0.4)'};
                  border: 1px solid {isWinner
                    ? 'rgba(255,235,170,0.5)'
                    : 'rgba(255,255,255,0.08)'};
                "
              >
                {#if isWinner}
                  <span style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.4));">👑</span>
                {:else if isElim}
                  <span class="text-xs opacity-60">💀</span>
                {:else}
                  <span class="text-[10px] font-extrabold text-white/50 tabular-nums">
                    {p.seat}
                  </span>
                {/if}
              </div>

              <!-- Avatar -->
              <div class="w-8 h-8 rounded-full overflow-hidden shrink-0" style="background: radial-gradient(circle, #1a3a5c, #05080f);">
                <Avatar avatarId={p.avatarId || 'king'} size="sm" />
              </div>

              <!-- Name -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p
                    class="text-[12px] font-extrabold truncate"
                    style="
                      color: {isMe
                        ? '#f4e5a8'
                        : isElim
                          ? 'rgba(255,255,255,0.4)'
                          : 'rgba(255,255,255,0.9)'};
                      {isElim ? 'text-decoration: line-through;' : ''}
                    "
                  >
                    {p.displayName}
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
                <p class="text-[10px] text-white/40 font-mono">
                  Seat {p.seat}{p.finalPosition ? ` · Finished #${p.finalPosition}` : ''}
                </p>
              </div>

              <!-- Stack -->
              <div class="text-right shrink-0">
                <p
                  class="text-[12px] font-extrabold tabular-nums"
                  style="color: {isElim ? 'rgba(255,255,255,0.3)' : '#d4af37'};"
                >
                  {fmt(p.stack, 0)}
                </p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ============ ACTIONS ============ -->
    <div class="space-y-2 mt-4">
        <!-- D5.1: Pause/Resume (admin) -->
    {#if t.status === 'running' || t.status === 'final_table'}
      <button
        on:click={doPause}
        disabled={acting}
        class="btn w-full disabled:opacity-50"
        style="padding: 12px; background: linear-gradient(180deg, #f59e0b, #b45309); color: white; font-size: 13px;"
      >
        ⏸️ Pause Tournament (Admin)
      </button>
    {:else if t.status === 'paused'}
      <button
        on:click={doResume}
        disabled={acting}
        class="btn btn-success w-full disabled:opacity-50"
        style="padding: 14px; font-size: 14px;"
      >
        ▶️ Resume Tournament
      </button>
    {/if}

      {#if canRegister && !isRegistered}
        <button
          on:click={doRegister}
          disabled={acting}
          class="btn btn-gold w-full disabled:opacity-50"
          style="padding: 16px; font-size: 14px;"
        >
          {acting ? '…' : t.buyIn > 0 ? `🎟️ Register · $${fmt(t.buyIn + t.fee)}` : '🎟️ Register — Free'}
        </button>
      {:else if canRegister && isRegistered}
        <button
          on:click={doUnregister}
          disabled={acting}
          class="btn btn-danger w-full disabled:opacity-50"
          style="padding: 14px;"
        >
          {acting ? '…' : '↩️ Unregister'}
        </button>
        {#if canStart}
          <button
            on:click={doStart}
            disabled={acting}
            class="btn btn-success w-full disabled:opacity-50"
            style="padding: 14px;"
          >
            🚀 Start Now
          </button>
        {/if}
      {:else if canGoToTable}
        <button
          on:click={() => onOpenTable(tournamentId, myVirtualTableId)}
          class="btn btn-success w-full animate-gold-pulse"
          style="padding: 18px; font-size: 15px;"
        >
          🎰 Go to Your Table
        </button>
        <div class="text-[10px] text-center text-white/50">
          Table {myTournamentPlayer?.tableNumber} · Seat {myTournamentPlayer?.seat}
        </div>
      {:else if t.status === 'running' || t.status === 'final_table'}
        <div
          class="rounded-2xl p-4 text-center"
          style="
            background: rgba(16,185,129,0.12);
            border: 1.5px solid rgba(16,185,129,0.35);
          "
        >
          <p class="text-[12px] text-emerald-300 font-extrabold">● Tournament in progress</p>
          <p class="text-[10px] text-white/40 mt-1">You are eliminated</p>
        </div>
      {:else if t.status === 'finished'}
        <div
          class="rounded-2xl p-4 text-center"
          style="
            background: rgba(107,114,128,0.15);
            border: 1.5px solid rgba(107,114,128,0.3);
          "
        >
          <p class="text-[12px] text-white/60 font-extrabold">🏁 Tournament finished</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2.5 max-w-[90%]"
      style="
        background: rgba(8,13,36,0.96);
        border: 1px solid rgba(212,175,55,0.5);
        box-shadow: 0 8px 24px rgba(0,0,0,0.7);
      "
    >
      <p class="text-xs font-extrabold text-white">{toast}</p>
    </div>
  {/if}
</div>