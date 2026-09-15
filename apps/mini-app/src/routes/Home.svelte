<script lang="ts">
  import { auth } from '../stores/auth';
  import { t } from '../i18n';
  import TopBar from '../components/TopBar.svelte';
  import PlayingCard from '../components/PlayingCard.svelte';
  import QuickSeatSheet from '../components/QuickSeatSheet.svelte';

  export let onNavigate: (page: any) => void = () => {};
  export let onQuickSeat: (variant: string, mode: 'free' | 'real') => void = () => {};

  let sheetOpen = false;

  $: chips = Number($auth.freeChips?.chips || 0);

  const games = [
    {
      id: 'holdem',
      titleKey: 'games.holdem',
      subKey: 'games.holdemSub',
      emoji: '♠️',
      gradient: 'from-blue-900 via-blue-800 to-blue-950',
      cards: [
        { rank: 'A', suit: '♠' as const, rot: -12 },
        { rank: 'K', suit: '♥' as const, rot: 8 },
      ],
    },
    {
      id: 'omaha4',
      titleKey: 'games.omaha4',
      subKey: 'games.omaha4Sub',
      emoji: '♦️',
      gradient: 'from-red-900 via-red-800 to-red-950',
      cards: [
        { rank: 'A', suit: '♦' as const, rot: -15 },
        { rank: 'K', suit: '♥' as const, rot: -5 },
        { rank: 'Q', suit: '♠' as const, rot: 5 },
        { rank: 'J', suit: '♦' as const, rot: 15 },
      ],
    },
    {
      id: 'omaha5',
      titleKey: 'games.omaha5',
      subKey: 'games.omaha5Sub',
      emoji: '♣️',
      gradient: 'from-emerald-900 via-emerald-800 to-emerald-950',
      cards: [
        { rank: 'A', suit: '♣' as const, rot: -18 },
        { rank: 'K', suit: '♥' as const, rot: -9 },
        { rank: 'Q', suit: '♣' as const, rot: 0 },
        { rank: 'J', suit: '♠' as const, rot: 9 },
        { rank: 'T', suit: '♦' as const, rot: 18 },
      ],
    },
    {
      id: 'tourney',
      titleKey: 'games.tourney',
      subKey: 'games.tourneySub',
      emoji: '🏆',
      gradient: 'from-purple-900 via-indigo-800 to-purple-950',
      cards: [],
    },
  ];

  function openGame(g: (typeof games)[0]) {
    if (g.id === 'tourney') {
      onNavigate('events');
      return;
    }
    onQuickSeat(g.id, 'free');
  }

  function handleConfirm(data: { variant: string; mode: 'free' | 'real' }) {
    sheetOpen = false;
    onQuickSeat(data.variant, data.mode);
  }
</script>

<div class="px-4 pb-24">
  <TopBar onOpenSettings={() => onNavigate('profile')} onOpenWallet={() => onNavigate('wallet')} />

  <button
    on:click={() => onQuickSeat('holdem', 'free')}
    class="w-full mt-3 mb-3 rounded-2xl p-3 flex items-center justify-between bg-gradient-to-r from-emerald-700/60 to-emerald-900/60 border border-emerald-600/30 active:scale-[0.98] transition"
  >
    <div class="flex items-center gap-2">
      <span class="text-2xl">🎁</span>
      <div class="text-left">
        <p class="text-xs text-emerald-200/80 font-semibold uppercase tracking-wider">
          {$t('home.freeChips')}
        </p>
        <p class="text-xl font-extrabold text-white leading-tight">{chips.toLocaleString()}</p>
      </div>
    </div>
    <div class="text-right">
      <p class="text-xs font-bold text-emerald-200">{$t('home.playFree')}</p>
      <p class="text-[10px] text-white/50">{$t('home.noRisk')}</p>
    </div>
  </button>

  <div class="relative mb-6 rounded-3xl overflow-hidden shadow-card">
    <div class="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-950 to-black"></div>
    <div class="absolute top-4 right-6 flex gap-1 opacity-80">
      <div
        class="w-8 h-11 bg-white rounded text-black text-xs flex items-center justify-center font-bold rotate-[-12deg]"
      >
        A♠
      </div>
      <div
        class="w-8 h-11 bg-red-600 rounded text-white text-xs flex items-center justify-center font-bold rotate-[8deg]"
      >
        A♥
      </div>
    </div>
    <div class="relative p-6 pb-6">
      <p class="text-xs uppercase tracking-widest text-gold/70 font-semibold mb-1">
        {$t('home.instantPlay')}
      </p>
      <h2 class="text-2xl font-extrabold mb-4">{$t('home.jumpIntoGame')}</h2>
      <button
        on:click={() => (sheetOpen = true)}
        class="w-full btn-gold flex items-center justify-center gap-2"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
          ><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg
        >
        <span>{$t('home.quickSeat')}</span>
      </button>
    </div>
  </div>

  <h2 class="text-lg font-bold mb-3 px-1">{$t('home.games')}</h2>
  <div class="grid grid-cols-2 gap-3">
    {#each games as g}
      <button
        on:click={() => openGame(g)}
        class="game-card bg-gradient-to-br {g.gradient} text-left"
      >
        <div class="flex flex-col justify-between h-full min-h-[110px]">
          <div class="flex justify-between items-start">
            <span class="text-2xl">{g.emoji}</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              class="text-gold"><path d="M9 6l6 6-6 6" /></svg
            >
          </div>
          {#if g.cards.length > 0}
            <div class="absolute top-3 right-3 flex -space-x-2">
              {#each g.cards.slice(0, 3) as c, i}
                <div style="z-index: {10 - i};">
                  <PlayingCard rank={c.rank} suit={c.suit} rotation={c.rot} size="sm" />
                </div>
              {/each}
            </div>
          {/if}
          <div class="mt-6">
            <p class="font-bold text-base leading-tight">{$t(g.titleKey)}</p>
            <p class="text-[11px] text-white/60 mt-0.5">{$t(g.subKey)}</p>
          </div>
        </div>
      </button>
    {/each}
  </div>

  <h2 class="text-lg font-bold mt-6 mb-3 px-1">{$t('home.topPlayers')}</h2>
  <button
    on:click={() => onNavigate('leaderboard')}
    class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
  >
    <span class="text-3xl">🏅</span>
    <div class="flex-1 text-left">
      <p class="font-bold text-sm">{$t('leaderboard.title')}</p>
      <p class="text-xs text-white/50">{$t('home.prizesTop30')}</p>
    </div>
    <span class="text-gold">→</span>
  </button>

  <button
    on:click={() => onNavigate('events')}
    class="card w-full flex items-center gap-3 mt-3 active:scale-[0.98] transition"
  >
    <span class="text-3xl">🎫</span>
    <div class="flex-1 text-left">
      <p class="font-bold text-sm">{$t('events.title')}</p>
      <p class="text-xs text-white/50">{$t('games.tourneySub')}</p>
    </div>
    <span class="text-gold">→</span>
  </button>
</div>

<QuickSeatSheet
  bind:open={sheetOpen}
  freeChips={chips}
  onClose={() => (sheetOpen = false)}
  onConfirm={handleConfirm}
/>
