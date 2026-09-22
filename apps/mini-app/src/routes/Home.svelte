<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '../stores/auth';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import PlayingCard from '../components/PlayingCard.svelte';
  import PokerChip from '../components/PokerChip.svelte';
  import QuickSeatSheet from '../components/QuickSeatSheet.svelte';

  export let onNavigate: (page: any) => void = () => {};
  export let onQuickSeat: (variant: string, mode: 'free' | 'real') => void = () => {};

  let sheetOpen = false;
  let liveTournaments: any[] = [];
  let tables: any[] = [];

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

  const features = [
    {
      id: 'fast',
      title: 'Fast Payouts',
      sub: 'Get your winnings quickly',
      paths: ['M13 2L4.09 12.97a1 1 0 0 0 .78 1.63H10l-1 7.4 8.91-10.97a1 1 0 0 0-.78-1.63H12l1-7.4z'],
    },
    {
      id: 'global',
      title: 'Global Players',
      sub: 'Play worldwide',
      paths: [
        'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
        'M2 12h20',
        'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
      ],
    },
    {
      id: 'secure',
      title: 'Secure & Fair',
      sub: 'Trusted platform',
      paths: [
        'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
        'M9 12l2 2 4-4',
      ],
    },
  ];

  async function loadData() {
    try {
      const tablesRes = await api.tables();
      if (tablesRes.ok && tablesRes.data) tables = tablesRes.data.tables || [];
      const tourneyRes = await api.listTournaments({ status: 'running' });
      if (tourneyRes.ok && tourneyRes.data) liveTournaments = (tourneyRes.data.tournaments || []).slice(0, 3);
    } catch (e) {}
  }

  onMount(() => { loadData(); });

  function openGame(g: typeof games[0]) {
    if (g.id === 'tourney') { onNavigate('tournaments'); return; }
    onQuickSeat(g.id, 'free');
  }

  function handleConfirm(data: { variant: string; mode: 'free' | 'real' }) {
    sheetOpen = false;
    onQuickSeat(data.variant, data.mode);
  }
</script>

