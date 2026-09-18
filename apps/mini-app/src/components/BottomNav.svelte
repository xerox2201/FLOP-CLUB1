<script lang="ts">
  import { t } from '../i18n';

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

  const items = [
    {
      id: 'home' as Page,
      key: 'nav.home',
      path: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10.5z',
    },
    {
      id: 'tables' as Page,
      key: 'nav.tables',
      path: 'M4 5h16v10a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V5zm0 6h16M8 21l1-2m7 2-1-2',
    },
    {
      id: 'tournaments' as Page,
      key: 'nav.tournaments',
      path: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
    },
    {
      id: 'wallet' as Page,
      key: 'nav.wallet',
      path: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm14 5h3v2h-3a1 1 0 0 1 0-2z',
    },
    {
      id: 'profile' as Page,
      key: 'nav.profile',
      path: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 1 1 16 0H4z',
    },
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
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
          class="flex flex-col items-center gap-0.5 px-2 py-1 rounded-2xl transition-all active:scale-95 {current ===
          item.id
            ? 'text-gold'
            : 'text-white/45'}"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d={item.path} />
          </svg>
          <span class="text-[9px] font-bold">{$t(item.key)}</span>
          {#if current === item.id}
            <span class="w-1 h-1 rounded-full bg-gold" style="box-shadow: 0 0 6px rgba(244,201,93,0.8);"></span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</nav>