<script lang="ts">
  import { formatAmount } from '../lib/format';
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import PokerTable from '../components/PokerTable.svelte';
  import PokerTableMobile from '../components/poker/PokerTableMobile.svelte';
  import PlayingCard from '../components/PlayingCard.svelte';
  import HandHistoryModal from '../components/HandHistoryModal.svelte';
  import HandReplayModal from '../components/HandReplayModal.svelte';
  import PlayerInfoModal from '../components/PlayerInfoModal.svelte';
  import ChatModal from '../components/ChatModal.svelte';
  import Icon from '../components/Icon.svelte';
  import { auth } from '../stores/auth';
  import { t } from '../i18n';
  import { playSound } from '../lib/sounds';
  import { haptic } from '../lib/haptics';
  import { preferences } from '../lib/preferences';
  import { activeTables } from '../lib/activeTables';

  export let tableId: number = 1;
  export let onBack: () => void = () => {};

  // ===== Layout detection =====
  type LayoutMode = 'mobile-portrait' | 'mobile-landscape' | 'desktop';
  let layoutMode: LayoutMode = 'desktop';

  function updateLayout() {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (w < 768 && h > w) {
      layoutMode = 'mobile-portrait';
    } else if (h < 520 && w > h) {
      layoutMode = 'mobile-landscape';
    } else {
      layoutMode = 'desktop';
    }
  }

  // ===== Multi-table store binding =====
  $: entry = $activeTables.get(tableId) ?? null;
  $: socket = entry?.socket ?? null;
  $: gameState = entry?.state ?? null;
  $: handResult = entry?.handResult ?? null;
  $: connected = entry?.connected ?? false;
  $: reconnecting = entry?.reconnecting ?? false;

  let errorMsg = '';
  let autoActionMsg = '';
  let showMenu = false;
  let showHandHistory = false;
  let showReplay = false;
  let replayHandId: number | null = null;
  let sittingOut = false;
  let showSeedModal = false;
  let nowTick = Date.now();

  let lastSoundHandNo = -1;
  let lastSoundCommunityCount = 0;
  let lastSoundWinnersKey = '';
  let lastErrorAt = 0;
  let wasReconnecting = false;

  let selectedPlayer: any = null;
  let showPlayerInfo = false;
  let showChat = false;

  let raiseAmount = 0;
  let raiseTouched = false;
  let raiseInput = '0.00';
  let raiseInputFocused = false;
  let showRaisePanel = false;
  let sliderRef: HTMLDivElement;
  let dragging = false;
  let editingCustom = false;
  let customInput = '';

  $: betSliderEnabled = $preferences.betSlider;

  function handleSliderPointer(clientY: number) {
    if (!sliderRef) return;
    const rect = sliderRef.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = 1 - Math.max(0, Math.min(1, y / rect.height));
    setRaise(minRaiseTo + pct * (hardMax - minRaiseTo));
  }

  $: potIfCall = (gameState?.pot ?? 0) + maxBet - myBet;
  $: isAllIn = hardMax > 0 && raiseAmount >= hardMax - 0.01;
  $: presets = [
    { label: '1/3', value: Math.min(maxBet + potIfCall / 3, hardMax) },
    { label: '1/2', value: Math.min(maxBet + potIfCall / 2, hardMax) },
    { label: '2/3', value: Math.min(maxBet + (potIfCall * 2) / 3, hardMax) },
    { label: 'POT', value: Math.min(maxBet + potIfCall, hardMax) },
  ];

  type PreActionKey = 'check_fold' | 'check' | 'call_any' | 'fold';
  type PreAction = PreActionKey | null;
  let preAction: PreAction = null;
  let lastFireKey: string | null = null;
  let lastEndedHandNo = -1;

  $: myUserId = $auth.user?.id;
  $: mySeat = gameState?.seats?.find((s: any) => Number(s.userId) === Number(myUserId)) ?? null;
  $: isMyTurn = !!(
    gameState &&
    mySeat &&
    gameState.currentSeat === mySeat.seat &&
    !mySeat.folded &&
    !mySeat.allIn
  );

  $: maxBet = gameState ? Math.max(0, ...gameState.seats.map((s: any) => s.betThisStreet)) : 0;
  $: myBet = mySeat?.betThisStreet ?? 0;
  $: toCall = Math.max(0, maxBet - myBet);
  $: myStack = mySeat?.stack ?? 0;
  $: canCheck = toCall === 0;

  $: minRaiseTo = gameState ? Math.min(maxBet + gameState.minRaise, myStack + myBet) : 0;
  $: hardMax = myStack + myBet;
  $: canRaise = isMyTurn && hardMax > maxBet && hardMax >= minRaiseTo;

  $: timeRemaining =
    gameState && gameState.turnStartedAt
      ? Math.max(0, (gameState.turnBaseLimit ?? 30) - (nowTick - gameState.turnStartedAt) / 1000)
      : 30;

  $: canUseBank =
    isMyTurn &&
    mySeat &&
    mySeat.timeBankRemaining > 0 &&
    !gameState?.turnBankActive &&
    timeRemaining <= 5;

  $: if (isMyTurn && !raiseTouched) raiseAmount = Math.min(minRaiseTo, hardMax);
  $: if (!isMyTurn) {
    raiseTouched = false;
  }
  $: if (!raiseTouched && raiseAmount < minRaiseTo) raiseAmount = minRaiseTo;
  $: if (raiseAmount > hardMax) raiseAmount = hardMax;

  $: if (!raiseInputFocused) raiseInput = raiseAmount.toFixed(2);

  $: raisePercent =
    hardMax > minRaiseTo ? ((raiseAmount - minRaiseTo) / (hardMax - minRaiseTo)) * 100 : 100;

  $: myAvatarId = ($auth.user as any)?.avatar_id || 'spade';
  $: startingHand = !gameState;

  $: variantLabel =
    gameState?.variant === 'omaha4'
      ? 'Omaha 4'
      : gameState?.variant === 'omaha5'
        ? 'Omaha 5'
        : "NL Hold'em";
  $: blindsLabel = gameState
    ? `$${fmt(gameState.smallBlind)} / $${fmt(gameState.bigBlind)}`
    : '$0.50 / $1.00';
  $: isTournament = !!gameState?.tournamentId;
  $: isFinalTable = isTournament && gameState?.tournamentTableNumber === 1000;
  $: tableTitle = isTournament ? 'Tournament' : 'Cash Game';
  $: seatCount = gameState?.seats?.length ?? 0;

  // ===== Sounds + haptics (derived from store state) =====
  $: if (gameState?.handNo && gameState.handNo !== lastSoundHandNo) {
    lastSoundHandNo = gameState.handNo;
    lastSoundCommunityCount = 0;
    playSound('deal', 0.5);
    haptic.light();
  }

  $: if (gameState?.community) {
    const ccCount = gameState.community.length;
    if (ccCount > lastSoundCommunityCount) {
      lastSoundCommunityCount = ccCount;
      playSound('card-flip', 0.5);
      haptic.light();
    }
  }

  $: if (handResult) {
    resetPreAction();
    const winners = handResult.winners || [];
    const winnersKey = winners.join(',');
    if (winnersKey && winnersKey !== lastSoundWinnersKey) {
      lastSoundWinnersKey = winnersKey;
      const iWon = mySeat && winners.includes(mySeat.seat);
      if (iWon) {
        playSound('win', 0.6);
        haptic.success();
      } else {
        playSound('lose', 0.5);
        haptic.error();
      }
    }
  }

  // ===== Socket errors (pushed by store) =====
  $: if (entry?.lastError && entry.lastError.at !== lastErrorAt) {
    lastErrorAt = entry.lastError.at;
    const msg = entry.lastError.message;

    // Stale tournament room → auto-cleanup + navigate back
    if (msg === 'STALE_TOURNAMENT' || msg.includes('STALE')) {
      errorMsg = 'Table no longer exists — returning to tournaments';
      setTimeout(() => {
        // Remove this table from the active list and go back
        activeTables.leave(tableId);
        onBack();
      }, 1500);
    } else {
      errorMsg = msg;
      setTimeout(() => {
        errorMsg = '';
      }, 3000);
    }
  }

  // ===== Reconnecting toast =====
  $: {
    if (reconnecting && !wasReconnecting) {
      errorMsg = 'Reconnecting…';
    }
    if (!reconnecting && wasReconnecting) {
      autoActionMsg = 'Reconnected';
      setTimeout(() => {
        autoActionMsg = '';
      }, 2000);
    }
    wasReconnecting = reconnecting;
  }

  const PRE_ACTIONS: {
    key: PreActionKey;
    label: string;
    paths: string[];
    color: string;
  }[] = [
    {
      key: 'check_fold',
      label: 'Check/Fold',
      color: '#3b82f6',
      paths: ['M3 12l4 4 9-9', 'M15 4l5 5', 'M20 4l-5 5'],
    },
    {
      key: 'check',
      label: 'Check',
      color: '#10b981',
      paths: ['M5 12l4 4 10-10'],
    },
    {
      key: 'call_any',
      label: 'Call Any',
      color: '#3b82f6',
      paths: [
        'M3 5.5C3 4.1 4.1 3 5.5 3h2.3c.5 0 .9.3 1 .8l.7 3.2c.1.4 0 .8-.4 1L7.5 9.5c1 2 2.5 3.5 4.5 4.5l1.5-1.6c.2-.3.6-.4 1-.3l3.2.7c.5.1.8.5.8 1v2.3c0 1.4-1.1 2.5-2.5 2.5C8.6 19.1 3 13.4 3 5.5z',
      ],
    },
    {
      key: 'fold',
      label: 'Fold',
      color: '#ef4444',
      paths: ['M6 6l12 12', 'M18 6L6 18'],
    },
  ];

  $: showPreActions =
    gameState &&
    !startingHand &&
    !handResult &&
    !sittingOut &&
    !isMyTurn &&
    mySeat &&
    !mySeat.folded &&
    !mySeat.allIn &&
    gameState.phase !== 'showdown' &&
    gameState.phase !== 'waiting';

  function fmt(n: any): string {
    return formatAmount(n);
  }

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  onMount(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      errorMsg = 'no_token';
      return;
    }
    if (!$auth.user?.id) return;

    activeTables.join({ tableId }, token, $auth.user.id);

    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.addEventListener('orientationchange', updateLayout);
    const interval = setInterval(() => {
      nowTick = Date.now();
    }, 500);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('orientationchange', updateLayout);
    };
  });

  onDestroy(() => {
    // Socket stays alive in the store for multi-tabling.
  });

  function resetPreAction() {
    preAction = null;
    lastFireKey = null;
  }

  $: if (
    gameState?.handNo &&
    gameState.handNo !== lastEndedHandNo &&
    gameState.winners &&
    gameState.winners.length > 0
  ) {
    lastEndedHandNo = gameState.handNo;
    resetPreAction();
  }

  function tryFirePreAction() {
    if (!isMyTurn || !preAction || sittingOut) return;
    if (!socket) return;

    const action = preAction;
    const handNo = gameState?.handNo ?? -1;

    const fireKey = `${handNo}-${gameState?.community?.length || 0}-${gameState?.currentSeat}`;
    if (lastFireKey === fireKey) return;
    lastFireKey = fireKey;

    let sent = false;

    if (action === 'fold') {
      socket.action('FOLD', 0);
      autoActionMsg = 'Fold (pre-action)';
      sent = true;
    } else if (action === 'check') {
      if (canCheck) {
        socket.action('CHECK', 0);
        autoActionMsg = 'Check (pre-action)';
        sent = true;
      } else {
        autoActionMsg = 'Cannot check';
        setTimeout(() => {
          autoActionMsg = '';
        }, 1500);
      }
    } else if (action === 'check_fold') {
      if (canCheck) {
        socket.action('CHECK', 0);
        autoActionMsg = 'Check (pre-action)';
        sent = true;
      } else {
        socket.action('FOLD', 0);
        autoActionMsg = 'Fold (pre-action)';
        sent = true;
      }
    } else if (action === 'call_any') {
      if (canCheck) {
        socket.action('CHECK', 0);
        autoActionMsg = 'Check (pre-action)';
        sent = true;
      } else if (myStack > 0) {
        socket.action('CALL', 0);
        autoActionMsg = 'Call (pre-action)';
        sent = true;
      } else {
        socket.action('FOLD', 0);
        autoActionMsg = 'Fold (no chips)';
        sent = true;
      }
    }

    if (sent) {
      preAction = null;
      lastFireKey = null;
      setTimeout(() => {
        autoActionMsg = '';
      }, 2000);
    }
  }

  $: if (isMyTurn && preAction && !sittingOut) {
    setTimeout(tryFirePreAction, 150);
  }

  function setPreAction(pa: PreActionKey) {
    if (preAction === pa) {
      preAction = null;
      lastFireKey = null;
    } else {
      preAction = pa;
      lastFireKey = null;
      autoActionMsg = `${pa.replace('_', '/')} armed`;
      setTimeout(() => {
        autoActionMsg = '';
      }, 1500);
    }
  }

  function doAction(action: 'FOLD' | 'CHECK' | 'CALL', amount = 0) {
    if (!socket || !isMyTurn) return;
    resetPreAction();
    socket.action(action, amount);

    if (action === 'FOLD') {
      playSound('button', 0.4);
      haptic.light();
    } else if (action === 'CALL') {
      playSound('chip', 0.5);
      haptic.medium();
    } else {
      playSound('check', 0.5);
      haptic.light();
    }
  }

  function doRaise() {
    if (!canRaise) return;
    resetPreAction();
    socket?.action('RAISE', Math.round(raiseAmount * 100) / 100);

    playSound('chip', 0.6);
    haptic.medium();
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

  function potRaise() {
    if (!gameState) return;
    const potTotal = (gameState.pot ?? 0) + maxBet - myBet;
    setRaise(Math.min(potTotal, hardMax));
  }

  function fractionRaise(f: number) {
    if (!gameState) return;
    const potTotal = (gameState.pot ?? 0) + maxBet - myBet;
    setRaise(Math.min(maxBet + potTotal * f, hardMax));
  }

  function allIn() {
    setRaise(hardMax);
  }

  function useTimeBank() {
    if (!socket || !canUseBank) return;
    socket.useTimeBank();
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }

  function doSitOut() {
    sittingOut = true;
    showMenu = false;
    resetPreAction();
    autoActionMsg = 'Sitting out';
    setTimeout(() => {
      autoActionMsg = '';
    }, 2500);
  }

  function doSitIn() {
    sittingOut = false;
    showMenu = false;
    autoActionMsg = '▶️ Back in action';
    setTimeout(() => {
      autoActionMsg = '';
    }, 2000);
  }

  function leaveTable() {
    showMenu = false;
    if (!confirm('Leave this table?')) return;
    activeTables.leave(tableId);
    setTimeout(() => onBack(), 200);
  }

  function openPlayerInfo(userId: number) {
    const s = gameState?.seats?.find((x: any) => Number(x.userId) === Number(userId));
    if (!s) return;
    selectedPlayer = {
      ...s,
      dealer: gameState?.dealerSeat === s.seat,
    };
    showPlayerInfo = true;
  }

  function mutePlayer(userId: number) {
    autoActionMsg = 'Player muted';
    setTimeout(() => {
      autoActionMsg = '';
    }, 1500);
  }

  // ===== Auto-Muck: sync preference to all active sockets =====
  let lastSentAutoMuck = get(preferences).autoMuck;
  $: if ($preferences.autoMuck !== lastSentAutoMuck) {
    lastSentAutoMuck = $preferences.autoMuck;
    activeTables.updateAutoMuck(lastSentAutoMuck);
  }
</script>

<div
  class="relative w-full bg-navy overflow-hidden"
  style="height: 100dvh; min-height: 100dvh; max-height: 100dvh; padding-bottom: env(safe-area-inset-bottom);"
>
  <!-- HEADER -->
  <div
    class="absolute top-0 left-0 right-0 z-40 px-3 flex items-start justify-between"
    style="padding-top: max(12px, env(safe-area-inset-top));"
  >
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg active:scale-95 shrink-0"
      style="background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(10px);"
    >
      ←
    </button>

    <div class="flex-1 flex flex-col items-center pt-1">
      <p class="text-[13px] font-extrabold text-white tracking-wide">
        {tableTitle}
        {#if seatCount}({seatCount} players){/if}
      </p>
      <p class="text-[10px] text-cyan/80 font-semibold mt-0.5">
        {variantLabel} · {blindsLabel}
      </p>
    </div>

    <button
      on:click={toggleMenu}
      aria-label="Menu"
      class="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 shrink-0 {showMenu
        ? 'ring-2 ring-gold'
        : ''}"
      style="background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(10px);"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>
  </div>

  <!-- CONNECTION STATUS -->
  {#if reconnecting}
    <div
      class="absolute z-40 rounded-full px-3 py-1 flex items-center gap-1.5"
      style="top: max(64px, calc(env(safe-area-inset-top) + 56px)); left:50%; transform: translateX(-50%); background: rgba(239,68,68,0.9); border: 1px solid rgba(255,255,255,0.2);"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
      <span class="text-[10px] font-bold text-white">Reconnecting…</span>
    </div>
  {/if}

  <!-- SEED MODAL -->
  {#if showSeedModal && gameState}
    <button
      aria-label="Close"
      class="fixed inset-0 z-[70] cursor-default"
      style="background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);"
      on:click={() => (showSeedModal = false)}
    ></button>
    <div
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] rounded-2xl p-4 w-[90%] max-w-[380px]"
      style="background: rgba(15,23,42,0.98); border: 1px solid rgba(37,99,235,0.25);"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-extrabold text-white">
          <Icon name="lock" size={12} color="#f4c95d" /> Provably Fair
        </h3>
        <button on:click={() => (showSeedModal = false)} class="text-white/60 text-xl leading-none">
          ×
        </button>
      </div>
      <div class="space-y-2 text-[11px] font-mono">
        <div>
          <p class="text-white/40 mb-1">Hand #</p>
          <p class="text-white break-all">{gameState.handNo}</p>
        </div>
        <div>
          <p class="text-white/40 mb-1">Server Seed Hash</p>
          <p class="text-cyan break-all">{gameState.serverSeedHash ?? '—'}</p>
        </div>
        <div>
          <p class="text-white/40 mb-1">Client Seed</p>
          <p class="text-white/80 break-all">{gameState.clientSeed ?? '—'}</p>
        </div>
        {#if gameState.revealSeed}
          <div>
            <p class="text-gold/80 mb-1">Revealed Server Seed</p>
            <p class="text-gold break-all">{gameState.revealSeed}</p>
          </div>
          <p class="text-emerald-400 text-[10px] mt-2">
            <Icon name="success" size={11} color="#34d399" /> Verified
          </p>
        {:else}
          <p class="text-white/40 text-[10px] mt-2">
            <Icon name="lock" size={10} color="rgba(255,255,255,0.4)" /> Seed after hand ends revealed
          </p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- MENU -->
  {#if showMenu}
    <button
      aria-label="Close menu"
      class="fixed inset-0 z-40 cursor-default"
      style="background: transparent;"
      on:click={() => (showMenu = false)}
    ></button>
    <div
      class="absolute z-50 rounded-2xl p-2 shadow-2xl"
      style="top: max(64px, calc(env(safe-area-inset-top) + 56px)); right: 12px; width: 220px; background: rgba(8,13,36,0.98); border: 1px solid rgba(37,99,235,0.25); backdrop-filter: blur(16px);"
    >
      <button
        on:click={() => {
          showMenu = false;
          showHandHistory = true;
        }}
        class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition"
        style="background: rgba(37,99,235,0.12);"
      >
        <span class="text-lg"><Icon name="receipt" size={18} color="#f4c95d" /></span>
        <div class="flex-1">
          <p class="text-sm font-bold text-white">Hand History</p>
          <p class="text-[10px] text-white/50">View past hands</p>
        </div>
      </button>

      <button
        on:click={() => {
          showMenu = false;
          showChat = true;
        }}
        class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition"
        style="background: rgba(34,211,238,0.12);"
      >
        <span class="text-lg"><Icon name="chat" size={18} color="#67e8f9" /></span>
        <div class="flex-1">
          <p class="text-sm font-bold text-white">Chat</p>
          <p class="text-[10px] text-white/50">Talk to players</p>
        </div>
      </button>

      <button
        on:click={() => {
          showMenu = false;
          showSeedModal = true;
        }}
        class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition"
        style="background: rgba(34,211,238,0.1);"
      >
        <span class="text-lg"><Icon name="shield" size={18} color="#6ee7b7" /></span>
        <div class="flex-1">
          <p class="text-sm font-bold text-white">Provably Fair</p>
          <p class="text-[10px] text-white/50">View seed</p>
        </div>
      </button>

      <div class="my-1 mx-2" style="height: 1px; background: rgba(37,99,235,0.15);"></div>

      {#if sittingOut}
        <button
          on:click={doSitIn}
          class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition"
          style="background: rgba(16,185,129,0.12);"
        >
          <span class="text-lg">▶️</span>
          <div class="flex-1">
            <p class="text-sm font-bold text-white">Sit In</p>
            <p class="text-[10px] text-white/50">Resume playing</p>
          </div>
        </button>
      {:else}
        <button
          on:click={doSitOut}
          class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition"
          style="background: rgba(244,201,93,0.1);"
        >
          <span class="text-lg">⏸️</span>
          <div class="flex-1">
            <p class="text-sm font-bold text-white">Sit Out</p>
            <p class="text-[10px] text-white/50">Auto-fold next hands</p>
          </div>
        </button>
      {/if}

      <div class="my-1 mx-2" style="height: 1px; background: rgba(37,99,235,0.15);"></div>

      <button
        on:click={leaveTable}
        class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.98] transition"
        style="background: rgba(220,38,38,0.15);"
      >
        <span class="text-lg"><Icon name="logout" size={18} color="#fca5a5" /></span>
        <div class="flex-1">
          <p class="text-sm font-bold text-red-300">Leave Table</p>
          <p class="text-[10px] text-white/50">Return chips</p>
        </div>
      </button>
    </div>
  {/if}

  <!-- POKER TABLE -->
  {#if layoutMode === 'mobile-portrait'}
    <PokerTableMobile
      {gameState}
      {myUserId}
      {myAvatarId}
      theme={isTournament ? 'tournament' : 'cash'}
      {handResult}
      {isFinalTable}
      tournamentTitle={isTournament ? 'Tournament' : ''}
      onPlayerClick={openPlayerInfo}
    />
  {:else}
    <PokerTable
      {gameState}
      {myUserId}
      {myAvatarId}
      theme={isTournament ? 'tournament' : 'cash'}
      {handResult}
      {isFinalTable}
      tournamentTitle={isTournament ? 'Tournament' : ''}
      compact={layoutMode === 'mobile-landscape'}
      onPlayerClick={openPlayerInfo}
    />
  {/if}

  <!-- MODALS -->
  <HandHistoryModal
    open={showHandHistory}
    onClose={() => (showHandHistory = false)}
    onReplay={(handId) => {
      showHandHistory = false;
      replayHandId = handId;
      showReplay = true;
    }}
  />

  <HandReplayModal
    open={showReplay}
    handId={replayHandId}
    onClose={() => {
      showReplay = false;
      replayHandId = null;
    }}
  />

  <PlayerInfoModal
    open={showPlayerInfo}
    player={selectedPlayer}
    {myUserId}
    onClose={() => {
      showPlayerInfo = false;
      selectedPlayer = null;
    }}
    onMute={mutePlayer}
  />

  <ChatModal
    open={showChat}
    {myUserId}
    {myAvatarId}
    {socket}
    onClose={() => {
      showChat = false;
    }}
  />

  <!-- WAITING -->
  {#if !gameState || startingHand}
    <div
      class="absolute top-[78%] left-1/2 -translate-x-1/2 z-20 rounded-2xl px-5 py-3 text-center"
      style="background: rgba(0,0,0,0.88); border: 1px solid rgba(37,99,235,0.25);"
    >
      <p class="text-sm text-white/70">{$t('table.waitingPlayers')}</p>
      <p class="text-xs text-gold mt-1 font-bold">
        {gameState?.seats?.filter((s: any) => s.stack > 0).length ?? 0} /2
      </p>
    </div>
  {/if}

  <!-- TOASTS -->
  {#if autoActionMsg}
    <div
      class="absolute top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2 max-w-[90%]"
      style="background: rgba(0,0,0,0.92); border: 1px solid rgba(244,201,93,0.4);"
    >
      <p class="text-xs font-bold text-gold text-center">{autoActionMsg}</p>
    </div>
  {/if}

  {#if errorMsg && errorMsg !== 'Reconnecting…'}
    <div
      class="absolute top-32 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2 max-w-[90%]"
      style="background: rgba(153,27,27,0.95); border: 1px solid rgba(220,38,38,0.5);"
    >
      <p class="text-xs font-bold text-red-200">{errorMsg}</p>
    </div>
  {/if}

  <!-- PRE-ACTION -->
  {#if showPreActions}
    <div
      class="absolute bottom-0 left-0 right-0 z-30"
      style="padding: 10px 12px calc(14px + env(safe-area-inset-bottom)) 12px; max-width: min(720px, 92vw); margin: 0 auto;"
    >
      <div
        class="rounded-2xl p-2"
        style="background: rgba(0,0,0,0.9); border: 1px solid rgba(37,99,235,0.2); backdrop-filter: blur(12px);"
      >
        <div class="flex items-center justify-between px-2 mb-1.5">
          <span class="text-[9px] uppercase tracking-widest font-extrabold text-white/40">
            Pre-Action
          </span>
          {#if preAction}
            <span class="text-[9px] font-bold text-gold"> Armed · Tap again to cancel </span>
          {/if}
        </div>
        <div class="flex gap-1.5">
          {#each PRE_ACTIONS as pa}
            <button
              on:click={() => setPreAction(pa.key)}
              class="flex-1 rounded-xl py-2.5 active:scale-[0.97] transition-all flex flex-col items-center gap-1 relative overflow-hidden"
              style="background: {preAction === pa.key
                ? pa.color
                : 'rgba(255,255,255,0.06)'}; border: {preAction === pa.key
                ? `2px solid ${pa.color}`
                : '2px solid transparent'}; box-shadow: {preAction === pa.key
                ? `0 0 18px ${pa.color}80, inset 0 1px 0 rgba(255,255,255,0.25)`
                : 'inset 0 1px 0 rgba(255,255,255,0.04)'};"
            >
              {#if preAction === pa.key}
                <span
                  class="absolute inset-0 rounded-xl animate-pulse pointer-events-none"
                  style="background: radial-gradient(circle at 50% 100%, {pa.color}55 0%, transparent 70%);"
                ></span>
              {/if}

              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={preAction === pa.key ? '#ffffff' : pa.color}
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="relative"
                style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));"
              >
                {#each pa.paths as d}
                  <path {d} />
                {/each}
              </svg>

              <span
                class="text-[9px] font-bold leading-none relative"
                style="color: {preAction === pa.key ? 'white' : 'rgba(255,255,255,0.7)'};"
              >
                {pa.label}
              </span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- RAISE POPUP PANEL (with slider) -->
  {#if showRaisePanel && isMyTurn && !sittingOut && betSliderEnabled}
    <div
      class="absolute z-[36] pointer-events-none"
      style="
        right: 12px;
        bottom: calc(96px + env(safe-area-inset-bottom));
        width: calc((min(480px, 100vw) - 40px) / 3);
        max-width: 160px;
      "
    >
      <div
        class="rounded-xl p-1.5 flex gap-1 pointer-events-auto"
        style="background: rgba(8,13,36,0.98); border: 1.5px solid rgba(37,99,235,0.5); box-shadow: 0 -8px 32px rgba(0,0,0,0.85), 0 0 24px rgba(37,99,235,0.2);"
      >
        <div
          class="flex flex-col justify-between gap-0.5 flex-1 min-w-0"
          style="min-height: 200px;"
        >
          {#each presets as p}
            <button
              on:click={() => setRaise(p.value)}
              class="rounded-md py-1 active:scale-95 transition-all px-1 overflow-hidden"
              style="
                background: {Math.abs(raiseAmount - p.value) < 0.01
                ? 'linear-gradient(180deg, rgba(37,99,235,0.7), rgba(37,99,235,0.4))'
                : 'linear-gradient(180deg, rgba(37,99,235,0.35), rgba(37,99,235,0.12))'};
                border: 1px solid {Math.abs(raiseAmount - p.value) < 0.01
                ? 'rgba(167,139,250,0.9)'
                : 'rgba(37,99,235,0.4)'};
              "
            >
              <div class="text-[7px] font-extrabold text-white/60 uppercase leading-none">
                {p.label}
              </div>
              <div
                class="text-[9px] font-extrabold text-white tabular-nums leading-tight mt-0.5 truncate"
              >
                ${fmt(p.value)}
              </div>
            </button>
          {/each}

          {#if editingCustom}
            <input
              type="text"
              inputmode="decimal"
              bind:value={customInput}
              on:input={(e) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                if (!isNaN(v) && v > 0) setRaise(v);
              }}
              on:blur={() => {
                const v = parseFloat(customInput);
                if (!isNaN(v) && v > 0) setRaise(v);
                editingCustom = false;
              }}
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseFloat(customInput);
                  if (!isNaN(v) && v > 0) setRaise(v);
                  editingCustom = false;
                  (e.target as HTMLInputElement).blur();
                }
              }}
              class="rounded-md text-[10px] font-extrabold text-gold tabular-nums text-center outline-none"
              style="padding: 5px 2px; width: 100%; background: rgba(0,0,0,0.6); border: 1.5px solid rgba(212,175,55,0.7);"
            />
          {:else}
            <button
              on:click={() => {
                customInput = raiseAmount.toFixed(2);
                editingCustom = true;
              }}
              class="rounded-md py-1 active:scale-95 transition-all px-1"
              style="
                background: linear-gradient(180deg, rgba(212,175,55,0.35), rgba(212,175,55,0.12));
                border: 1px solid rgba(212,175,55,0.5);
              "
            >
              <div class="text-[7px] font-extrabold text-gold/80 uppercase leading-none">
                CUSTOM
              </div>
              <div class="text-[9px] font-extrabold text-gold tabular-nums leading-tight mt-0.5">
                $—
              </div>
            </button>
          {/if}
        </div>

        <div
          bind:this={sliderRef}
          role="slider"
          aria-valuenow={raiseAmount}
          aria-valuemin={minRaiseTo}
          aria-valuemax={hardMax}
          tabindex="0"
          class="relative rounded-lg overflow-hidden touch-none select-none shrink-0"
          style="width: 40px; height: 200px; background: linear-gradient(180deg, rgba(8,13,36,0.95), rgba(5,8,15,1)); border: 1px solid rgba(212,175,55,0.5); cursor: pointer;"
          on:pointerdown={(e) => {
            dragging = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            handleSliderPointer(e.clientY);
          }}
          on:pointermove={(e) => {
            if (dragging) handleSliderPointer(e.clientY);
          }}
          on:pointerup={(e) => {
            dragging = false;
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              // ignore
            }
          }}
          on:pointercancel={() => (dragging = false)}
        >
          <div
            class="absolute left-0 right-0 bottom-0 pointer-events-none"
            style="
              height: {raisePercent}%;
              background: linear-gradient(180deg, {isAllIn
              ? 'rgba(239,68,68,0.35)'
              : 'rgba(244,201,93,0.28)'}, {isAllIn
              ? 'rgba(239,68,68,0.08)'
              : 'rgba(244,201,93,0.05)'});
              transition: height 0.06s linear;
            "
          ></div>

          <div class="absolute inset-x-1 pointer-events-none" style="top: 32px; bottom: 32px;">
            {#each Array(5) as _, i}
              <div
                class="absolute left-0 right-0 h-px"
                style="
                  top: {(i / 4) * 100}%;
                  background: linear-gradient(90deg, transparent, rgba(212,175,55,{isAllIn
                  ? 0.15
                  : 0.35}), transparent);
                "
              ></div>
            {/each}
          </div>

          <div class="absolute top-1 left-0 right-0 text-center pointer-events-none">
            <div
              class="text-[6px] font-extrabold uppercase tracking-wider leading-none"
              style="color: {isAllIn ? '#fca5a5' : 'rgba(212,175,55,0.7)'};"
            >
              ALL-IN
            </div>
            <div
              class="text-[8px] font-extrabold tabular-nums leading-tight mt-0.5"
              style="color: {isAllIn ? '#fca5a5' : '#d4af37'};"
            >
              ${fmt(hardMax)}
            </div>
          </div>

          <div
            class="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style="bottom: calc({raisePercent}% - 13px); transition: bottom 0.06s linear;"
          >
            <div
              class="rounded-full flex items-center justify-center"
              style="
                min-width: 36px;
                height: 26px;
                padding: 0 5px;
                background: {isAllIn
                ? 'radial-gradient(circle at 35% 30%, #fca5a5, #dc2626 50%, #7f1d1d)'
                : 'radial-gradient(circle at 35% 30%, #fef3c7, #d4af37 50%, #a87a15)'};
                border: 1.5px solid {isAllIn ? 'rgba(252,165,165,0.9)' : 'rgba(255,235,170,0.85)'};
                box-shadow: 0 2px 8px rgba(0,0,0,0.9), 0 0 14px {isAllIn
                ? 'rgba(239,68,68,0.7)'
                : 'rgba(244,201,93,0.55)'};
              "
            >
              <span
                class="text-[8px] font-extrabold tabular-nums leading-none"
                style="color: {isAllIn ? '#fff' : '#0a0800'};">${fmt(raiseAmount)}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- RAISE PANEL WITHOUT SLIDER (betSlider off) -->
  {#if showRaisePanel && isMyTurn && !sittingOut && !betSliderEnabled}
    <div
      class="absolute z-[36] pointer-events-none"
      style="
        right: 12px;
        bottom: calc(96px + env(safe-area-inset-bottom));
        width: calc((min(480px, 100vw) - 40px) / 2);
        max-width: 220px;
      "
    >
      <div
        class="rounded-xl p-2 pointer-events-auto"
        style="background: rgba(8,13,36,0.98); border: 1.5px solid rgba(37,99,235,0.5); box-shadow: 0 -8px 32px rgba(0,0,0,0.85), 0 0 24px rgba(37,99,235,0.2);"
      >
        <div class="grid grid-cols-2 gap-1 mb-1.5">
          {#each presets as p}
            <button
              on:click={() => setRaise(p.value)}
              class="rounded-md py-1.5 active:scale-95 transition-all px-1 overflow-hidden"
              style="
                background: {Math.abs(raiseAmount - p.value) < 0.01
                ? 'linear-gradient(180deg, rgba(37,99,235,0.7), rgba(37,99,235,0.4))'
                : 'linear-gradient(180deg, rgba(37,99,235,0.35), rgba(37,99,235,0.12))'};
                border: 1px solid {Math.abs(raiseAmount - p.value) < 0.01
                ? 'rgba(167,139,250,0.9)'
                : 'rgba(37,99,235,0.4)'};
              "
            >
              <div class="text-[7px] font-extrabold text-white/60 uppercase leading-none">
                {p.label}
              </div>
              <div
                class="text-[10px] font-extrabold text-white tabular-nums leading-tight mt-0.5 truncate"
              >
                ${fmt(p.value)}
              </div>
            </button>
          {/each}
        </div>

        <div class="flex gap-1 mb-1.5">
          {#if editingCustom}
            <input
              type="text"
              inputmode="decimal"
              bind:value={customInput}
              on:input={(e) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                if (!isNaN(v) && v > 0) setRaise(v);
              }}
              on:blur={() => {
                const v = parseFloat(customInput);
                if (!isNaN(v) && v > 0) setRaise(v);
                editingCustom = false;
              }}
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  const v = parseFloat(customInput);
                  if (!isNaN(v) && v > 0) setRaise(v);
                  editingCustom = false;
                  (e.target as HTMLInputElement).blur();
                }
              }}
              class="flex-1 rounded-md text-[10px] font-extrabold text-gold tabular-nums text-center outline-none"
              style="padding: 6px 4px; background: rgba(0,0,0,0.6); border: 1.5px solid rgba(212,175,55,0.7);"
            />
          {:else}
            <button
              on:click={() => {
                customInput = raiseAmount.toFixed(2);
                editingCustom = true;
              }}
              class="flex-1 rounded-md py-1.5 active:scale-95 transition-all"
              style="background: linear-gradient(180deg, rgba(212,175,55,0.35), rgba(212,175,55,0.12)); border: 1px solid rgba(212,175,55,0.5);"
            >
              <div class="text-[7px] font-extrabold text-gold/80 uppercase leading-none">
                CUSTOM
              </div>
              <div class="text-[10px] font-extrabold text-gold tabular-nums leading-tight mt-0.5">
                $—
              </div>
            </button>
          {/if}
          <button
            on:click={allIn}
            class="flex-1 rounded-md py-1.5 active:scale-95 transition-all"
            style="background: linear-gradient(180deg, rgba(239,68,68,0.4), rgba(239,68,68,0.15)); border: 1px solid rgba(239,68,68,0.6);"
          >
            <div class="text-[7px] font-extrabold text-red-300 uppercase leading-none">ALL-IN</div>
            <div class="text-[10px] font-extrabold text-red-200 tabular-nums leading-tight mt-0.5">
              ${fmt(hardMax)}
            </div>
          </button>
        </div>

        <div
          class="rounded-md py-1.5 text-center"
          style="background: rgba(0,0,0,0.5); border: 1px solid rgba(212,175,55,0.3);"
        >
          <span class="text-[8px] uppercase text-white/40 font-bold">Raise to </span>
          <span class="text-[13px] font-extrabold text-gold tabular-nums">${fmt(raiseAmount)}</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- ACTION BAR -->
  {#if gameState && !startingHand && !handResult && isMyTurn}
    <div
      class="absolute bottom-0 left-0 right-0 z-30"
      style="padding: 10px 12px calc(14px + env(safe-area-inset-bottom)) 12px; max-width: min(720px, 92vw); margin: 0 auto;"
    >
      {#if !sittingOut}
        {#if canUseBank}
          <div class="flex justify-center mb-2">
            <button
              on:click={useTimeBank}
              class="rounded-full px-4 py-1.5 text-[11px] font-bold text-gold active:scale-95"
              style="background: rgba(0,0,0,0.85); border: 1px solid rgba(244,201,93,0.5); backdrop-filter: blur(10px);"
              ><Icon name="clock" size={12} color="#f4c95d" /> Use Time Bank</button
            >
          </div>
        {/if}

        <div class="flex gap-2">
          <button
            on:click={() => {
              doAction('FOLD');
              showRaisePanel = false;
            }}
            class="flex-1 rounded-xl py-4 active:scale-[0.97] transition-all"
            style="background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%); box-shadow: 0 4px 0 #7f1d1d, 0 6px 14px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);"
          >
            <span class="text-[15px] font-extrabold text-white uppercase tracking-wider">FOLD</span>
          </button>

          {#if canCheck}
            <button
              on:click={() => {
                doAction('CHECK');
                showRaisePanel = false;
              }}
              class="flex-1 rounded-xl py-4 active:scale-[0.97] transition-all"
              style="background: linear-gradient(180deg, #22c55e 0%, #15803d 100%); box-shadow: 0 4px 0 #14532d, 0 6px 14px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);"
            >
              <span class="text-[15px] font-extrabold text-white uppercase tracking-wider"
                >CHECK</span
              >
            </button>
          {:else}
            <button
              on:click={() => {
                doAction('CALL');
                showRaisePanel = false;
              }}
              disabled={myStack === 0}
              class="flex-1 rounded-xl py-3 active:scale-[0.97] transition-all disabled:opacity-50"
              style="background: linear-gradient(180deg, #22c55e 0%, #15803d 100%); box-shadow: 0 4px 0 #14532d, 0 6px 14px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);"
            >
              <span class="block text-[11px] font-bold text-white/90 leading-none uppercase"
                >CALL</span
              >
              <span
                class="block text-[16px] font-extrabold text-white leading-tight tabular-nums mt-0.5"
                >${fmt(toCall)}</span
              >
            </button>
          {/if}

          {#if canRaise}
            <button
              on:click={() => {
                if (!betSliderEnabled) {
                  doRaise();
                  return;
                }
                if (showRaisePanel) {
                  doRaise();
                  showRaisePanel = false;
                } else {
                  showRaisePanel = true;
                }
              }}
              class="flex-1 rounded-xl py-3 active:scale-[0.97] transition-all relative"
              style="background: linear-gradient(180deg, {isAllIn
                ? '#ef4444 0%, #991b1b 100%'
                : '#3b82f6 0%, #1d4ed8 100%'}); box-shadow: 0 4px 0 {isAllIn
                ? '#7f1d1d'
                : '#1e3a8a'}, 0 6px 14px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.3);"
            >
              <span
                class="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] leading-none transition-transform"
                style="color: rgba(255,255,255,0.7); transform: translateX(-50%) rotate({showRaisePanel
                  ? 180
                  : 0}deg);">▲</span
              >
              <span class="block text-[11px] font-bold text-white/90 leading-none uppercase">
                {showRaisePanel ? (isAllIn ? 'ALL-IN' : 'CONFIRM') : 'RAISE'}
              </span>
              <span
                class="block text-[16px] font-extrabold text-white leading-tight tabular-nums mt-0.5"
              >
                ${fmt(raiseAmount)}
              </span>
            </button>
          {:else if myStack > 0 && myStack <= toCall}
            <button
              on:click={() => {
                allIn();
                doRaise();
              }}
              class="flex-1 rounded-xl py-4 active:scale-[0.97] transition-all"
              style="background: linear-gradient(180deg, #ef4444 0%, #991b1b 100%); box-shadow: 0 4px 0 #7f1d1d, 0 6px 14px rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.2);"
            >
              <span class="text-[15px] font-extrabold text-white uppercase tracking-wider"
                >ALL-IN</span
              >
            </button>
          {/if}
        </div>
      {:else}
        <div
          class="rounded-2xl p-3 text-center"
          style="background: rgba(244,201,93,0.15); border: 1px solid rgba(244,201,93,0.4); backdrop-filter: blur(10px);"
        >
          <p class="text-xs font-bold text-gold">
            <Icon name="pause" size={11} color="#f4c95d" /> Sitting Out — Auto-folding
          </p>
          <button on:click={doSitIn} class="mt-2 text-[11px] text-white underline"
            >Resume playing</button
          >
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* No custom styles needed here — preferences handle visuals */
</style>
