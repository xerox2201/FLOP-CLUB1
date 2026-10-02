<script lang="ts">
  import { t, type MessageKey } from '../i18n';
  import { unreadCount } from '../lib/broadcasts';
  import Icon from './Icon.svelte';

  type Page =
    | 'home'
    | 'tables'
    | 'wallet'
    | 'profile'
    | 'leaderboard'
    | 'events'
    | 'table'
    | 'tournaments'
    | 'tournament-detail';

  export let current: Page;
  export let onNavigate: (page: Page) => void;

  const items: { id: Page; key: MessageKey; icon: string }[] = [
    { id: 'home' as Page, key: 'nav.home', icon: 'home' },
    { id: 'tables' as Page, key: 'nav.tables', icon: 'tables' },
    { id: 'tournaments' as Page, key: 'nav.tournaments', icon: 'tournaments' },
    { id: 'wallet' as Page, key: 'nav.wallet', icon: 'wallet' },
    { id: 'profile' as Page, key: 'nav.profile', icon: 'user' },
  ];
</script>

<nav
  class="fixed bottom-0 start-0 end-0 z-40 lg:hidden"
  style="background: linear-gradient(180deg, rgba(5,8,15,0) 0%, rgba(5,8,15,0.88) 42%, #05080f 100%); backdrop-filter: blur(6px);"
>
  <div class="max-w-[480px] mx-auto px-3 pb-2 pt-2">
    <div
      class="rounded-3xl flex items-center justify-around py-1.5"
      style="
        background: linear-gradient(180deg, rgba(7,14,27,0.95) 0%, rgba(5,8,15,0.98) 100%);
        border: 1px solid rgba(212,175,55,0.25);
        box-shadow: 0 -4px 30px rgba(0,0,0,0.6), 0 0 30px rgba(212,175,55,0.1), inset 0 1px 0 rgba(255,255,255,0.06);
        backdrop-filter: blur(16px);
      "
    >
      {#each items as item}
        <button
          on:click={() => onNavigate(item.id)}
          class="relative flex flex-col items-center gap-1 px-2 py-1 rounded-2xl transition-all active:scale-95 {current ===
          item.id
            ? 'text-gold'
            : 'text-white/45'}"
        >
          <Icon name={item.icon} size={22} />
          <span class="text-micro font-bold">{$t(item.key)}</span>
          {#if current === item.id}
            <span
              class="w-1 h-1 rounded-full bg-gold"
              style="box-shadow: 0 0 6px rgba(244,201,93,0.8);"
            ></span>
          {/if}
          {#if item.id === 'profile' && $unreadCount > 0}
            <span
              class="absolute -top-1 -end-1 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-micro font-extrabold"
              style="background: linear-gradient(180deg, #ef4444, #991b1b); color: white; box-shadow: 0 0 8px rgba(239,68,68,0.8);"
            >
              {$unreadCount > 9 ? '9+' : $unreadCount}
            </span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</nav>
