<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';

  import {
    broadcasts,
    broadcastsLoading,
    unreadCount,
    loadBroadcasts,
    markRead,
    markAllRead,
  } from '../lib/broadcasts';
  import Icon from '../components/Icon.svelte';
  export let onBack: () => void = () => {};

  // Severity -> Icon.svelte glyph name (Icon.svelte is the only icon source).
  const ICONS: Record<string, string> = {
    info: 'broadcast',
    warning: 'warning',
    success: 'success',
    danger: 'error',
  };

  const LABELS: Record<string, string> = {
    info: 'Update',
    warning: 'Warning',
    success: 'Reward',
    danger: 'Alert',
  };

  const COLORS: Record<string, string> = {
    info: '#3b82f6',
    warning: '#f59e0b',
    success: '#10b981',
    danger: '#ef4444',
  };

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'Just now';
      if (min < 60) return `${min}m ago`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  onMount(() => {
    loadBroadcasts();
  });

  $: latestAt = $broadcasts[0]?.createdAt ?? null;
  $: urgentCount = $broadcasts.filter(
    (n) => n.severity === 'danger' || n.severity === 'warning',
  ).length;
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="px-4 mt-2 mb-3">
    <div class="flex items-center gap-3">
      <button
        on:click={onBack}
        aria-label="Back"
        class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition shrink-0"
        style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
      >
        <Icon name="arrow-left" size={18} color="#ffffff" />
      </button>

      <div
        class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
        style="
          background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.4), rgba(168,121,34,0.15));
          border: 1.5px solid rgba(244,201,93,0.55);
          box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), 0 0 20px rgba(244,201,93,0.2);
        "
      >
        <Icon name="bell" size={24} color="#f4c95d" />
        {#if $unreadCount > 0}
          <span
            class="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-micro font-extrabold tabular-nums"
            style="
              background: linear-gradient(180deg, #ef4444, #b91c1c);
              color: #ffffff;
              border: 1.5px solid #05080f;
              box-shadow: 0 2px 8px rgba(239,68,68,0.6);
            "
          >
            {$unreadCount}
          </span>
        {/if}
      </div>

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
          Notifications
        </h1>
        <p class="text-mini text-white/45 mt-1 font-bold truncate">
          Alerts, rewards and announcements
        </p>
      </div>
    </div>
  </div>

  <!-- ============ SUMMARY GRID ============ -->
  <div class="grid grid-cols-3 gap-2 px-4 mb-3">
    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(244,201,93,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(244,201,93,0.2); border: 1px solid rgba(244,201,93,0.4);"
        >
          <Icon name="bell" size={12} color="#f4c95d" />
        </div>
      </div>
      <p class="text-[17px] font-extrabold text-gold tabular-nums leading-none">
        {$unreadCount}
      </p>
      <p class="text-micro text-white/45 mt-1 font-bold">Unread</p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(34,211,238,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(34,211,238,0.2); border: 1px solid rgba(34,211,238,0.4);"
        >
          <Icon name="broadcast" size={12} color="#22d3ee" />
        </div>
      </div>
      <p class="text-[17px] font-extrabold text-cyan tabular-nums leading-none">
        {$broadcasts.length}
      </p>
      <p class="text-micro text-white/45 mt-1 font-bold truncate">
        {latestAt ? fmtDate(latestAt) : 'Total'}
      </p>
    </div>

    <div
      class="rounded-2xl p-3 relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(239,68,68,0.15) 0%, transparent 60%),
          linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
        border: 1px solid rgba(239,68,68,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      "
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="w-6 h-6 rounded-lg flex items-center justify-center"
          style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4);"
        >
          <Icon name="warning" size={12} color="#fca5a5" />
        </div>
      </div>
      <p class="text-[17px] font-extrabold text-red-300 tabular-nums leading-none">
        {urgentCount}
      </p>
      <p class="text-micro text-white/45 mt-1 font-bold">Action</p>
    </div>
  </div>

  <!-- ============ MARK ALL READ ============ -->
  {#if $unreadCount > 0}
    <div class="px-4 mb-3">
      <button
        on:click={markAllRead}
        class="w-full rounded-2xl py-3 flex items-center justify-center gap-2 text-tiny font-extrabold active:scale-[0.98] transition-all"
        style="
          background: linear-gradient(180deg, rgba(244,201,93,0.18), rgba(168,121,34,0.06));
          border: 1px solid rgba(244,201,93,0.4);
          color: #f4c95d;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        "
      >
        <Icon name="check" size={13} color="#f4c95d" />
        <span>Mark all read</span>
      </button>
    </div>
  {/if}

  <!-- ============ CONTENT ============ -->
  {#if $broadcastsLoading && $broadcasts.length === 0}
    <!-- LOADING SKELETON -->
    <div class="px-4 space-y-2">
      {#each Array(4) as _}
        <div
          class="rounded-2xl h-[96px] shimmer"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else if $broadcasts.length === 0}
    <!-- EMPTY STATE -->
    <div class="px-4">
      <div
        class="rounded-2xl p-8 text-center relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 60%),
            linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
          border: 1px dashed rgba(212,175,55,0.3);
        "
      >
        <div class="flex justify-center mb-3">
          <Icon name="bell" size={44} color="#d4af37" />
        </div>
        <p class="text-sm font-extrabold text-white">No notifications</p>
        <p class="text-tiny text-white/50 mt-1 font-bold">You're all caught up</p>
      </div>
    </div>
  {:else}
    <!-- INBOX -->
    <div class="flex items-center gap-2 mb-2 px-4">
      <span class="w-1.5 h-1.5 rounded-full bg-gold" style="box-shadow: 0 0 6px #d4af37;"></span>
      <p class="text-mini font-extrabold text-white/60 uppercase tracking-widest">Inbox</p>
      <span class="text-micro font-bold text-white/35 tabular-nums ms-auto">
        {$broadcasts.length} messages
      </span>
    </div>

    <div class="space-y-2 px-4">
      {#each $broadcasts as n (n.id)}
        {@const color = COLORS[n.severity] ?? '#3b82f6'}
        {@const icon = ICONS[n.severity] ?? 'broadcast'}
        {@const label = LABELS[n.severity] ?? 'Update'}
        <button
          on:click={() => markRead(n.id)}
          class="w-full text-start rounded-2xl p-3 flex items-start gap-3 relative active:scale-[0.99] transition-all"
          style="
            background: linear-gradient(135deg, {color}18, rgba(8,13,36,0.92));
            border: 1px solid {color}55;
            box-shadow: 0 4px 16px rgba(0,0,0,0.45), 0 0 12px {color}22;
          "
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style="background: {color}25; border: 1px solid {color}50;"
          >
            <Icon name={icon} size={18} {color} />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 pe-5">
              <span
                class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                style="background: {color}22; border: 1px solid {color}55; color: {color};"
              >
                {label}
              </span>
              <p class="text-sm font-extrabold text-white truncate flex-1">{n.title}</p>
            </div>

            <p class="text-tiny text-white/70 leading-relaxed">{n.message}</p>

            <div class="flex items-center gap-1.5 mt-1.5">
              <Icon name="clock" size={10} color="rgba(255,255,255,0.4)" />
              <p class="text-micro text-white/40 font-bold">{fmtDate(n.createdAt)}</p>
            </div>
          </div>

          <!-- Tap to dismiss hint -->
          <div
            class="absolute top-2 end-2 w-5 h-5 rounded-full flex items-center justify-center"
            style="background: rgba(0,0,0,0.3);"
          >
            <Icon name="close" size={10} color="rgba(255,255,255,0.35)" />
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
