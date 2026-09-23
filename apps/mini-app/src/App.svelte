<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from './stores/auth';
  import { initRealtime } from './lib/realtime';
  import { adminRequested } from './stores/admin';
  import { startBroadcastPolling, stopBroadcastPolling } from './lib/broadcasts';
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
  import Admin from './routes/Admin.svelte';
  import MyTournaments from './routes/MyTournaments.svelte';
  import Loyalty from './routes/Loyalty.svelte';
  import RewardsHistory from './routes/RewardsHistory.svelte';
  import SideNav from './components/SideNav.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import ToastStack from './components/ToastStack.svelte';
  import AdminPrompt from './components/AdminPrompt.svelte';
  import Splash from './routes/Splash.svelte';
  import TableSwitcher from './components/TableSwitcher.svelte';
  import TurnAlert from './components/TurnAlert.svelte';

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
    | 'my-tournaments'
    | 'shop'
    | 'notifications'
    | 'settings'
    | 'help'
    | 'admin'
    | 'loyalty'
    | 'rewards-history';

  let currentPage: Page = 'home';
  let activeTableId = 1;
  let activeTournamentId: number | null = null;
  let tableSource: 'cash' | 'tournament' = 'cash';
  let tablesVariant: string = 'all';
  let tablesMode: 'all' | 'free' | 'real' = 'all';
  let tablesKey = 0;

  $: hideNav =
    currentPage === 'table' ||
    currentPage === 'achievements' ||
    currentPage === 'my-tournaments' ||
    currentPage === 'shop' ||
    currentPage === 'notifications' ||
    currentPage === 'settings' ||
    currentPage === 'help' ||
    currentPage === 'admin' ||
    currentPage === 'loyalty' ||
    currentPage === 'rewards-history';

  let splashElapsed = false;
  $: forceSplash = $auth.loading || !splashElapsed;

  onMount(async () => {
    onDestroy(() => {
      stopBroadcastPolling();
    });
    setTimeout(() => {
      splashElapsed = true;
    }, 3000);
    await auth.init();
    const token = localStorage.getItem('token');
    if (token) initRealtime(token);
    if (token) startBroadcastPolling();
    adminRequested.subscribe((v) => {
      if (v) {
        currentPage = 'admin';
        adminRequested.set(false);
        window.scrollTo({ top: 0 });
      }
    });
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

  function switchTable(id: number) {
    activeTableId = id;
    currentPage = 'table';
    window.scrollTo({ top: 0 });
  }

  function goToTablesToAdd() {
    navigate('tables');
  }
</script>

<!-- ============ OUTER BACKGROUND ============ -->
<div class="fixed inset-0 -z-10" style="background: #05080f;">
  <div
    class="absolute inset-0"
    style="
      background-image: url('/bg-pattern.png');
      background-size: 600px auto;
      background-repeat: repeat;
      opacity: 0.35;
    "
  ></div>
  <div
    class="absolute inset-0"
    style="
      background:
        radial-gradient(ellipse at 50% -10%, rgba(30,58,138,0.5) 0%, transparent 55%),
        radial-gradient(ellipse at 50% 110%, rgba(212,175,55,0.12) 0%, transparent 55%),
        linear-gradient(180deg, rgba(7,14,27,0.55) 0%, rgba(5,8,15,0.9) 100%);
    "
  ></div>
</div>

{#if forceSplash}
  <Splash />
{:else if !$auth.user}
  <Login />
{:else}
  <div class="relative flex" style="min-height: 100dvh;">
    {#if !hideNav}
      <SideNav current={currentPage as any} onNavigate={navigate} />
    {/if}

    <main class="flex-1 relative min-w-0" class:with-side={!hideNav} style="min-height: 100dvh;">
      <div
        class="mx-auto w-full"
        style="max-width: {currentPage === 'table' ? '100%' : 'min(520px, 100%)'};"
      >
        {#if currentPage === 'home'}
          <Home onNavigate={navigate} onQuickSeat={quickSeat} />
        {:else if currentPage === 'tables'}
          {#key tablesKey}
            <Tables
              initialVariant={tablesVariant}
              initialMode={tablesMode}
              onOpenTable={openTable}
            />
          {/key}
        {:else if currentPage === 'wallet'}
          <Wallet />
        {:else if currentPage === 'profile'}
          <Profile onNavigate={navigate} />
        {:else if currentPage === 'table'}
          <div class="flex flex-col" style="height: 100dvh;">
            <TableSwitcher
              currentTableId={activeTableId}
              onSwitch={switchTable}
              onAdd={goToTablesToAdd}
            />
            <div class="flex-1 relative min-h-0">
              {#key activeTableId}
                <Table tableId={activeTableId} onBack={backFromTable} />
              {/key}
            </div>
          </div>
        {:else if currentPage === 'leaderboard'}
          <Leaderboard />
        {:else if currentPage === 'events'}
          <Events />
        {:else if currentPage === 'tournaments'}
          <Tournaments onOpenTournament={openTournament} />
        {:else if currentPage === 'tournament-detail' && activeTournamentId !== null}
          <TournamentDetail
            tournamentId={activeTournamentId}
            onBack={() => navigate('tournaments')}
            onOpenTable={openTournamentTable}
          />
        {:else if currentPage === 'loyalty'}
          <Loyalty onBack={() => navigate('profile')} />
        {:else if currentPage === 'rewards-history'}
          <RewardsHistory onBack={() => navigate('profile')} />
        {:else if currentPage === 'achievements'}
          <Achievements onBack={() => navigate('profile')} />
        {:else if currentPage === 'my-tournaments'}
          <MyTournaments onBack={() => navigate('profile')} />
        {:else if currentPage === 'shop'}
          <Shop onBack={() => navigate('profile')} />
        {:else if currentPage === 'notifications'}
          <Notifications onBack={() => navigate('home')} />
        {:else if currentPage === 'settings'}
          <Settings onBack={() => navigate('profile')} />
        {:else if currentPage === 'help'}
          <HelpCenter onBack={() => navigate('profile')} />
        {:else if currentPage === 'admin'}
          <Admin onBack={() => navigate('profile')} />
        {/if}
      </div>
    </main>

    {#if !hideNav}
      <BottomNav current={currentPage as any} onNavigate={navigate} />
    {/if}

    <ToastStack />
  </div>

  <TurnAlert
    currentTableId={currentPage === 'table' ? activeTableId : null}
    onGo={switchTable}
  />
{/if}

<!-- Admin password prompt (global) -->
<AdminPrompt />

<style>
  @media (min-width: 1024px) {
    :global(main.with-side) {
      margin-left: 240px;
    }
  }
  @media (max-width: 1023px) {
    :global(main.with-side) {
      padding-bottom: 90px;
    }
  }
</style>