<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';

  export let tournamentId: number;
  export let onBack: () => void = () => {};
  export let onOpenTable: (tournamentId: number, virtualTableId: number) => void = () => {};

  let t: any = null;
  let loading = true;
  let error = '';
  let acting = false;
  let toast = '';
  let pollTimer: any = null;

  $: myUserId = $auth.user?.id;
  $: isRegistered =
    t?.players?.some((p: any) => p.userId === myUserId && p.status === 'active') || false;
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
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  function statusColor(status: string): string {
    if (status === 'running') return '#10b981';
    if (status === 'final_table') return '#fbbf24';
    if (status === 'registering') return '#3b82f6';
    if (status === 'scheduled') return '#8b5cf6';
    if (status === 'finished') return '#6b7280';
    return '#ef4444';
  }

  async function load() {
    error = '';
    try {
      const res = await api.getTournament(tournamentId);
      if (res.ok && res.data) {
        t = res.data;
      } else {
        error = res.error || 'not_found';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function doRegister() {
    acting = true;
    try {
      const res = await api.registerTournament(tournamentId);
      if (res.ok) {
        toast = '✅ Registered!';
        await load();
      } else {
        toast = '❌ ' + (res.error || 'failed');
      }
    } catch (e: any) {
      toast = '❌ ' + e.message;
    } finally {
      acting = false;
      setTimeout(() => {
        toast = '';
      }, 3000);
    }
  }

  async function doUnregister() {
    acting = true;
    try {
      const res = await api.unregisterTournament(tournamentId);
      if (res.ok) {
        toast = '↩️ Unregistered';
        await load();
      } else {
        toast = '❌ ' + (res.error || 'failed');
      }
    } catch (e: any) {
      toast = '❌ ' + e.message;
    } finally {
      acting = false;
      setTimeout(() => {
        toast = '';
      }, 3000);
    }
  }

  async function doStart() {
    if (!confirm('Start this tournament now?')) return;
    acting = true;
    try {
      const res = await api.startTournament(tournamentId);
      if (res.ok) {
        toast = '🚀 Started!';
        await load();
      } else {
        toast = '❌ ' + (res.error || 'failed');
      }
    } catch (e: any) {
      toast = '❌ ' + e.message;
    } finally {
      acting = false;
      setTimeout(() => {
        toast = '';
      }, 3000);
    }
  }

  onMount(() => {
    load();
    pollTimer = setInterval(load, 4000);
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <div class="flex items-center gap-2 mt-3 mb-4">
    <button
      on:click={onBack}
      class="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:scale-95"
      style="background: rgba(255,255,255,0.06);">←</button
    >
    <h1 class="text-lg font-extrabold flex-1 truncate">{t?.name || 'Tournament'}</h1>
  </div>

  {#if loading}
    <div class="text-center py-12 text-white/40 text-sm">Loading…</div>
  {:else if error}
    <div
      class="rounded-xl p-4 text-center"
      style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);"
    >
      <p class="text-red-300 text-sm">{error}</p>
    </div>
  {:else if t}
    <!-- Status + Buy-in -->
    <div class="glass rounded-2xl p-4 mb-3">
      <div class="flex items-center justify-between mb-2">
        <span
          class="text-[10px] font-extrabold px-2 py-1 rounded uppercase"
          style="background: {statusColor(t.status)}22; color: {statusColor(t.status)};"
          >{t.status.replace('_', ' ')}</span
        >
        <span class="text-[10px] text-white/40 font-mono">#{t.id}</span>
      </div>
      <div class="text-3xl font-extrabold text-amber-400 tabular-nums">
        {t.buyIn > 0 ? `$${fmt(t.buyIn)}` : 'Free'}
      </div>
      {#if t.fee > 0}
        <div class="text-[10px] text-white/40 mt-0.5">+ ${fmt(t.fee)} fee</div>
      {/if}
      <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5">
        <div>
          <p class="text-[9px] text-white/40 uppercase">Registered</p>
          <p class="text-sm font-extrabold text-white tabular-nums">
            {t.registeredCount} / {t.maxPlayers}
          </p>
        </div>
        <div>
          <p class="text-[9px] text-white/40 uppercase">Prize Pool</p>
          <p class="text-sm font-extrabold text-emerald-400 tabular-nums">
            ${fmt(t.totalPrizePool)}
          </p>
        </div>
        <div>
          <p class="text-[9px] text-white/40 uppercase">Stack</p>
          <p class="text-sm font-extrabold text-white tabular-nums">
            {fmt(t.startingStack, 0)}
          </p>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div class="glass rounded-2xl p-3 mb-3 space-y-2 text-[11px] font-mono">
      <div class="flex justify-between">
        <span class="text-white/40">Variant</span>
        <span class="text-white/80 uppercase">{t.variant}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-white/40">Format</span>
        <span class="text-white/80 uppercase">{t.format} · {t.speed}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-white/40">Starts</span>
        <span class="text-white/80">{fmtDate(t.scheduledStart)}</span>
      </div>
      {#if t.status === 'running' || t.status === 'final_table'}
        <div class="flex justify-between">
          <span class="text-white/40">Current Level</span>
          <span class="text-amber-400 font-bold">Lvl {t.currentLevel}</span>
        </div>
      {/if}
      {#if t.guaranteed > 0}
        <div class="flex justify-between">
          <span class="text-white/40">Guaranteed</span>
          <span class="text-emerald-400 font-bold">${fmt(t.guaranteed)}</span>
        </div>
      {/if}
    </div>

    <!-- Payouts -->
    {#if t.payouts && t.payouts.length > 0}
      <div class="glass rounded-2xl p-3 mb-3">
        <div class="text-[10px] uppercase tracking-widest text-white/40 mb-2">Payouts</div>
        <div class="space-y-1">
          {#each t.payouts as po}
            <div class="flex justify-between text-[11px]">
              <span class="text-white/60">#{po.position}</span>
              <span class="text-amber-400 font-bold tabular-nums">
                {(Number(po.percentage) * 100).toFixed(1)}%
                {#if t.totalPrizePool > 0}
                  · ${fmt(t.totalPrizePool * Number(po.percentage))}
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Players -->
    {#if t.players && t.players.length > 0}
      <div class="glass rounded-2xl p-3 mb-3">
        <div class="text-[10px] uppercase tracking-widest text-white/40 mb-2">
          Players ({t.players.length})
        </div>
        <div class="space-y-1 max-h-64 overflow-y-auto">
          {#each t.players as p}
            <div class="flex items-center justify-between py-1">
              <div class="flex items-center gap-2">
                {#if p.status === 'winner'}<span>👑</span>
                {:else if p.status === 'eliminated'}<span class="opacity-40">💀</span>
                {:else}<span class="w-4"></span>{/if}
                <span
                  class="text-[11px] {p.status === 'eliminated'
                    ? 'text-white/40 line-through'
                    : 'text-white/90'}"
                >
                  {p.displayName}
                </span>
                {#if p.userId === myUserId}
                  <span class="text-[9px] font-bold text-amber-400">YOU</span>
                {/if}
              </div>
              <span class="text-[11px] font-mono text-amber-400 tabular-nums">
                {fmt(p.stack, 0)}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Actions -->
    <div class="space-y-2">
      {#if canRegister && !isRegistered}
        <button
          on:click={doRegister}
          disabled={acting}
          class="w-full rounded-xl py-3 font-extrabold text-black active:scale-[0.98] transition disabled:opacity-50"
          style="background: linear-gradient(180deg, #fbbf24 0%, #d97706 100%); box-shadow: 0 5px 0 #92400e;"
        >
          {acting ? '…' : t.buyIn > 0 ? `Register · $${fmt(t.buyIn + t.fee)}` : 'Register — Free'}
        </button>
      {:else if canRegister && isRegistered}
        <button
          on:click={doUnregister}
          disabled={acting}
          class="w-full rounded-xl py-3 font-extrabold text-white active:scale-[0.98] transition disabled:opacity-50"
          style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4);"
        >
          {acting ? '…' : 'Unregister'}
        </button>
        {#if canStart}
          <button
            on:click={doStart}
            disabled={acting}
            class="w-full rounded-xl py-3 font-extrabold text-black active:scale-[0.98] transition disabled:opacity-50"
            style="background: linear-gradient(180deg, #10b981 0%, #059669 100%); box-shadow: 0 5px 0 #064e3b;"
          >
            🚀 Start Now
          </button>
        {/if}
      {:else if canGoToTable}
        <button
          on:click={() => onOpenTable(tournamentId, myVirtualTableId)}
          class="w-full rounded-xl py-4 font-extrabold text-black active:scale-[0.98] transition animate-pulse"
          style="background: linear-gradient(180deg, #10b981 0%, #059669 100%); box-shadow: 0 5px 0 #064e3b;"
        >
          🎰 Go to Your Table
        </button>
        <div class="text-[10px] text-center text-white/50">
          Table {myTournamentPlayer?.tableNumber} · Seat {myTournamentPlayer?.seat}
        </div>
      {:else if t.status === 'running' || t.status === 'final_table'}
        <div
          class="rounded-xl p-3 text-center"
          style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3);"
        >
          <p class="text-[11px] text-emerald-300">Tournament in progress</p>
          <p class="text-[10px] text-white/40 mt-1">You are eliminated</p>
        </div>
      {:else if t.status === 'finished'}
        <div
          class="rounded-xl p-3 text-center"
          style="background: rgba(107,114,128,0.15); border: 1px solid rgba(107,114,128,0.3);"
        >
          <p class="text-[11px] text-white/60">Tournament finished</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2 max-w-[90%]"
      style="background: rgba(0,0,0,0.9); border: 1px solid rgba(255,255,255,0.15);"
    >
      <p class="text-xs font-bold text-white">{toast}</p>
    </div>
  {/if}
</div>
