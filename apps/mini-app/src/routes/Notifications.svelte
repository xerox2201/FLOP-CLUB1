<script lang="ts">
  import TopBar from '../components/TopBar.svelte';

  export let onBack: () => void = () => {};

  interface Notification {
    id: string;
    type: 'tournament' | 'friend' | 'reward' | 'security' | 'system';
    title: string;
    message: string;
    time: string;
    read: boolean;
  }

  let notifications: Notification[] = [
    {
      id: '1',
      type: 'reward',
      title: 'Welcome Bonus',
      message: 'You received 1,000 free chips. Good luck!',
      time: '2 minutes ago',
      read: false,
    },
    {
      id: '2',
      type: 'system',
      title: 'New Tournaments Available',
      message: 'Daily Deepstack is now open for registration.',
      time: '1 hour ago',
      read: false,
    },
    {
      id: '3',
      type: 'security',
      title: 'New Login Detected',
      message: 'Your account was accessed from a new device.',
      time: '3 hours ago',
      read: true,
    },
  ];

  const typeIcons: Record<string, string> = {
    tournament: '🏆',
    friend: '👥',
    reward: '🎁',
    security: '🔒',
    system: '📢',
  };

  const typeColors: Record<string, string> = {
    tournament: '#8b5cf6',
    friend: '#22d3ee',
    reward: '#f4c95d',
    security: '#ef4444',
    system: '#10b981',
  };

  function markAllRead() {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  }

  $: unreadCount = notifications.filter((n) => !n.read).length;
</script>

<div class="px-4 pb-28">
  <TopBar />
  <div class="flex items-center gap-2 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:scale-95"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
    >
      ←
    </button>
    <h1 class="text-xl font-extrabold flex-1">Notifications</h1>
    {#if unreadCount > 0}
      <button
        on:click={markAllRead}
        class="text-[10px] font-bold text-gold active:opacity-70 px-2 py-1 rounded-full"
        style="background: rgba(244,201,93,0.15);"
      >
        Mark all read
      </button>
    {/if}
  </div>

  {#if notifications.length === 0}
    <div class="card p-8 text-center">
      <p class="text-4xl mb-2">🔔</p>
      <p class="text-white/50 text-sm">No notifications</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each notifications as n}
        {@const color = typeColors[n.type]}
        <div
          class="rounded-2xl p-3 flex items-start gap-3 relative {!n.read
            ? 'ring-1'
            : 'opacity-75'}"
          style="background: {n.read
            ? 'rgba(16,26,58,0.5)'
            : 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(8,13,36,0.9))'}; border: 1px solid {n.read
            ? 'rgba(139,92,246,0.15)'
            : 'rgba(139,92,246,0.35)'}; ring-color: {color}50;"
        >
          <!-- Icon -->
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style="background: {color}25; border: 1px solid {color}50;"
          >
            {typeIcons[n.type]}
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <p class="text-sm font-extrabold text-white truncate">
                {n.title}
              </p>
              {#if !n.read}
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  style="background: {color}; box-shadow: 0 0 6px {color};"
                ></span>
              {/if}
            </div>
            <p class="text-[11px] text-white/60 leading-relaxed">{n.message}</p>
            <p class="text-[9px] text-white/40 mt-1.5">{n.time}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
