<script lang="ts">
  import { auth } from '../stores/auth';
  import Avatar from './Avatar.svelte';

  type Page = 'home' | 'tables' | 'tournaments' | 'events' | 'wallet' | 'shop' | 'leaderboard' | 'profile';
  export let current: Page;
  export let onNavigate: (page: Page) => void;

  $: user = $auth.user;
  $: avatarId = (user as any)?.avatar_id || 'king';

  const items = [
    { id: 'home' as Page, label: 'Home', icon: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10.5z' },
    { id: 'tables' as Page, label: 'Cash Games', icon: 'M4 5h16v10a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V5zm0 6h16M8 21l1-2m7 2-1-2' },
    { id: 'tournaments' as Page, label: 'Tournaments', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3' },
    { id: 'events' as Page, label: 'Sit & Go', icon: 'M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07' },
    { id: 'leaderboard' as Page, label: 'Leaderboards', icon: 'M4 20h4v-8H4v8zm6 0h4V4h-4v16zm6 0h4v-12h-4v12z' },
    { id: 'shop' as Page, label: 'Shop', icon: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6zM3 6h18M16 10a4 4 0 0 1-8 0' },
    { id: 'wallet' as Page, label: 'Wallet', icon: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm14 5h3v2h-3a1 1 0 0 1 0-2z' },
    { id: 'profile' as Page, label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 1 1 16 0H4z' },
  ];
</script>

<aside
  class="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 flex-col"
  style="
    width: 240px;
    background: linear-gradient(180deg, rgba(7,14,27,0.98) 0%, rgba(5,8,15,0.98) 100%);
    border-right: 1px solid rgba(212,175,55,0.15);
    backdrop-filter: blur(20px);
  "
>
  <!-- Logo -->
  <div class="px-5 pt-6 pb-5 flex flex-col items-center" style="border-bottom: 1px solid rgba(212,175,55,0.1);">
    <img src="/logo.png" alt="Royal Poker" class="w-14 h-14 object-contain mb-2"
         style="filter: drop-shadow(0 4px 12px rgba(212,175,55,0.5));" />
    <p
      class="text-[14px] font-extrabold tracking-[0.2em]"
      style="
        background: linear-gradient(180deg, #f4e5a8, #d4af37 50%, #a87a15);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      "
    >
      ROYAL POKER
    </p>
    <p class="text-[7px] font-extrabold tracking-[0.4em] text-gold/60 mt-1 uppercase">
      Play · Compete · Win
    </p>
  </div>

  <!-- Nav -->
  <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
    {#each items as item}
      <button
        on:click={() => onNavigate(item.id)}
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
        style="
          background: {current === item.id
            ? 'linear-gradient(90deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))'
            : 'transparent'};
          border: 1px solid {current === item.id ? 'rgba(212,175,55,0.4)' : 'transparent'};
          color: {current === item.id ? '#f4e5a8' : 'rgba(255,255,255,0.55)'};
          {current === item.id ? 'box-shadow: 0 0 16px rgba(212,175,55,0.15);' : ''}
        "
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d={item.icon} />
        </svg>
        <span class="text-[12px] font-bold">{item.label}</span>
        {#if current === item.id}
          <span class="ml-auto w-1.5 h-1.5 rounded-full bg-gold" style="box-shadow: 0 0 6px #d4af37;"></span>
        {/if}
      </button>
    {/each}
  </nav>

  <!-- User footer -->
  <div class="px-3 py-4" style="border-top: 1px solid rgba(212,175,55,0.1);">
    <button
      on:click={() => onNavigate('profile')}
      class="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl"
      style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.2);"
    >
      <Avatar {avatarId} size="md" />
      <div class="flex-1 text-left min-w-0">
        <p class="text-[11px] font-extrabold text-white truncate">{user?.display_name || 'Player'}</p>
        <p class="text-[9px] text-gold/70 font-mono">${Number($auth.wallet?.balance_usd || 0).toFixed(2)}</p>
      </div>
    </button>
  </div>
</aside>