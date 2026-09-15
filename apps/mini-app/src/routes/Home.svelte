<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '../stores/auth';
  import { t } from '../i18n';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import PlayingCard from '../components/PlayingCard.svelte';
  import QuickSeatSheet from '../components/QuickSeatSheet.svelte';
  import TablePreviewCard from '../components/TablePreviewCard.svelte';

  export let onNavigate: (page: any) => void = () => {};
  export let onQuickSeat: (variant: string, mode: 'free' | 'real') => void = () => {};
  export let onOpenTable: (id: number) => void = () => {};

  let sheetOpen = false;
  let tables: any[] = [];
  let featuredTables: any[] = [];
  let liveTournaments: any[] = [];

  $: chips = Number($auth.freeChips?.chips || 0);

  const games = [
    {
      id: 'holdem',
      titleKey: 'games.holdem',
      subKey: 'games.holdemSub',
      emoji: '♠️',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #0c1a3a 100%)',
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
      gradient: 'linear-gradient(135deg, #7f1d1d 0%, #3b0a0a 100%)',
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
      gradient: 'linear-gradient(135deg, #14532d 0%, #062a14 100%)',
      cards: [
        { rank: 'A', suit: '♣' as const, rot: -18 },
        { rank: 'K', suit: '♥' as const, rot: -9 },
        { rank: 'Q', suit: '♣' as const, rot: 0 },
        { rank: 'J', suit: '♠' as const, rot: 9 },
      ],
    },
    {
      id: 'tourney',
      titleKey: 'games.tourney',
      subKey: 'games.tourneySub',
      emoji: '🏆',
      gradient: 'linear-gradient(135deg, #6d28d9 0%, #2d1060 100%)',
      cards: [],
    },
  ];

  async function loadData() {
    try {
      // Load tables
      const tablesRes = await api.tables();
      if (tablesRes.ok && tablesRes.data) {
        tables = tablesRes.data.tables || [];
        featuredTables = tables.slice(0, 5);
      }

      // Load live tournaments
      const tourneyRes = await api.listTournaments({ status: 'running' });
      if (tourneyRes.ok && tourneyRes.data) {
        liveTournaments = (tourneyRes.data.tournaments || []).slice(0, 3);
      }
    } catch (e) {
      // silent
    }
  }

  onMount(() => {
    loadData();
  });

  function openGame(g: (typeof games)[0]) {
    if (g.id === 'tourney') {
      onNavigate('tournaments');
      return;
    }
    onQuickSeat(g.id, 'free');
  }

  function handleConfirm(data: { variant: string; mode: 'free' | 'real' }) {
    sheetOpen = false;
    onQuickSeat(data.variant, data.mode);
  }

  function fmtTime(iso: string | null): string {
    if (!iso) return '—';
    try {
      const diff = new Date(iso).getTime() - Date.now();
      if (diff < 0) return 'Live';
      const min = Math.floor(diff / 60000);
      if (min < 60) return `in ${min}m`;
      const h = Math.floor(min / 60);
      return `in ${h}h`;
    } catch {
      return '—';
    }
  }
</script>

