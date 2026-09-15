 <script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PokerTable from '../components/PokerTable.svelte';
  import PlayingCard from '../components/PlayingCard.svelte';
  import { TableSocketIO, type TableState } from '../lib/socket';
  import { auth } from '../stores/auth';
  import { t } from '../i18n';

  export let tableId: number = 1;
  export let onBack: () => void = () => {};

  let socket: TableSocketIO | null = null;
  let gameState: TableState | null = null;
  let connected = false;
  let reconnecting = false;
  let reconnectAttempt = 0;
  let reconnectSynced = false;
  let errorMsg = '';
  let autoActionMsg = '';
  let startingHand = true;
  let showMenu = false;
  let sittingOut = false;
  let handResult: any = null;
  let showSeedModal = false;
  let nowTick = Date.now();

  let raiseAmount = 0;
  let raiseTouched = false;
  let raiseInput = '0.00';
  let raiseInputFocused = false;

  // 🔴 Hand History — last 2 hands with full snapshot
  let handHistory: any[] = [];

  $: myUserId = $auth.user?.id;
  $: mySeat = gameState?.seats?.find((s: any) => s.userId === myUserId) ?? null;
  $: isMyTurn = !!(
    gameState && mySeat &&
    gameState.currentSeat === mySeat.seat &&
    !mySeat.folded && !mySeat.allIn
  );

  $: maxBet = gameState ? Math.max(0, ...gameState.seats.map((s: any) => s.betThisStreet)) : 0;
  $: myBet = mySeat?.betThisStreet ?? 0;
  $: toCall = Math.max(0, maxBet - myBet);
  $: myStack = mySeat?.stack ?? 0;
  $: canCheck = toCall === 0;

  $: minRaiseTo = gameState ? Math.min(maxBet + gameState.minRaise, myStack + myBet) : 0;
  $: hardMax = myStack + myBet;
  $: canRaise = isMyTurn && hardMax > maxBet && hardMax >= minRaiseTo;

  $: timeRemaining = gameState && gameState.turnStartedAt
    ? Math.max(0, (gameState.turnBaseLimit ?? 30) - (nowTick - gameState.turnStartedAt) / 1000)
    : 30;

  $: canUseBank =
    isMyTurn && mySeat &&
    mySeat.timeBankRemaining > 0 &&
    !gameState?.turnBankActive &&
    timeRemaining <= 5;

  $: if (isMyTurn && !raiseTouched) raiseAmount = Math.min(minRaiseTo, hardMax);
  $: if (!isMyTurn) { raiseTouched = false; }
  $: if (raiseAmount < minRaiseTo) raiseAmount = minRaiseTo;
  $: if (raiseAmount > hardMax) raiseAmount = hardMax;

  $: if (!raiseInputFocused) raiseInput = raiseAmount.toFixed(2);

  $: raisePercent = hardMax > minRaiseTo
    ? ((raiseAmount - minRaiseTo) / (hardMax - minRaiseTo)) * 100
    : 100;

  $: myAvatarId = ($auth.user as any)?.avatar_id || 'spade';

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  function connect() {
    const token = localStorage.getItem('token');
    if (!token) { errorMsg = 'no_token'; return; }

    socket = new TableSocketIO(tableId, token);
    socket.on((evt) => {
      if (evt.type === 'connected') {
        connected = true;
        reconnecting = false;
      } else if (evt.type === 'disconnected') {
        connected = false;
        reconnecting = true;
        errorMsg = 'Reconnecting…';
      } else if (evt.type === 'reconnecting') {
        reconnecting = true;
        reconnectAttempt = (evt as any).attempt || 0;
      } else if (evt.type === 'reconnected') {
        reconnecting = false;
        reconnectSynced = true;
        autoActionMsg = '✅ Reconnected';
        setTimeout(() => { autoActionMsg = ''; reconnectSynced = false; }, 2000);
      } else if (evt.type === 'state') {
        gameState = evt.state;
        startingHand = false;
      } else if (evt.type === 'hand_result') {
        handResult = evt.result;
        gameState = evt.state;

        // 🔴 Snapshot for hand history
        try {
          const winners: number[] = evt.result.winners || [];
          const showdownPlayers: any[] = evt.result.showdownPlayers || [];
          const payoutMap: Record<number, number> = {};
          for (const po of (evt.result.payouts || [])) payoutMap[po.seat] = po.amount;

          let winnerSnapshots: any[] = [];
          if (showdownPlayers.length > 0) {
            winnerSnapshots = showdownPlayers
              .filter((p: any) => winners.includes(p.seat))
              .map((p: any) => ({
                displayName: p.displayName,
                cards: (p.best || []).slice(0, 5),
                handName: p.handName,
                payout: payoutMap[p.seat] || 0,
              }));
          } else {
            // Fold win — no showdown players
            winnerSnapshots = winners.map((seatNum: number) => {
              const s = evt.state?.seats?.find((x: any) => x.seat === seatNum);
              return {
                displayName: s?.displayName || `Seat ${seatNum}`,
                cards: [],
                handName: 'All folded',
                payout: payoutMap[seatNum] || 0,
              };
            });
          }

          handHistory = [
            {
              handNo: evt.state?.handNo,
              winners: winnerSnapshots,
              isSplit: winners.length > 1,
            },
            ...handHistory,
          ].slice(0, 2);
        } catch (e) { /* ignore */ }

        setTimeout(() => { handResult = null; }, 7000);
      } else if (evt.type === 'error') {
        errorMsg = evt.message;
        setTimeout(() => { errorMsg = ''; }, 3000);
      }
    });
    socket.connect();
  }

  onMount(() => {
    connect();
    const interval = setInterval(() => { nowTick = Date.now(); }, 500);
    return () => clearInterval(interval);
  });

  onDestroy(() => { if (socket) socket.close(); });

  function doAction(action: 'FOLD' | 'CHECK' | 'CALL', amount = 0) {
    if (!socket || !isMyTurn) return;
    socket.action(action, amount);
  }

  function doRaise() {
    if (!canRaise) return;
    socket?.action('RAISE', Math.floor(raiseAmount * 100) / 100);
  }

  function setRaise(v: number) {
    raiseTouched = true;
    raiseAmount = Math.min(Math.max(v, minRaiseTo), hardMax);
  }

  function commitRaiseInput() {
    raiseInputFocused = false;
    const v = parseFloat(raiseInput);
    if (!isNaN(v) && v > 0) setRaise(v);
    raiseInput = raiseAmount.toFixed(2);
  }

  function handleRaiseKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      raiseInput = raiseAmount.toFixed(2);
      (e.target as HTMLInputElement).blur();
    }
  }

  function quickRaise(mult: number) {
    if (!gameState) return;
    setRaise(maxBet + gameState.bigBlind * mult);
  }

  function potRaise() {
    if (!gameState) return;
    const potTotal = (gameState.pot ?? 0) + maxBet - myBet;
    setRaise(Math.min(potTotal, hardMax));
  }

  function allIn() { setRaise(hardMax); }

  function useTimeBank() {
    if (!socket || !canUseBank) return;
    socket.useTimeBank();
  }

  function toggleMenu() { showMenu = !showMenu; }

  function doSitOut() {
    sittingOut = true;
    showMenu = false;
    autoActionMsg = '💤 Sitting out';
    setTimeout(() => { autoActionMsg = ''; }, 2500);
  }

  function doSitIn() {
    sittingOut = false;
    showMenu = false;
    autoActionMsg = '▶️ Back in action';
    setTimeout(() => { autoActionMsg = ''; }, 2000);
  }

  function leaveTable() {
    showMenu = false;
    if (!confirm('Leave this table?')) return;
    socket?.leaveTable();
    setTimeout(() => onBack(), 200);
  }
