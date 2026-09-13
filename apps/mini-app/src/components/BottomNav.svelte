<script lang="ts">
  import { t } from '../i18n';

  type Page = 'home' | 'tables' | 'wallet' | 'profile' | 'leaderboard' | 'events' | 'table';

  export let current: Page;
  export let onNavigate: (page: Page) => void;

  const items = [
    { id: 'home' as Page, key: 'nav.home', path: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10.5z' },
    { id: 'tables' as Page, key: 'nav.tables', path: 'M4 5h16v10a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V5zm0 6h16M8 21l1-2m7 2-1-2' },
    { id: 'leaderboard' as Page, key: 'nav.leaderboard', path: 'M8 21V10M12 21V3M16 21V14' },
    { id: 'wallet' as Page, key: 'nav.wallet', path: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm14 5h3v2h-3a1 1 0 0 1 0-2z' },
    { id: 'profile' as Page, key: 'nav.profile', path: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 1 1 16 0H4z' },
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 z-40">
  <div class="max-w-[480px] mx-auto px-4 pb-3 pt-2">
    <div class="glass-strong rounded-3xl flex items-center justify-around py-2 shadow-card">
      {#each items as item}
        <button
          on:click={() => onNavigate(item.id)}
          class="flex flex-col items-center gap-1 px-2 py-1 rounded-2xl transition {current === item.id ? 'text-gold' : 'text-white/50'}"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d={item.path} />
          </svg>
          <span class="text-[9px] font-semibold">{$t(item.key)}</span>
          {#if current === item.id}
            <span class="w-5 h-0.5 bg-gold rounded-full"></span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</nav>