<div class="px-4 pb-24">
  <TopBar onOpenSettings={() => onNavigate('profile')} onOpenWallet={() => onNavigate('wallet')} />

  <!-- Free Chips banner -->
  <button
    on:click={() => onQuickSeat('holdem', 'free')}
    class="w-full mt-3 mb-3 rounded-2xl p-3 flex items-center justify-between active:scale-[0.98] transition"
    style="background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.08)); border: 1px solid rgba(34,197,94,0.35);"
  >
    <div class="flex items-center gap-2.5">
      <div
        class="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
        style="background: rgba(0,0,0,0.35);"
      >
        🎁
      </div>
      <div class="text-left">
        <p class="text-[10px] text-emerald-200/80 font-bold uppercase tracking-wider">
          {$t('home.freeChips')}
        </p>
        <p class="text-xl font-extrabold text-white leading-tight tabular-nums">
          {chips.toLocaleString()}
        </p>
      </div>
    </div>
    <div class="text-right">
      <p class="text-xs font-bold text-emerald-300">{$t('home.playFree')}</p>
      <p class="text-[10px] text-white/50">{$t('home.noRisk')}</p>
    </div>
  </button>

  <!-- Hero / Quick Seat -->
  <div
    class="relative mb-4 rounded-3xl overflow-hidden"
    style="border: 1px solid rgba(139,92,246,0.25); box-shadow: 0 8px 30px rgba(0,0,0,0.5);"
  >
    <div
      class="absolute inset-0"
      style="background: radial-gradient(ellipse at 50% 40%, #1a5c3a 0%, #0d3d24 55%, #051d12 100%);"
    ></div>
    <div
      class="absolute inset-0"
      style="background: radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.35), transparent 60%);"
    ></div>

    <div class="absolute top-4 right-5 flex gap-1 opacity-90">
      <div class="rotate-[-12deg]">
        <PlayingCard rank="A" suit="♠" size="sm" />
      </div>
      <div class="rotate-[8deg]">
        <PlayingCard rank="A" suit="♥" size="sm" />
      </div>
    </div>

    <div class="relative p-5 pb-4">
      <p class="text-[10px] uppercase tracking-[0.25em] text-gold/80 font-bold mb-1">
        {$t('home.instantPlay')}
      </p>
      <h2 class="text-2xl font-extrabold mb-4 text-white">
        {$t('home.jumpIntoGame')}
      </h2>
      <button
        on:click={() => (sheetOpen = true)}
        class="w-full btn-gold flex items-center justify-center gap-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
        <span class="text-sm font-extrabold tracking-wide">{$t('home.quickSeat')}</span>
      </button>
    </div>
  </div>

  <!-- LIVE STATS -->
  <div class="grid grid-cols-3 gap-2 mb-4">
    <div class="card !p-2.5 text-center">
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Online</p>
      <p class="text-lg font-extrabold text-emerald-400 tabular-nums">
        {liveTournaments.length * 12 + 47}
      </p>
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block mt-0.5"
      ></span>
    </div>
    <div class="card !p-2.5 text-center">
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Tables</p>
      <p class="text-lg font-extrabold text-gold tabular-nums">
        {tables.length}
      </p>
      <p class="text-[8px] text-white/40">active</p>
    </div>
    <div class="card !p-2.5 text-center">
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Tourneys</p>
      <p class="text-lg font-extrabold text-violet tabular-nums">
        {liveTournaments.length}
      </p>
      <p class="text-[8px] text-white/40">running</p>
    </div>
  </div>

  <!-- Games grid -->
  <h2 class="text-base font-extrabold mb-3 px-1 text-white/90">
    {$t('home.games')}
  </h2>
  <div class="grid grid-cols-2 gap-3 mb-4">
    {#each games as g}
      <button
        on:click={() => openGame(g)}
        class="game-card text-left"
        style="background: {g.gradient};"
      >
        <div class="flex flex-col justify-between h-full min-h-[120px]">
          <div class="flex justify-between items-start">
            <span class="text-2xl">{g.emoji}</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              class="text-gold"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>

          {#if g.cards.length > 0}
            <div class="flex -space-x-3 justify-center my-1">
              {#each g.cards.slice(0, 3) as c, i}
                <div style="z-index: {10 - i};">
                  <PlayingCard rank={c.rank} suit={c.suit} rotation={c.rot} size="sm" />
                </div>
              {/each}
            </div>
          {/if}

          <div class="mt-2">
            <p class="font-extrabold text-sm leading-tight text-white">
              {$t(g.titleKey)}
            </p>
            <p class="text-[10px] text-white/60 mt-0.5">{$t(g.subKey)}</p>
          </div>
        </div>
      </button>
    {/each}
  </div>

  <!-- FEATURED TABLES -->
  {#if featuredTables.length > 0}
    <div class="flex items-center justify-between mb-3 px-1">
      <h2 class="text-base font-extrabold text-white/90">Featured Tables</h2>
      <button
        on:click={() => onNavigate('tables')}
        class="text-[10px] font-bold text-gold active:opacity-70"
      >
        See all →
      </button>
    </div>
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4 -mx-4 px-4">
      {#each featuredTables as table}
        <TablePreviewCard {table} onClick={() => onOpenTable(table.id)} />
      {/each}
    </div>
  {/if}

  <!-- LIVE TOURNAMENTS -->
  {#if liveTournaments.length > 0}
    <div class="flex items-center justify-between mb-3 px-1">
      <h2 class="text-base font-extrabold text-white/90 flex items-center gap-2">
        Live Tournaments
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
      </h2>
      <button
        on:click={() => onNavigate('tournaments')}
        class="text-[10px] font-bold text-gold active:opacity-70"
      >
        See all →
      </button>
    </div>
    <div class="space-y-2 mb-4">
      {#each liveTournaments as t}
        <button
          on:click={() => onNavigate('tournaments')}
          class="w-full text-left rounded-2xl p-3 active:scale-[0.98] transition"
          style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(109,40,217,0.05)); border: 1px solid rgba(139,92,246,0.3);"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-0.5">
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                  style="background: rgba(16,185,129,0.25); color: #10b981;"
                >
                  LIVE
                </span>
                <span class="text-[9px] text-white/50">
                  {t.variant?.toUpperCase()} · {t.speed}
                </span>
              </div>
              <p class="text-sm font-extrabold text-white truncate">{t.name}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-[11px] font-bold text-emerald-400 tabular-nums">
                ${Number(t.totalPrizePool || 0).toFixed(2)}
              </p>
              <p class="text-[9px] text-white/40">prize pool</p>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <!-- QUICK ACTIONS -->
  <h2 class="text-base font-extrabold mt-4 mb-3 px-1 text-white/90">Quick Actions</h2>
  <div class="space-y-2">
    <button
      on:click={() => onNavigate('leaderboard')}
      class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style="background: linear-gradient(135deg, rgba(244,201,93,0.25), rgba(168,121,34,0.15));"
      >
        🏅
      </div>
      <div class="flex-1 text-left">
        <p class="font-bold text-sm text-white">{$t('leaderboard.title')}</p>
        <p class="text-[10px] text-white/50">{$t('home.prizesTop30')}</p>
      </div>
      <span class="text-gold">→</span>
    </button>

    <button
      on:click={() => onNavigate('tournaments')}
      class="card w-full flex items-center gap-3 active:scale-[0.98] transition"
    >
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style="background: linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.15));"
      >
        🏆
      </div>
      <div class="flex-1 text-left">
        <p class="font-bold text-sm text-white">{$t('events.title')}</p>
        <p class="text-[10px] text-white/50">{$t('games.tourneySub')}</p>
      </div>
      <span class="text-gold">→</span>
    </button>
  </div>
</div>

<QuickSeatSheet
  bind:open={sheetOpen}
  freeChips={chips}
  onClose={() => (sheetOpen = false)}
  onConfirm={handleConfirm}
/>
