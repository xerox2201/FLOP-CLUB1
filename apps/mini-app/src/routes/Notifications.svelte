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

  export let onBack: () => void = () => {};

  const ICONS: Record<string, string> = {
    info: '📢',
    warning: '⚠️',
    success: '✅',
    danger: '🚨',
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
</script>

<div class="pb-44 lg:pb-8">
  <TopBar />

  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95 transition"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1">🔔 Notifications</h1>
    {#if $unreadCount > 0}
      <button
        on:click={markAllRead}
        class="text-[10px] font-bold text-gold active:opacity-70 px-2 py-1 rounded-full"
        style="background: rgba(244,201,93,0.15);"
      >
        Mark all read
      </button>
    {/if}
  </div>

  {#if $broadcastsLoading && $broadcasts.length === 0}
    <div class="space-y-2 px-4">
      {#each Array(3) as _}
        <div
          class="rounded-2xl h-[80px] shimmer"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8)); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else if $broadcasts.length === 0}
    <div
      class="rounded-2xl p-8 text-center mx-4"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
    >
      <p class="text-4xl mb-2">🔔</p>
      <p class="text-white/50 text-sm">No notifications</p>
      <p class="text-white/30 text-[11px] mt-1">You're all caught up</p>
    </div>
  {:else}
    <div class="space-y-2 px-4">
      {#each $broadcasts as n (n.id)}
        {@const color = COLORS[n.severity] ?? '#3b82f6'}
        {@const icon = ICONS[n.severity] ?? '📢'}
        <button
          on:click={() => markRead(n.id)}
          class="w-full text-left rounded-2xl p-3 flex items-start gap-3 relative active:scale-[0.99] transition"
          style="
            background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(8,13,36,0.9));
            border: 1px solid {color}55;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 12px {color}22;
          "
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style="background: {color}25; border: 1px solid {color}50;"
          >
            {icon}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <p class="text-sm font-extrabold text-white truncate">{n.title}</p>
              <span
                class="w-2 h-2 rounded-full shrink-0"
                style="background: {color}; box-shadow: 0 0 6px {color};"
              ></span>
            </div>
            <p class="text-[11px] text-white/70 leading-relaxed">{n.message}</p>
            <p class="text-[9px] text-white/40 mt-1.5">{fmtDate(n.createdAt)}</p>
          </div>

          <!-- Tap to dismiss hint -->
          <div
            class="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white/30 text-xs"
            style="background: rgba(0,0,0,0.3);"
          >
            ✕
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>