<div class="pb-44 lg:pb-8">
  <!-- TOP BAR -->
  <TopBar onOpenSettings={() => onNavigate('profile')} onOpenWallet={() => onNavigate('wallet')} />

  <!-- ============ HERO ============ -->
  <div
    class="relative mt-3 mb-4 mx-4 rounded-3xl overflow-hidden"
    style="
      border: 1.5px solid rgba(212,175,55,0.4);
      box-shadow: 0 12px 40px rgba(0,0,0,0.7), 0 0 40px rgba(212,175,55,0.2);
      min-height: 280px;
    "
  >
    <img
      src="/hero-character.png"
      alt="Play Poker Win Big"
      class="absolute inset-0 w-full h-full object-cover"
      draggable="false"
    />
    <div class="absolute inset-0" style="background: linear-gradient(180deg, rgba(5,8,15,0.35) 0%, rgba(5,8,15,0.7) 50%, rgba(5,8,15,0.95) 100%);"></div>

    <!-- Content -->
    <div class="relative p-5 pt-6">
      <p
        class="text-[9px] font-extrabold tracking-[0.3em] uppercase mb-2"
        style="color: #e8c45a; text-shadow: 0 2px 8px rgba(0,0,0,0.8);"
      >
        Welcome Back
      </p>
      <h2
        class="text-3xl font-extrabold leading-tight mb-2"
        style="
          background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 60%, #d4af37 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.6));
        "
      >
        Play Poker<br />Win Big
      </h2>
      <p class="text-[11px] text-white/70 mb-5 max-w-[200px] leading-relaxed">
        Real players. Real action.<br />The ultimate poker experience.
      </p>

      <button
        on:click={() => (sheetOpen = true)}
        class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-[13px] active:scale-95 transition-all"
        style="
          background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
          color: #0a0800;
          box-shadow: 0 4px 0 #7a560a, 0 8px 24px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.5);
        "
      >
        <span>Play Now</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14" />
          <path d="M13 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>

  <!-- ============ FEATURES ============ -->
  <div class="grid grid-cols-3 gap-2 px-4 mb-5">
    {#each features as f}
      <div
        class="rounded-2xl p-2.5 flex flex-col items-center text-center"
        style="
          background: linear-gradient(180deg, rgba(15,31,58,0.75), rgba(7,14,27,0.9));
          border: 1px solid rgba(212,175,55,0.2);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        "
      >
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5"
          style="
            background: rgba(212,175,55,0.15);
            border: 1px solid rgba(212,175,55,0.35);
          "
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            {#each f.paths as d}
              <path {d} />
            {/each}
          </svg>
        </div>
        <p class="text-[10px] font-extrabold text-white leading-tight">{f.title}</p>
        <p class="text-[8px] text-white/50 leading-tight mt-0.5">{f.sub}</p>
      </div>
    {/each}
  </div>

  <!-- ============ POPULAR GAMES ============ -->
  <div class="flex items-center justify-between mb-3 px-4">
    <h2 class="text-base font-extrabold text-white">Popular Games</h2>
    <button on:click={() => onNavigate('tables')} class="text-[10px] font-bold text-gold active:opacity-70 flex items-center gap-1">
      <span>See All</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14" />
        <path d="M13 5l7 7-7 7" />
      </svg>
    </button>
  </div>

  <div class="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-4 mb-4">
    {#each games as g}
      <button
        on:click={() => openGame(g)}
        class="shrink-0 rounded-2xl relative overflow-hidden active:scale-[0.97] transition-all text-left"
        style="
          width: 150px;
          background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(5,8,15,0.95));
          border: 1.5px solid rgba(212,175,55,0.3);
          box-shadow: 0 6px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
        "
      >
        <div
          class="relative w-full h-[90px] flex items-center justify-center overflow-hidden"
          style="
            background: radial-gradient(ellipse at 50% 40%, #142d52 0%, #0a1a33 55%, #05080f 100%);
            border-bottom: 1px solid rgba(255,255,255,0.05);
          "
        >
          <div class="absolute inset-0 opacity-20"
               style="background-image: url('/bg-table-pattern.png'); background-size: 200px; background-position: center;"></div>
          <div class="absolute inset-2 rounded-[50%]" style="border: 1px solid rgba(212,175,55,0.35);"></div>

          <div class="flex justify-center -space-x-3 relative z-10">
            {#each g.cards as c}
              <div style="transform: rotate({c.rot}deg); filter: drop-shadow(0 3px 6px rgba(0,0,0,0.7));">
                <PlayingCard rank={c.rank} suit={c.suit} size="xs" />
              </div>
            {/each}
          </div>
        </div>

        <div class="p-2.5">
          <p class="text-[11px] font-extrabold text-white truncate">{g.title}</p>
          <p class="text-[9px] text-white/50 mt-0.5">{g.sub}</p>
        </div>
      </button>
    {/each}
  </div>

  <!-- ============ FREE CHIPS ============ -->
  <div class="px-4 mb-4">
    <button
      on:click={() => onQuickSeat('holdem', 'free')}
      class="w-full rounded-2xl p-3 flex items-center justify-between active:scale-[0.98] transition-all"
      style="
        background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08));
        border: 1.5px solid rgba(16,185,129,0.4);
        box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
      "
    >
      <div class="flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center"
             style="background: rgba(16,185,129,0.25); border: 1px solid rgba(16,185,129,0.5);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="#6ee7b7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 12v10H4V12" />
            <path d="M2 7h20v5H2z" />
            <path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </div>
        <div class="text-left">
          <p class="text-[9px] font-extrabold uppercase tracking-widest" style="color: rgba(110,231,183,0.9);">Free Chips</p>
          <p class="text-lg font-extrabold text-white leading-tight tabular-nums">{chips.toLocaleString()}</p>
        </div>
      </div>
      <div class="text-right flex items-center gap-1" style="color: #6ee7b7;">
        <span class="text-[11px] font-extrabold">Play Free</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14" />
          <path d="M13 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  </div>

  <!-- ============ LIVE TOURNAMENTS ============ -->
  {#if liveTournaments.length > 0}
    <div class="flex items-center justify-between mb-3 px-4">
      <h2 class="text-base font-extrabold text-white flex items-center gap-2">
        Live Tournaments
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
      </h2>
      <button on:click={() => onNavigate('tournaments')} class="text-[10px] font-bold text-gold flex items-center gap-1">
        <span>See All</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14" />
          <path d="M13 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <div class="space-y-2 px-4">
      {#each liveTournaments as t}
        <button
          on:click={() => onNavigate('tournaments')}
          class="w-full text-left rounded-2xl p-3 active:scale-[0.98] transition-all relative overflow-hidden"
          style="
            background: linear-gradient(135deg, rgba(139,92,246,0.18), rgba(109,40,217,0.08));
            border: 1px solid rgba(139,92,246,0.35);
          "
        >
          <div class="flex items-center gap-2 relative">
            <div class="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                 style="border: 1.5px solid rgba(244,201,93,0.5);">
              <img src="/trophy.png" alt="" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-extrabold text-white truncate">{t.name}</p>
              <p class="text-[9px] text-white/50 uppercase">{t.variant} · {t.speed}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums">${Number(t.totalPrizePool || 0).toFixed(0)}</p>
              <p class="text-[9px] text-white/40">prize pool</p>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<QuickSeatSheet bind:open={sheetOpen} freeChips={chips} onClose={() => (sheetOpen = false)} onConfirm={handleConfirm} />