<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';

  export let onNavigate: (page: any) => void = () => {};

  let events: any[] = [];
  let loading = true;
  let selectedEvent: any = null;
  let eventDetail: any = null;
  let loadingDetail = false;
  let actionMsg = '';
  let actionMsgType: 'success' | 'error' = 'success';
  let processing = false;
  let refreshTimer: any = null;

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function fmtDate(d: string): string {
    try {
      return new Date(d).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return d;
    }
  }

  function timeUntil(d: string): string {
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return 'Now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    return `in ${Math.floor(hrs / 24)}d`;
  }

  function statusBadge(status: string): { text: string; color: string } {
    switch (status) {
      case 'scheduled':
        return { text: 'UPCOMING', color: '#8b5cf6' };
      case 'registering':
        return { text: 'REGISTERING', color: '#22d3ee' };
      case 'running':
        return { text: '● LIVE', color: '#10b981' };
      case 'finished':
        return { text: 'FINISHED', color: '#6b7280' };
      case 'cancelled':
        return { text: 'CANCELLED', color: '#ef4444' };
      default:
        return { text: status.toUpperCase(), color: '#6b7280' };
    }
  }

  function isRegistered(ev: any): boolean {
    if (!ev) return false;
    const myId = $auth.user?.id;
    if (!myId) return false;
    return ev.registrations?.some((r: any) => r.user_id === myId);
  }

  function myRegistration(ev: any): any {
    if (!ev) return null;
    const myId = $auth.user?.id;
    return ev.registrations?.find((r: any) => r.user_id === myId);
  }

  async function loadEvents() {
    const res = await api.events();
    if (res.ok && res.data) events = res.data.events;
    loading = false;
  }

  async function openEvent(ev: any) {
    selectedEvent = ev;
    loadingDetail = true;
    eventDetail = null;
    const res = await api.event(ev.id);
    if (res.ok && res.data) eventDetail = res.data;
    loadingDetail = false;
  }

  function closeModal() {
    selectedEvent = null;
    eventDetail = null;
  }

  async function register() {
    if (!selectedEvent || processing) return;
    processing = true;
    actionMsg = '';
    const res = await api.registerEvent(selectedEvent.id);
    processing = false;
    if (res.ok) {
      actionMsg = res.data?.already ? 'Already registered' : '✓ Registered!';
      actionMsgType = 'success';
      await loadEvents();
      await openEvent(selectedEvent);
      setTimeout(() => (actionMsg = ''), 3000);
    } else {
      const errMap: Record<string, string> = {
        event_full: 'Tournament is full',
        insufficient_balance: 'Insufficient balance',
        event_not_open: 'Registration is closed',
      };
      actionMsg = '❌ ' + (errMap[res.error || ''] || 'Failed to register');
      actionMsgType = 'error';
      setTimeout(() => (actionMsg = ''), 4000);
    }
  }

  async function unregister() {
    if (!selectedEvent || processing) return;
    if (!confirm('Unregister? Buy-in will be refunded.')) return;
    processing = true;
    actionMsg = '';
    const res = await api.unregisterEvent(selectedEvent.id);
    processing = false;
    if (res.ok) {
      actionMsg = '✓ Unregistered (refunded)';
      actionMsgType = 'success';
      await loadEvents();
      await openEvent(selectedEvent);
      setTimeout(() => (actionMsg = ''), 3000);
    } else {
      actionMsg = '❌ Failed to unregister';
      actionMsgType = 'error';
      setTimeout(() => (actionMsg = ''), 4000);
    }
  }

  onMount(async () => {
    await loadEvents();
    refreshTimer = setInterval(loadEvents, 10000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center justify-between mt-3 mb-5">
    <h1 class="text-2xl font-extrabold">Events</h1>
    <span
      class="text-[10px] rounded-full px-3 py-1 font-bold text-gold"
      style="background: rgba(244,201,93,0.15); border: 1px solid rgba(244,201,93,0.35);"
    >
      {events.filter((e) => e.status === 'running' || e.status === 'registering').length} active
    </span>
  </div>

  {#if loading}
    <p class="text-white/40 text-center py-12">Loading…</p>
  {:else if events.length === 0}
    <div class="card text-center py-10">
      <p class="text-4xl mb-2">🎫</p>
      <p class="text-white/50 text-sm">No events scheduled</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each events as ev}
        {@const badge = statusBadge(ev.status)}
        <button
          on:click={() => openEvent(ev)}
          class="w-full text-left rounded-2xl p-3 active:scale-[0.98] transition"
          style="background: linear-gradient(135deg, rgba(16,26,58,0.9), rgba(8,13,36,0.9)); border: 1px solid rgba(139,92,246,0.2);"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <p class="font-extrabold text-base leading-tight truncate text-white">
                {ev.title}
              </p>
              <p class="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">
                {ev.variant}
              </p>
            </div>
            <span
              class="text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ml-2 uppercase tracking-wider"
              style="background: {badge.color}25; color: {badge.color}; border: 1px solid {badge.color}50;"
            >
              {badge.text}
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="rounded-xl p-2 text-center" style="background: rgba(0,0,0,0.3);">
              <p class="text-[9px] text-white/40 uppercase font-bold">Buy-in</p>
              <p class="text-sm font-bold text-gold tabular-nums">
                {Number(ev.buyin_usd) > 0 ? `$${fmt(ev.buyin_usd)}` : 'FREE'}
              </p>
            </div>
            <div class="rounded-xl p-2 text-center" style="background: rgba(0,0,0,0.3);">
              <p class="text-[9px] text-white/40 uppercase font-bold">Prize</p>
              <p class="text-sm font-bold text-emerald-400 tabular-nums">
                ${fmt(
                  Number(ev.prize_pool_collected) > 0 ? ev.prize_pool_collected : ev.prize_pool_usd,
                )}
              </p>
            </div>
            <div class="rounded-xl p-2 text-center" style="background: rgba(0,0,0,0.3);">
              <p class="text-[9px] text-white/40 uppercase font-bold">Players</p>
              <p class="text-sm font-bold text-white tabular-nums">
                {ev.registered_count || 0}{ev.max_players ? `/${ev.max_players}` : ''}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 text-[11px] text-white/60">
            <span>🕒</span>
            <span>{fmtDate(ev.starts_at)}</span>
            {#if ev.status === 'scheduled' || ev.status === 'registering'}
              <span class="text-gold font-bold">({timeUntil(ev.starts_at)})</span>
            {/if}
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- Detail modal -->
{#if selectedEvent}
  <div
    class="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center backdrop-blur-sm"
    on:click={closeModal}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Escape' && closeModal()}
  >
    <div
      class="rounded-t-3xl sm:rounded-3xl p-5 max-w-[480px] w-full max-h-[92vh] overflow-y-auto no-scrollbar"
      style="background: linear-gradient(180deg, #101a3a, #080d24); border: 1px solid rgba(139,92,246,0.3);"
      on:click|stopPropagation
      role="dialog"
      tabindex="-1"
    >
      <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden"></div>

      <div class="flex items-start justify-between mb-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-xl font-extrabold leading-tight text-white">
            {selectedEvent.title}
          </h3>
          <p class="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">
            {selectedEvent.variant}
          </p>
        </div>
        <button
          on:click={closeModal}
          aria-label="Close"
          class="text-white/50 text-xl shrink-0 ml-2"
        >
          ✕
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="rounded-xl p-2 text-center" style="background: rgba(0,0,0,0.3);">
          <p class="text-[9px] text-white/40 uppercase font-bold">Buy-in</p>
          <p class="text-sm font-bold text-gold">
            {Number(selectedEvent.buyin_usd) > 0 ? `$${fmt(selectedEvent.buyin_usd)}` : 'FREE'}
          </p>
        </div>
        <div class="rounded-xl p-2 text-center" style="background: rgba(0,0,0,0.3);">
          <p class="text-[9px] text-white/40 uppercase font-bold">Prize Pool</p>
          <p class="text-sm font-bold text-emerald-400">
            ${fmt(
              Number(eventDetail?.event?.prize_pool_collected) > 0
                ? eventDetail.event.prize_pool_collected
                : selectedEvent.prize_pool_usd,
            )}
          </p>
        </div>
        <div class="rounded-xl p-2 text-center" style="background: rgba(0,0,0,0.3);">
          <p class="text-[9px] text-white/40 uppercase font-bold">Players</p>
          <p class="text-sm font-bold text-white">
            {eventDetail?.event?.registered_count ||
              selectedEvent.registered_count ||
              0}{selectedEvent.max_players ? `/${selectedEvent.max_players}` : ''}
          </p>
        </div>
      </div>

      <div class="space-y-2 mb-4 text-xs">
        <div class="flex justify-between">
          <span class="text-white/50">Starts</span>
          <span class="font-bold text-white">{fmtDate(selectedEvent.starts_at)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-white/50">Starting Stack</span>
          <span class="font-bold text-white">{selectedEvent.starting_stack || 1500}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-white/50">Late Reg</span>
          <span class="font-bold text-white">Until Level {selectedEvent.late_reg_level || 3}</span>
        </div>
      </div>

      {#if actionMsg}
        <div
          class="rounded-xl px-3 py-2 mb-3"
          style="background: {actionMsgType === 'success'
            ? 'rgba(16,185,129,0.15)'
            : 'rgba(239,68,68,0.15)'}; border: 1px solid {actionMsgType === 'success'
            ? 'rgba(16,185,129,0.4)'
            : 'rgba(239,68,68,0.4)'};"
        >
          <p class="text-xs {actionMsgType === 'success' ? 'text-emerald-200' : 'text-red-200'}">
            {actionMsg}
          </p>
        </div>
      {/if}

      {#if selectedEvent.status === 'finished'}
        <div
          class="rounded-xl p-3 text-center"
          style="background: rgba(107,114,128,0.2); border: 1px solid rgba(107,114,128,0.4);"
        >
          <p class="text-sm text-white/60">This tournament has finished</p>
        </div>
      {:else if selectedEvent.status === 'cancelled'}
        <div
          class="rounded-xl p-3 text-center"
          style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4);"
        >
          <p class="text-sm text-red-200">This tournament was cancelled</p>
        </div>
      {:else if selectedEvent.status === 'running'}
        <div
          class="rounded-xl p-3 text-center"
          style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4);"
        >
          <p class="text-sm text-emerald-200 font-bold">● Tournament is live</p>
        </div>
      {:else if eventDetail && isRegistered(eventDetail)}
        <div
          class="rounded-2xl p-3 mb-3"
          style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4);"
        >
          <div class="flex items-center gap-2">
            <span class="text-lg">✓</span>
            <div class="flex-1">
              <p class="text-sm font-bold text-emerald-200">You are registered!</p>
              <p class="text-[10px] text-white/50">
                Registered at {fmtDate(myRegistration(eventDetail)?.registered_at)}
              </p>
            </div>
          </div>
        </div>
        <button
          on:click={unregister}
          disabled={processing}
          class="w-full py-3 rounded-2xl font-bold text-red-300 transition disabled:opacity-50"
          style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.4);"
        >
          {processing ? 'Processing…' : 'Unregister (Refund)'}
        </button>
      {:else if selectedEvent.status === 'registering' || selectedEvent.status === 'scheduled'}
        <button
          on:click={register}
          disabled={processing}
          class="w-full btn-gold disabled:opacity-50"
        >
          {processing
            ? 'Registering…'
            : Number(selectedEvent.buyin_usd) > 0
              ? `✓ Register — $${fmt(selectedEvent.buyin_usd)}`
              : '✓ Register Free'}
        </button>
      {/if}

      {#if eventDetail?.registrations && eventDetail.registrations.length > 0}
        <div class="mt-5">
          <h4 class="text-xs uppercase tracking-wider text-white/50 font-bold mb-2">
            Registered Players ({eventDetail.registrations.length})
          </h4>
          <div class="space-y-1 max-h-[200px] overflow-y-auto no-scrollbar">
            {#each eventDetail.registrations as r}
              <div
                class="flex items-center gap-2 rounded-lg px-2 py-1.5 {r.user_id === $auth.user?.id
                  ? 'ring-1 ring-gold'
                  : ''}"
                style="background: rgba(0,0,0,0.3);"
              >
                <Avatar avatarId={r.avatar_id || 'spade'} size="sm" />
                <span class="text-xs font-semibold flex-1 truncate text-white/90"
                  >{r.display_name}</span
                >
                {#if r.user_id === $auth.user?.id}
                  <span class="text-[9px] text-gold font-bold">YOU</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
