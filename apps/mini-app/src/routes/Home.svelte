<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import PlayingCard from '../components/PlayingCard.svelte';
  import QuickSeatSheet from '../components/QuickSeatSheet.svelte';
  import FreerollBanner from '../components/FreerollBanner.svelte';
  import QuickActions from '../components/QuickActions.svelte';
  import LiveNowGrid from '../components/LiveNowGrid.svelte';
  import RewardsRow from '../components/RewardsRow.svelte';
  import TopWinnersToday from '../components/TopWinnersToday.svelte';
  import UserProgress from '../components/UserProgress.svelte';
  import CommunityBanner from '../components/CommunityBanner.svelte';
  import ReferralTile from '../components/ReferralTile.svelte';
  import BadBeatPool from '../components/BadBeatPool.svelte';
  import Missions from '../components/Missions.svelte';
  import Icon from '../components/Icon.svelte';

  export let onNavigate: (page: any) => void = () => {};
  export let onQuickSeat: (variant: string, mode: 'free' | 'real') => void = () => {};

  let sheetOpen = false;

  // Home data from /api/home
  let livePlayers = 0;
  let activeTables = 0;
  let activeTournaments = 0;
  let topWinners: any[] = [];
  let userProgress: any = null;

  $: chips = Number($auth.freeChips?.chips || 0);

  const games = [
    {
      id: 'holdem',
      title: "Texas Hold'em",
      sub: 'No-Limit',
      cards: [
        { rank: 'A', suit: '♠' as const, rot: -12 },
        { rank: 'K', suit: '♥' as const, rot: 8 },
      ],
    },
    {
      id: 'omaha4',
      title: 'Omaha 4',
      sub: 'Four Hole Cards',
      cards: [
        { rank: 'A', suit: '♦' as const, rot: -14 },
        { rank: 'K', suit: '♠' as const, rot: 6 },
      ],
    },
    {
      id: 'omaha5',
      title: 'Omaha 5',
      sub: 'Five Hole Cards',
      cards: [
        { rank: 'A', suit: '♣' as const, rot: -10 },
        { rank: 'K', suit: '♥' as const, rot: 10 },
      ],
    },
    {
      id: 'tourney',
      title: 'Tournaments',
      sub: 'Big Prize Pools',
      cards: [
        { rank: 'A', suit: '♥' as const, rot: -8 },
        { rank: 'K', suit: '♦' as const, rot: 12 },
      ],
    },
  ];

  async function loadData() {
    try {
      const res = await api.request<{
        onlineUsers: number;
        activeTables: number;
        activeTournaments: number;
        topWinnersToday: any[];
        userProgress: any;
      }>('/api/home');
      if (res.ok && res.data) {
        livePlayers = Number(res.data.onlineUsers) || 0;
        activeTables = Number(res.data.activeTables) || 0;
        activeTournaments = Number(res.data.activeTournaments) || 0;
        topWinners = res.data.topWinnersToday || [];
        userProgress = res.data.userProgress || null;
      }
    } catch {
      // silent — Home still works without live data
    }
  }

  let refreshTimer: any = null;

  onMount(() => {
    loadData();
    refreshTimer = setInterval(loadData, 10_000);
    return () => {
      if (refreshTimer) clearInterval(refreshTimer);
    };
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
</script>

<div class="pb-28 lg:pb-8">
  <!-- TOP BAR -->
  <TopBar onOpenSettings={() => onNavigate('profile')} onOpenWallet={() => onNavigate('wallet')} />

  <!-- ============ FREEROLL BANNER (if active) ============ -->
  <FreerollBanner onOpen={() => onNavigate('tournaments')} />

  <!-- ============ HERO ============ -->
  <div
    class="relative mt-2 mb-4 mx-4 rounded-[20px] overflow-hidden"
    style="
      border: 1px solid rgba(212,175,55,0.4);
      box-shadow: 0 12px 32px rgba(0,0,0,0.65), 0 0 24px rgba(212,175,55,0.14);
      height: 236px;
    "
  >
    <img
      src="/hero-scene.jpg"
      alt="Flop Club"
      class="absolute inset-0 w-full h-full object-cover"
      draggable="false"
    />
    <!-- Left-to-right gradient: darkens LEFT for text readability -->
    <div
      class="absolute inset-0"
      style="background: linear-gradient(90deg, rgba(5,8,15,0.92) 0%, rgba(5,8,15,0.75) 30%, rgba(5,8,15,0.2) 55%, transparent 75%);"
    ></div>
    <!-- Top-to-bottom soft vignette -->
    <div
      class="absolute inset-0"
      style="background: linear-gradient(180deg, rgba(5,8,15,0.5) 0%, transparent 25%, transparent 70%, rgba(5,8,15,0.6) 100%);"
    ></div>

    <!-- Gold hairline accent along the bottom edge -->
    <div
      class="absolute bottom-0 left-0 right-0 h-px"
      style="background: linear-gradient(90deg, transparent, rgba(212,175,55,0.75), transparent);"
    ></div>

    <!-- Live stats pill — top right -->
    <div
      class="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-full z-10"
      style="
        background: rgba(5,8,15,0.75);
        border: 1px solid rgba(16,185,129,0.4);
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      "
    >
      <span
        class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
        style="box-shadow: 0 0 6px #34d399;"
      ></span>
      <span class="text-[11px] font-extrabold text-emerald-300 tabular-nums leading-none">
        {livePlayers}
      </span>
      <span class="text-[8px] text-white/60 font-bold uppercase tracking-wider leading-none"
        >online</span
      >
      <span class="w-px h-3" style="background: rgba(255,255,255,0.2);"></span>
      <span class="text-[11px] font-extrabold text-gold tabular-nums leading-none">
        {activeTables}
      </span>
      <span class="text-[8px] text-white/60 font-bold uppercase tracking-wider leading-none"
        >tables</span
      >
    </div>

    <!-- Content — left-aligned, vertically centered -->
    <div class="relative h-full flex flex-col justify-center p-5">
      <p
        class="text-[9px] font-extrabold tracking-[0.32em] uppercase mb-2"
        style="color: #e8c45a; text-shadow: 0 2px 8px rgba(0,0,0,0.8);"
      >
        Welcome Back
      </p>
      <h2
        class="text-[26px] font-extrabold leading-[1.05] tracking-[-0.02em] mb-2"
        style="
          background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 60%, #d4af37 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.85)) drop-shadow(0 2px 8px rgba(0,0,0,0.6));
        "
      >
        Play Poker<br />Win Big
      </h2>
      <p
        class="text-[11px] text-white/85 mb-4 max-w-[180px] leading-relaxed"
        style="text-shadow: 0 2px 8px rgba(0,0,0,0.9);"
      >
        Real players. Real action.
      </p>

      <div class="flex items-end justify-between gap-3">
        <button
          on:click={() => (sheetOpen = true)}
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-[13px] active:scale-95 transition-all shrink-0"
          style="
            background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
            color: #0a0800;
            box-shadow: 0 4px 0 #7a560a, 0 10px 26px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.55);
          "
        >
          <span>Play Now</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Verified badge — bottom right -->
        <div class="flex items-center gap-2 shrink-0">
          <Icon name="shield" size={14} color="#6ee7b7" />
          <div class="text-right">
            <p
              class="text-[10px] font-extrabold text-emerald-300 leading-none"
              style="text-shadow: 0 2px 6px rgba(0,0,0,0.9);"
            >
              Verified
            </p>
            <p
              class="text-[7px] text-white/55 uppercase tracking-wider font-bold mt-0.5"
              style="text-shadow: 0 1px 4px rgba(0,0,0,0.9);"
            >
              Provably Fair
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ============ COMMUNITY BANNER ============ -->
  <CommunityBanner />

  <!-- ============ QUICK ACTIONS ============ -->
  <QuickActions
    onDeposit={() => onNavigate('wallet')}
    onShop={() => onNavigate('shop')}
    onLeaderboard={() => onNavigate('leaderboard')}
  />

  <!-- ============ REFERRAL TILE ============ -->
  <ReferralTile onOpen={() => onNavigate('referral')} />

  <!-- ============ POPULAR GAMES ============ -->
  <div class="sec-head">
    <h2 class="sec-title">Popular Games</h2>
    <button on:click={() => onNavigate('tables')} class="sec-link">
      <span>See All</span>
      <Icon name="arrow-right" size={10} />
    </button>
  </div>

  <div class="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-4 mb-5 snap-x snap-mandatory">
    {#each games as g}
      <button
        on:click={() => openGame(g)}
        class="surface-card shrink-0 relative overflow-hidden transition-transform text-left snap-start"
        style="width: 132px;"
      >
        <div
          class="relative w-full h-[88px] flex items-center justify-center overflow-hidden felt-preview"
        >
          <div
            class="absolute inset-0 opacity-20"
            style="background-image: url('/bg-table-pattern.webp'); background-size: 180px; background-position: center;"
          ></div>
          <div
            class="absolute inset-2 rounded-[50%]"
            style="border: 1px solid rgba(212,175,55,0.32);"
          ></div>

          <div class="flex justify-center -space-x-3 relative z-10">
            {#each g.cards as c}
              <div
                style="transform: rotate({c.rot}deg); filter: drop-shadow(0 3px 6px rgba(0,0,0,0.75));"
              >
                <PlayingCard rank={c.rank} suit={c.suit} size="xs" />
              </div>
            {/each}
          </div>
        </div>

        <div class="px-2.5 py-2">
          <p class="text-[11px] font-extrabold text-white truncate leading-tight">{g.title}</p>
          <p class="text-[9px] text-white/45 mt-0.5 truncate leading-tight">{g.sub}</p>
        </div>
      </button>
    {/each}
  </div>

  <!-- ============ LIVE NOW (cash tables + tournaments) ============ -->
  <LiveNowGrid
    {activeTables}
    {activeTournaments}
    onTables={() => onNavigate('tables')}
    onTournaments={() => onNavigate('tournaments')}
  />

  <!-- ============ REWARDS ROW (Free Chips + Daily Bonus) ============ -->
  <RewardsRow onPlayFree={() => onQuickSeat('holdem', 'free')} />

  <!-- ============ TOP WINNERS TODAY ============ -->
  <TopWinnersToday winners={topWinners} onSeeAll={() => onNavigate('leaderboard')} />

  <!-- ============ BAD BEAT JACKPOT ============ -->
  <BadBeatPool />

  <!-- ============ DAILY MISSIONS ============ -->
  <Missions onSeeAll={() => onNavigate('missions')} />

  <!-- ============ USER PROGRESS (Level + Tier + Money) ============ -->
  <UserProgress
    progress={userProgress}
    onOpen={() => onNavigate('loyalty')}
    onOpenMoney={() => onNavigate('my-money')}
  />
</div>

<QuickSeatSheet
  bind:open={sheetOpen}
  freeChips={chips}
  onClose={() => (sheetOpen = false)}
  onConfirm={handleConfirm}
/>
