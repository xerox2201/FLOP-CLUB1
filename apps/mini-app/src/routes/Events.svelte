<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { api } from '../lib/api';
  import { auth } from '../stores/auth';
  import { t } from '../i18n';

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

  function fmt(n: any): string { return Number(Number(n || 0).toFixed(2)).toFixed(2); }

  function fmtDate(d: string): string {
    try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
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

  function statusBadge(status: string): { text: string; cls: string } {
    switch (status) {
      case 'scheduled':   return { text: 'Upcoming', cls: 'bg-blue-900/60 text-blue-300 border-blue-700/40' };
      case 'registering': return { text: 'Registering', cls: 'bg-amber-900/60 text-amber-300 border-amber-700/40' };
      case 'running':     return { text: '● LIVE', cls: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/40 animate-pulse' };
      case 'finished':    return { text: 'Finished', cls: 'bg-gray-700/60 text-gray-300 border-gray-600/40' };
      case 'cancelled':   return { text: 'Cancelled', cls: 'bg-red-900/60 text-red-300 border-red-700/40' };
      default:            return { text: status, cls: 'bg-gray-700/60 text-gray-300 border-gray-600/40' };
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

  function closeModal() { selectedEvent = null; eventDetail = null; }

  async function register() {
    if (!selectedEvent || processing) return;
    processing = true;
    actionMsg = '';
    const res = await api.registerEvent(selectedEvent.id);
    processing = false;
    if (res.ok) {
      actionMsg = res.data?.already ? 'Already registered' : '✓ Registered successfully!';
      actionMsgType = 'success';
      await loadEvents();
      await openEvent(selectedEvent);
      setTimeout(() => { actionMsg = ''; }, 3000);
    } else {
      const errMap: Record<string, string> = {
        event_full: 'Tournament is full',
        insufficient_balance: 'Insufficient balance',
        event_not_open: 'Registration is closed',
      };
      actionMsg = '❌ ' + (errMap[res.error || ''] || 'Failed to register');
      actionMsgType = 'error';
      setTimeout(() => { actionMsg = ''; }, 4000);
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
      setTimeout(() => { actionMsg = ''; }, 3000);
    } else {
      actionMsg = '❌ Failed to unregister';
      actionMsgType = 'error';
      setTimeout(() => { actionMsg = ''; }, 4000);
    }
  }

  onMount(async () => { await loadEvents(); refreshTimer = setInterval(loadEvents, 10000); });
  onDestroy(() => { if (refreshTimer) clearInterval(refreshTimer); });
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center justify-between mt-3 mb-5">
    <h1 class="text-2xl font-extrabold">{$t('events.title')}</h1>
    <span class="text-[10px] glass rounded-full px-3 py-1 font-bold text-gold">
      {events.filter(e => e.status === 'running' || e.status === 'registering').length} active
    </span>
  </div>

  {#if loading}
    <p class="text-white/40 text-center py-12">{$t('common.loading')}</p>
  {:else if events.length === 0}
    <div class="card text-center py-10">
      <p class="text-4xl mb-2">🎫</p>
      <p class="text-white/50 text-sm">{$t('events.noEvents')}</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each events as ev}
        {@const badge = statusBadge(ev.status)}
        <button on:click={() => openEvent(ev)} class="card w-full text-left active:scale-[0.99] transition">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <p class="font-bold text-base leading-tight truncate">{ev.title}</p>
              <p class="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{ev.variant}</p>
            </div>
            <span class="text-[10px] px-2 py-1 rounded-full font-bold border {badge.cls} shrink-0 ml-2">{badge.text}</span>
          </div>

          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="bg-black/30 rounded-xl p-2 text-center">
              <p class="text-[9px] text-white/40 uppercase">Buy-in</p>
              <p class="text-sm font-bold text-gold">{Number(ev.buyin_usd) > 0 ? `$${fmt(ev.buyin_usd)}` : 'FREE'}</p>
            </div>
            <div class="bg-black/30 rounded-xl p-2 text-center">
              <p class="text-[9px] text-white/40 uppercase">Prize</p>
              <p class="text-sm font-bold text-emerald-400">${fmt(Number(ev.prize_pool_collected) > 0 ? ev.prize_pool_collected : ev.prize_pool_usd)}</p>
            </div>
            <div class="bg-black/30 rounded-xl p-2 text-center">
              <p class="text-[9px] text-white/40 uppercase">Players</p>
              <p class="text-sm font-bold">{ev.registered_count || 0}{ev.max_players ? `/${ev.max_players}` : ''}</p>
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

{#if selectedEvent}
  <div class="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center" on:click={closeModal} role="button" tabindex="0" on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="glass-strong rounded-t-3xl sm:rounded-3xl p-5 max-w-[480px] w-full max-h-[92vh] overflow-y-auto no-scrollbar" on:click|stopPropagation role="dialog" tabindex="-1">
      <div class="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden"></div>

      <div class="flex items-start justify-between mb-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-xl font-extrabold leading-tight">{selectedEvent.title}</h3>
          <p class="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{selectedEvent.variant}</p>
        </div>
        <button on:click={closeModal} aria-label="Close" class="text-white/50 text-xl shrink-0 ml-2">✕</button>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="bg-black/30 rounded-xl p-2 text-center">
          <p class="text-[9px] text-white/40 uppercase">Buy-in</p>
          <p class="text-sm font-bold text-gold">{Number(selectedEvent.buyin_usd) > 0 ? `$${fmt(selectedEvent.buyin_usd)}` : 'FREE'}</p>
        </div>
        <div class="bg-black/30 rounded-xl p-2 text-center">
          <p class="text-[9px] text-white/40 uppercase">Prize Pool</p>
          <p class="text-sm font-bold text-emerald-400">${fmt(Number(eventDetail?.event?.prize_pool_collected) > 0 ? eventDetail.event.prize_pool_collected : selectedEvent.prize_pool_usd)}</p>
        </div>
        <div class="bg-black/30 rounded-xl p-2 text-center">
          <p class="text-[9px] text-white/40 uppercase">Players</p>
          <p class="text-sm font-bold">{eventDetail?.event?.registered_count || selectedEvent.registered_count || 0}{selectedEvent.max_players ? `/${selectedEvent.max_players}` : ''}</p>
        </div>
      </div>

      <div class="space-y-2 mb-4 text-xs">
        <div class="flex justify-between"><span class="text-white/50">Starts</span><span class="font-bold">{fmtDate(selectedEvent.starts_at)}</span></div>
        <div class="flex justify-between"><span class="text-white/50">Starting Stack</span><span class="font-bold">{selectedEvent.starting_stack || 1500}</span></div>
        <div class="flex justify-between"><span class="text-white/50">Late Reg</span><span class="font-bold">Until Level {selectedEvent.late_reg_level || 3}</span></div>
      </div>

      {#if actionMsg}
        <div class="rounded-xl px-3 py-2 mb-3 {actionMsgType === 'success' ? 'bg-emerald-900/40 border border-emerald-700/50' : 'bg-red-900/40 border border-red-700/50'}">
          <p class="text-xs {actionMsgType === 'success' ? 'text-emerald-200' : 'text-red-200'}">{actionMsg}</p>
        </div>
      {/if}

      {#if selectedEvent.status === 'finished'}
        <div class="bg-gray-700/40 border border-white/10 rounded-xl p-3 text-center"><p class="text-sm text-white/60">This tournament has finished</p></div>
      {:else if selectedEvent.status === 'cancelled'}
        <div class="bg-red-900/40 border border-red-700/50 rounded-xl p-3 text-center"><p class="text-sm text-red-200">This tournament was cancelled</p></div>
      {:else if selectedEvent.status === 'running'}
        <div class="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-3 text-center">
          <p class="text-sm text-emerald-200 font-bold">● Tournament is live</p>
        </div>
      {:else if eventDetail && isRegistered(eventDetail)}
        <div class="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-3 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">✓</span>
            <div class="flex-1">
              <p class="text-sm font-bold text-emerald-200">You are registered!</p>
              <p class="text-[10px] text-white/50">Registered at {fmtDate(myRegistration(eventDetail)?.registered_at)}</p>
            </div>
          </div>
        </div>
        <button on:click={unregister} disabled={processing} class="w-full bg-red-950/60 border border-red-800/50 hover:bg-red-900/60 text-red-300 py-3 rounded-2xl font-semibold transition disabled:opacity-50">
          {processing ? 'Processing…' : 'Unregister (Refund)'}
        </button>
      {:else if selectedEvent.status === 'registering' || selectedEvent.status === 'scheduled'}
        <button on:click={register} disabled={processing} class="w-full btn-gold disabled:opacity-50">
          {processing ? 'Registering…' : (Number(selectedEvent.buyin_usd) > 0 ? `✓ Register — $${fmt(selectedEvent.buyin_usd)}` : '✓ Register Free')}
        </button>
      {/if}

      {#if eventDetail?.registrations && eventDetail.registrations.length > 0}
        <div class="mt-5">
          <h4 class="text-xs uppercase tracking-wider text-white/50 font-bold mb-2">Registered Players ({eventDetail.registrations.length})</h4>
          <div class="space-y-1 max-h-[200px] overflow-y-auto no-scrollbar">
            {#each eventDetail.registrations as r}
              <div class="flex items-center gap-2 bg-black/30 rounded-lg px-2 py-1.5 {r.user_id === $auth.user?.id ? 'ring-1 ring-gold' : ''}">
                <Avatar avatarId={r.avatar_id || 'spade'} size="sm" />
                <span class="text-xs font-semibold flex-1 truncate">{r.display_name}</span>
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