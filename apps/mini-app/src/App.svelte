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
  import BottomNav from './components/BottomNav.svelte';
  import Splash from './routes/Splash.svelte';

  type Page = 'home' | 'tables' | 'wallet' | 'profile' | 'table' | 'leaderboard' | 'events';

  let currentPage: Page = 'home';
  let activeTableId = 1;
  let tablesVariant: string = 'all';
  let tablesMode: 'all' | 'free' | 'real' = 'all';
  let tablesKey = 0;

  $: hideBottomNav = currentPage === 'table';

  onMount(async () => {
    await auth.init();
  });

  function navigate(page: Page) {
    currentPage = page;
    window.scrollTo({ top: 0 });
  }

  function openTable(id: number) {
    activeTableId = id;
    currentPage = 'table';
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
    <Home onNavigate={navigate} onQuickSeat={quickSeat} />
  {:else if currentPage === 'tables'}
    {#key tablesKey}
      <Tables initialVariant={tablesVariant} initialMode={tablesMode} onOpenTable={openTable} />
    {/key}
  {:else if currentPage === 'wallet'}
    <Wallet />
  {:else if currentPage === 'profile'}
    <Profile onNavigate={navigate} />
  {:else if currentPage === 'table'}
    <Table tableId={activeTableId} onBack={() => navigate('tables')} />
  {:else if currentPage === 'leaderboard'}
    <Leaderboard />
  {:else if currentPage === 'events'}
    <Events onNavigate={navigate} />
  {/if}

  {#if !hideBottomNav}
    <BottomNav current={currentPage as any} onNavigate={navigate} />
  {/if}
{/if}