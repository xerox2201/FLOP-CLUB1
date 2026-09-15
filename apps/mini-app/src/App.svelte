<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from './stores/auth';
  import Login from './routes/Login.svelte';
  import Home from './routes/Home.svelte';
  import Tables from './routes/Tables.svelte';
  import Wallet from './routes/Wallet.svelte';
  import Profile from './routes/Profile.svelte';
  import Table from './routes/Table.svelte';
  import Leaderboard from './routes/Leaderboard.svelte';
  import Events from './routes/Events.svelte';
  import Tournaments from './routes/Tournaments.svelte';
  import TournamentDetail from './routes/TournamentDetail.svelte';
  import Achievements from './routes/Achievements.svelte';
  import Shop from './routes/Shop.svelte';
  import Notifications from './routes/Notifications.svelte';
  import Settings from './routes/Settings.svelte';
  import HelpCenter from './routes/HelpCenter.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import Splash from './routes/Splash.svelte';

  type Page =
    | 'home'
    | 'tables'
    | 'wallet'
    | 'profile'
    | 'table'
    | 'leaderboard'
    | 'events'
    | 'tournaments'
    | 'tournament-detail'
    | 'achievements'
    | 'shop'
    | 'notifications'
    | 'settings'
    | 'help';

  let currentPage: Page = 'home';
  let activeTableId = 1;
  let activeTournamentId: number | null = null;
  let tableSource: 'cash' | 'tournament' = 'cash';
  let tablesVariant: string = 'all';
  let tablesMode: 'all' | 'free' | 'real' = 'all';
  let tablesKey = 0;

  $: hideBottomNav =
    currentPage === 'table' ||
    currentPage === 'tournament-detail' ||
    currentPage === 'achievements' ||
    currentPage === 'shop' ||
    currentPage === 'notifications' ||
    currentPage === 'settings' ||
    currentPage === 'help';

  onMount(async () => {
    await auth.init();
  });

  function navigate(page: Page) {
    currentPage = page;
    window.scrollTo({ top: 0 });
  }

  function openTable(id: number) {
    activeTableId = id;
    tableSource = 'cash';
    currentPage = 'table';
    window.scrollTo({ top: 0 });
  }

  function openTournamentTable(tournamentId: number, virtualTableId: number) {
    activeTournamentId = tournamentId;
    activeTableId = virtualTableId;
    tableSource = 'tournament';
    currentPage = 'table';
    window.scrollTo({ top: 0 });
  }

  function openTournament(id: number) {
    activeTournamentId = id;
    currentPage = 'tournament-detail';
    window.scrollTo({ top: 0 });
  }

  function backFromTable() {
    if (tableSource === 'tournament' && activeTournamentId) {
      currentPage = 'tournament-detail';
    } else {
      navigate('tables');
    }
  }

  function quickSeat(variant: string, mode: 'free' | 'real') {
    tablesVariant = variant;
    tablesMode = mode;
    tablesKey++;
    currentPage = 'tables';
    window.scrollTo({ top: 0 });
  }
</script>

{#if $auth.loading}
  <Splash />
{:else if !$auth.user}
  <Login />
{:else}
  {#if currentPage === 'home'}
    <Home onNavigate={navigate} onQuickSeat={quickSeat} onOpenTable={openTable} />
  {:else if currentPage === 'tables'}
    {#key tablesKey}
      <Tables initialVariant={tablesVariant} initialMode={tablesMode} onOpenTable={openTable} />
    {/key}
  {:else if currentPage === 'wallet'}
    <Wallet />
  {:else if currentPage === 'profile'}
    <Profile onNavigate={navigate} />
  {:else if currentPage === 'table'}
    <Table tableId={activeTableId} onBack={backFromTable} />
  {:else if currentPage === 'leaderboard'}
    <Leaderboard />
  {:else if currentPage === 'events'}
    <Events onNavigate={navigate} />
  {:else if currentPage === 'tournaments'}
    <Tournaments onOpenTournament={openTournament} />
  {:else if currentPage === 'tournament-detail' && activeTournamentId !== null}
    <TournamentDetail
      tournamentId={activeTournamentId}
      onBack={() => navigate('tournaments')}
      onOpenTable={openTournamentTable}
    />
  {:else if currentPage === 'achievements'}
    <Achievements onBack={() => navigate('profile')} />
  {:else if currentPage === 'shop'}
    <Shop onBack={() => navigate('profile')} />
  {:else if currentPage === 'notifications'}
    <Notifications onBack={() => navigate('home')} />
  {:else if currentPage === 'settings'}
    <Settings onBack={() => navigate('profile')} />
  {:else if currentPage === 'help'}
    <HelpCenter onBack={() => navigate('profile')} />
  {/if}

  {#if !hideBottomNav}
    <BottomNav current={currentPage as any} onNavigate={navigate} />
  {/if}
{/if}