</script>

<div class="relative w-full bg-black overflow-hidden" style="height: 100dvh; max-height: 100dvh; padding-bottom: env(safe-area-inset-bottom);">

  <!-- Top bar -->
  <div class="absolute top-0 left-0 right-0 z-40 flex items-start justify-between px-4" style="padding-top: max(16px, env(safe-area-inset-top));">
    <div class="flex items-center gap-2">
      <button on:click={onBack} aria-label="Back" class="w-11 h-11 rounded-full flex items-center justify-center text-white text-xl active:scale-95" style="background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(10px);">←</button>
      <button on:click={toggleMenu} aria-label="Settings" class="w-11 h-11 rounded-full flex items-center justify-center text-white active:scale-95 transition {showMenu ? 'ring-2 ring-amber-400' : ''}" style="background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(10px);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <div class="flex flex-col items-end gap-1">
      <div class="flex items-center gap-2">
        <span class="text-[13px] font-extrabold text-white tracking-wider">LIVE</span>
        <span class="w-3 h-3 rounded-full {connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}"></span>
      </div>
      {#if gameState?.handNo}
        <button on:click={() => showSeedModal = true} class="text-[10px] text-white/60 font-mono underline active:opacity-60">
          Hand #{gameState.handNo} 🔒
        </button>
      {/if}
    </div>
  </div>

  <!-- 🔴 Hand History — هم‌ردیف تنظیمات، ۲ دست آخر با کارت -->
  {#if handHistory.length > 0}
    <div class="absolute z-30 flex gap-1.5 pointer-events-none" style="top: max(72px, calc(env(safe-area-inset-top) + 60px)); left: 16px;">
      {#each handHistory as h, i}
        <div class="rounded-xl p-2 w-[140px]" style="background: rgba(0,0,0,0.88); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); opacity: {1 - i * 0.25};">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[9px] font-mono text-white/50">Hand #{h.handNo}</span>
            {#if h.isSplit}
              <span class="text-[8px] font-bold text-blue-300 px-1 rounded" style="background: rgba(59,130,246,0.2);">SPLIT</span>
            {/if}
          </div>

          {#each h.winners as w}
            <div class="mb-1">
              <div class="flex items-center gap-1 mb-0.5">
                <span class="text-[10px]">🏆</span>
                <span class="text-[10px] font-bold text-amber-400 truncate flex-1">{w.displayName}</span>
              </div>
              {#if w.cards.length > 0}
                <div class="flex gap-0.5 justify-center my-1 flex-wrap">
                  {#each w.cards as c}
                    <div class="scale-[0.5] origin-center -mx-1.5">
                      <PlayingCard rank={c.r} suit={suitChar(c.s)} size="sm" />
                    </div>
                  {/each}
                </div>
              {/if}
              <div class="flex items-center justify-between">
                <span class="text-[9px] font-bold text-white/50">{w.handName}</span>
                {#if w.payout > 0}
                  <span class="text-[9px] font-extrabold text-emerald-400 tabular-nums">+${fmt(w.payout)}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Seed Modal -->
  {#if showSeedModal && gameState}
    <button aria-label="Close" class="fixed inset-0 z-[70] cursor-default" style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);" on:click={() => showSeedModal = false}></button>
    <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] rounded-2xl p-4 w-[90%] max-w-[380px]" style="background: rgba(15,23,42,0.98); border: 1px solid rgba(255,255,255,0.15);">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-extrabold text-white">🔒 Provably Fair</h3>
        <button on:click={() => showSeedModal = false} class="text-white/60 text-xl leading-none">×</button>
      </div>
      <div class="space-y-2 text-[11px] font-mono">
        <div>
          <p class="text-white/40 mb-1">Hand #</p>
          <p class="text-white break-all">{gameState.handNo}</p>
        </div>
        <div>
          <p class="text-white/40 mb-1">Server Seed Hash</p>
          <p class="text-emerald-400 break-all">{gameState.serverSeedHash ?? '—'}</p>
        </div>
        <div>
          <p class="text-white/40 mb-1">Client Seed</p>
          <p class="text-white/80 break-all">{gameState.clientSeed ?? '—'}</p>
        </div>
        <div>
          <p class="text-white/40 mb-1">Nonce</p>
          <p class="text-white/80">{gameState.nonce ?? gameState.handNo}</p>
        </div>
        {#if gameState.revealSeed}
          <div>
            <p class="text-amber-400/80 mb-1">Revealed Server Seed ✓</p>
            <p class="text-amber-300 break-all">{gameState.revealSeed}</p>
          </div>
          <p class="text-emerald-400 text-[10px] mt-2">✅ Verified</p>
        {:else}
          <p class="text-white/40 text-[10px] mt-2">🔒 Seed after hand ends revealed</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Menu -->
  {#if showMenu}
    <button aria-label="Close menu" class="fixed inset-0 z-40 cursor-default" style="background: transparent;" on:click={() => showMenu = false}></button>
    <div class="absolute z-50 rounded-2xl p-2 shadow-2xl" style="top: max(68px, calc(env(safe-area-inset-top) + 60px)); left: 16px; width: 240px; background: rgba(15, 23, 42, 0.98); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(16px);">
      {#if sittingOut}
        <button on:click={doSitIn} class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition" style="background: rgba(16,185,129,0.1);">
          <span class="text-lg">▶️</span>
          <div class="flex-1"><p class="text-sm font-bold text-white">Sit In</p><p class="text-[10px] text-white/50">Resume playing</p></div>
        </button>
      {:else}
        <button on:click={doSitOut} class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition" style="background: rgba(245,158,11,0.1);">
          <span class="text-lg">⏸️</span>
          <div class="flex-1"><p class="text-sm font-bold text-white">Sit Out</p><p class="text-[10px] text-white/50">Auto-fold next hands</p></div>
        </button>
      {/if}
      <div class="my-1 mx-2" style="height: 1px; background: rgba(255,255,255,0.06);"></div>
      <button on:click={leaveTable} class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition" style="background: rgba(220,38,38,0.15);">
        <span class="text-lg">🚪</span>
        <div class="flex-1"><p class="text-sm font-bold text-red-300">Leave Table</p><p class="text-[10px] text-white/50">Return chips</p></div>
      </button>
    </div>
  {/if}

  <PokerTable {gameState} {myUserId} {myAvatarId} theme="cash" {handResult} />

  {#if !gameState || startingHand}
    <div class="absolute top-[80%] left-1/2 -translate-x-1/2 z-20 rounded-2xl px-5 py-3 text-center" style="background: rgba(0,0,0,0.85); border: 1px solid rgba(255,255,255,0.1);">
      <p class="text-sm text-white/70">{$t('table.waitingPlayers')}</p>
      <p class="text-xs text-amber-400 mt-1 font-bold">
        {gameState?.seats?.filter((s: any) => s.stack > 0).length ?? 0} / 2
      </p>
    </div>
  {/if}

  {#if autoActionMsg}
    <div class="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-amber-900/95 rounded-2xl px-4 py-2 border border-amber-700 max-w-[90%]">
      <p class="text-xs font-bold text-amber-100 text-center">{autoActionMsg}</p>
    </div>
  {/if}

  {#if errorMsg}
    <div class="absolute top-32 left-1/2 -translate-x-1/2 z-40 bg-red-900/95 rounded-2xl px-4 py-2 border border-red-700">
      <p class="text-xs font-bold text-red-200">{errorMsg}</p>
    </div>
  {/if}

  <!-- Action Bar -->
  {#if gameState && !startingHand && !handResult}
    <div class="absolute bottom-0 left-0 right-0 z-30" style="padding: 12px 12px calc(16px + env(safe-area-inset-bottom)) 12px; max-width: 480px; margin: 0 auto;">
      {#if isMyTurn && !sittingOut}
        {#if canUseBank}
          <div class="flex justify-center mb-2">
            <button on:click={useTimeBank} class="rounded-full px-4 py-1.5 text-[11px] font-bold text-amber-300 active:scale-95" style="background: rgba(0,0,0,0.85); border: 1px solid rgba(245,158,11,0.5); backdrop-filter: blur(10px);">
              ⏱️ Use Time Bank
            </button>
          </div>
        {/if}

        {#if canRaise}
          <div class="rounded-2xl p-3 mb-3" style="background: rgba(0,0,0,0.88); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px);">
            <div class="flex items-center justify-between mb-3 gap-2">
              <span class="text-[13px] font-extrabold text-white/70 tabular-nums shrink-0">${fmt(minRaiseTo)}</span>
              <div class="flex items-center gap-0.5 flex-1 justify-center">
                <span class="text-[18px] font-extrabold text-amber-400/70">$</span>
                <input
                  type="text"
                  inputmode="decimal"
                  bind:value={raiseInput}
                  on:focus={() => raiseInputFocused = true}
                  on:blur={commitRaiseInput}
                  on:keydown={handleRaiseKey}
                  class="text-[20px] font-extrabold text-amber-400 tabular-nums bg-transparent border-b-2 border-amber-400/40 focus:border-amber-400 text-center outline-none"
                  style="width: 5.5rem;"
                />
              </div>
              <span class="text-[13px] font-extrabold text-white/50 tabular-nums shrink-0">${fmt(hardMax)}</span>
            </div>

            <input
              type="range"
              min={minRaiseTo}
              max={hardMax}
              step="0.01"
              value={raiseAmount}
              on:input={(e) => setRaise(Number((e.target as HTMLInputElement).value))}
              class="w-full raise-slider"
              style="--raise-pct: {raisePercent}%"
            />

            <div class="flex gap-1.5 mt-3">
              <button on:click={() => setRaise(minRaiseTo)} class="flex-1 rounded-lg py-1.5 text-[10px] font-bold text-white/70 active:scale-95" style="background: rgba(255,255,255,0.06);">MIN</button>
              <button on:click={() => quickRaise(2)} class="flex-1 rounded-lg py-1.5 text-[10px] font-bold text-white/70 active:scale-95" style="background: rgba(255,255,255,0.06);">2×</button>
              <button on:click={() => quickRaise(3)} class="flex-1 rounded-lg py-1.5 text-[10px] font-bold text-white/70 active:scale-95" style="background: rgba(255,255,255,0.06);">3×</button>
              <button on:click={potRaise} class="flex-1 rounded-lg py-1.5 text-[10px] font-bold text-amber-400 active:scale-95" style="background: rgba(245,158,11,0.15);">POT</button>
              <button on:click={allIn} class="flex-1 rounded-lg py-1.5 text-[10px] font-bold text-red-300 active:scale-95" style="background: rgba(220,38,38,0.2);">MAX</button>
            </div>
          </div>
        {/if}

        <div class="flex gap-2">
          <button on:click={() => doAction('FOLD')} class="flex-1 rounded-xl py-4 active:scale-[0.97] transition-all" style="background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%); box-shadow: 0 5px 0 #7f1d1d, 0 6px 12px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);">
            <span class="text-[15px] font-extrabold text-white uppercase tracking-wider">{$t('table.fold')}</span>
          </button>

          {#if canCheck}
            <button on:click={() => doAction('CHECK')} class="flex-1 rounded-xl py-4 active:scale-[0.97] transition-all" style="background: linear-gradient(180deg, #3b82f6 0%, #1e40af 100%); box-shadow: 0 5px 0 #1e3a8a, 0 6px 12px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);">
              <span class="text-[15px] font-extrabold text-white uppercase tracking-wider">{$t('table.check')}</span>
            </button>
          {:else}
            <button on:click={() => doAction('CALL')} disabled={myStack === 0} class="flex-1 rounded-xl py-3 active:scale-[0.97] transition-all disabled:opacity-50" style="background: linear-gradient(180deg, #3b82f6 0%, #1e40af 100%); box-shadow: 0 5px 0 #1e3a8a, 0 6px 12px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);">
              <span class="block text-[11px] font-bold text-white/90 leading-none uppercase">{$t('table.call')}</span>
              <span class="block text-[15px] font-extrabold text-white leading-tight tabular-nums mt-0.5">${fmt(toCall)}</span>
            </button>
          {/if}

          {#if canRaise}
            <button on:click={doRaise} class="flex-1 rounded-xl py-3 active:scale-[0.97] transition-all" style="background: linear-gradient(180deg, #fbbf24 0%, #d97706 100%); box-shadow: 0 5px 0 #92400e, 0 6px 12px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.3);">
              <span class="block text-[11px] font-bold text-amber-950 leading-none uppercase">{$t('table.raise')}</span>
              <span class="block text-[15px] font-extrabold text-amber-950 leading-tight tabular-nums mt-0.5">${fmt(raiseAmount)}</span>
            </button>
          {:else if myStack > 0 && myStack <= toCall}
            <button on:click={allIn} class="flex-1 rounded-xl py-4 active:scale-[0.97] transition-all" style="background: linear-gradient(180deg, #ef4444 0%, #991b1b 100%); box-shadow: 0 5px 0 #7f1d1d, 0 6px 12px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);">
              <span class="text-[15px] font-extrabold text-white uppercase tracking-wider">ALL-IN</span>
            </button>
          {/if}
        </div>
      {:else if sittingOut}
        <div class="rounded-2xl p-3 text-center" style="background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); backdrop-filter: blur(10px);">
          <p class="text-xs font-bold text-amber-300">💤 Sitting Out — Auto-folding</p>
          <button on:click={doSitIn} class="mt-2 text-[11px] text-white underline">Resume playing</button>
        </div>
      {:else}
        <div class="rounded-2xl p-3 text-center" style="background: rgba(0,0,0,0.85); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px);">
          <p class="text-xs text-white/60">{$t('table.waitingTurn')}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .raise-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 9999px;
    background: linear-gradient(to right, #dc2626 0%, #dc2626 var(--raise-pct, 50%), rgba(255, 255, 255, 0.12) var(--raise-pct, 50%), rgba(255, 255, 255, 0.12) 100%);
    outline: none;
    cursor: pointer;
  }
  .raise-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffffff;
    border: 2px solid #ffffff;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.8), 0 0 0 3px rgba(220, 38, 38, 0.4);
  }
  .raise-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffffff;
    border: 2px solid #ffffff;
    cursor: pointer;
  }
</style>