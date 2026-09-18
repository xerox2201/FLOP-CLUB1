<script lang="ts">
  import PlayingCard from './PlayingCard.svelte';
  import PokerChip from './PokerChip.svelte';
  import Avatar from './Avatar.svelte';
  import TimerRing from './TimerRing.svelte';

  export let gameState: any = null;
  export let myUserId: number | null = null;
  export let myAvatarId: string = 'king';
  export let theme: 'cash' | 'tournament' = 'cash';
  export let tournamentTitle: string = '';
  export let isEliminated: boolean = false;
  export let handResult: any = null;
  export let isFinalTable: boolean = false;
  export let onPlayerClick: (userId: number) => void = () => {};

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  // ===== Seat angles =====
  const BASE_ANGLES: Record<number, number[]> = {
    2: [90, 270],
    3: [90, 210, 330],
    4: [90, 180, 270, 0],
    5: [90, 162, 234, 306, 18],
    6: [90, 150, 210, 270, 330, 30],
    7: [90, 141, 193, 244, 296, 347, 38],
    8: [90, 135, 180, 225, 270, 315, 0, 45],
    9: [90, 130, 170, 210, 250, 290, 330, 10, 50],
  };

  function seatPos(rotatedIdx: number, total: number): { x: number; y: number } {
    const angles = BASE_ANGLES[total] || BASE_ANGLES[6];
    const deg = angles[rotatedIdx] ?? 90;
    const rad = (deg * Math.PI) / 180;
    const rx = total === 2 ? 38 : 44;
    const ry = total === 2 ? 34 : 36;
    return { x: 50 + Math.cos(rad) * rx, y: 50 + Math.sin(rad) * ry };
  }

  function towardCenter(px: number, py: number, dist: number): { x: number; y: number } {
    const dx = 50 - px;
    const dy = 50 - py;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: (dx / len) * dist, y: (dy / len) * dist };
  }

  // ===== Reactive state =====
  $: allSeats = gameState?.seats ?? [];
  $: totalSeats = allSeats.length;
  $: heroIdx = allSeats.findIndex((s: any) => s.userId === myUserId);
  $: mySeat = heroIdx >= 0 ? allSeats[heroIdx] : null;
  $: opponents = allSeats.filter((s: any) => s.userId !== myUserId);

  // Winners: fallback to handResult if gameState.winners is cleared
  $: winners = (gameState?.winners && gameState.winners.length > 0)
    ? gameState.winners
    : (handResult?.winners ?? []);

  $: sidePots = gameState?.sidePots ?? [];

  $: isMyTurn = !!(
    gameState &&
    mySeat &&
    gameState.currentSeat === mySeat.seat &&
    !mySeat.folded &&
    !mySeat.allIn &&
    winners.length === 0
  );

  $: totalPot = gameState?.pot ?? 0;

  // Community: fallback to handResult during result window
  $: community = (gameState?.community && gameState.community.length > 0)
    ? gameState.community
    : (handResult?.communityCards ?? []);

  // Hero hole: fallback to showdown data during result window
  $: heroShowdownPlayer = handResult?.showdownPlayers?.find(
    (p: any) => p.seat === mySeat?.seat
  );
  $: heroHole = (mySeat?.hole && mySeat.hole.length > 0)
    ? mySeat.hole
    : (heroShowdownPlayer?.hole ?? []);

  $: serverTime = gameState?.serverTime ?? Date.now();
  $: turnStartedAt = gameState?.turnStartedAt ?? 0;
  $: turnBaseLimit = gameState?.turnBaseLimit ?? 30;

  function oppPos(opponentSeatIdx: number): { x: number; y: number } {
    if (heroIdx < 0) return { x: 50, y: 10 };
    const rotated = (opponentSeatIdx - heroIdx + totalSeats) % totalSeats;
    return seatPos(rotated, totalSeats);
  }

  // Showdown data
  $: showdownData = (() => {
    if (!winners || winners.length === 0) return null;
    if (!handResult?.showdownPlayers) return null;
    const map: Record<number, { isWinner: boolean; handName: string; payout: number }> = {};
    for (const p of handResult.showdownPlayers) {
      map[p.seat] = {
        isWinner: !!p.isWinner,
        handName: p.handName || '',
        payout: p.payout || 0,
      };
    }
    return map;
  })();

  function isWinnerSeat(seat: number): boolean {
    return winners.includes(seat);
  }
  function inShowdown(seat: number): boolean {
    return !!(showdownData && showdownData[seat]);
  }
  function showdownWin(seat: number): boolean {
    return !!(showdownData && showdownData[seat]?.isWinner);
  }
  function showdownLose(seat: number): boolean {
    return !!(showdownData && showdownData[seat] && !showdownData[seat].isWinner);
  }
  function handName(seat: number): string {
    return showdownData?.[seat]?.handName || '';
  }
  function payoutForSeat(seat: number): number {
    return showdownData?.[seat]?.payout ?? 0;
  }

  // ===== Winner announcement data =====
  $: winnerPlayer = handResult?.showdownPlayers?.find((p: any) => p.isWinner);
  $: winnerIsMe = winnerPlayer?.userId === myUserId;
  $: winnerDisplayName = winnerIsMe ? 'You' : (() => {
    const s = allSeats.find((x: any) => x.seat === winnerPlayer?.seat);
    return s?.displayName || 'Winner';
  })();

  // ===== Winning card highlight =====
  $: winningCardKeys = new Set(
    (winnerPlayer?.bestCards ?? []).map((c: any) => `${c.r}${c.s}`)
  );

  function isWinningCard(c: any): boolean {
    return winningCardKeys.has(`${c.r}${c.s}`);
  }

  // ===== Chip fly animation =====
  let chipFlies: { id: number; fromX: number; fromY: number; toX: number; toY: number; delay: number }[] = [];
  let chipFlyIdCounter = 0;

  $: if (winners.length > 0 && totalPot > 0) {
    const flies: typeof chipFlies = [];
    for (const winnerSeat of winners) {
      const winnerSeatInfo = allSeats.find((s: any) => s.seat === winnerSeat);
      if (!winnerSeatInfo) continue;

      let toX = 50;
      let toY = 42;
      if (winnerSeat === mySeat?.seat) {
        toX = 50; toY = 85;
      } else {
        const pos = oppPos(winnerSeat);
        toX = pos.x; toY = pos.y;
      }

      const payout = showdownData?.[winnerSeat]?.payout ?? 0;
      if (payout > 0) {
        flies.push({
          id: ++chipFlyIdCounter,
          fromX: 50, fromY: 42,
          toX, toY,
          delay: 0.3,
        });
      }
    }
    chipFlies = flies;
  } else {
    chipFlies = [];
  }

  $: isFinal = isFinalTable;
</script>
<div
  class="absolute left-1/2 -translate-x-1/2 w-[120%] max-w-[600px]"
  style="top: 42%; transform: translate(-50%, -50%);"
>
  <div class="relative w-full" style="aspect-ratio: 4 / 3;">

    <!-- Table image -->
    <img
      src="/table-top.png"
      alt=""
      class="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
      draggable="false"
      style="
        filter: drop-shadow(0 20px 48px rgba(0,0,0,0.9)) {isFinal ? 'drop-shadow(0 0 40px rgba(212,175,55,0.4))' : ''};
      "
    />

    <!-- ========== WINNER ANNOUNCEMENT (above table) ========== -->
    {#if winnerPlayer && winners.length > 0}
      <div class="absolute top-[8%] left-1/2 -translate-x-1/2 z-[70] winner-announce pointer-events-none">
        <div
          class="rounded-2xl px-5 py-3 text-center winner-glow-card"
          style="
            background: linear-gradient(180deg, rgba(8,13,36,0.98), rgba(5,8,15,0.98));
            border: 2px solid #d4af37;
            box-shadow: 0 0 40px rgba(212,175,55,0.6), 0 12px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,235,170,0.3);
            min-width: 200px;
          "
        >
          <p class="text-[9px] uppercase tracking-[0.35em] text-gold/80 font-bold mb-1">
            {winners.length > 1 ? 'Winners' : 'Winner'}
          </p>
          <p class="text-xl font-extrabold text-white leading-tight" style="text-shadow: 0 2px 10px rgba(0,0,0,0.9);">
            {winnerDisplayName}
          </p>
          {#if winnerPlayer.handName}
            <p class="text-[12px] text-gold font-bold mt-0.5" style="text-shadow: 0 1px 6px rgba(0,0,0,0.9);">
              {winnerPlayer.handName}
            </p>
          {/if}
          {#if winnerPlayer.payout > 0}
            <p class="text-[18px] font-extrabold text-emerald-400 tabular-nums mt-1" style="text-shadow: 0 0 12px rgba(16,185,129,0.6);">
              +${fmt(winnerPlayer.payout)}
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ========== HAND COMPARISON (top-right corner) ========== -->
    {#if handResult?.showdownPlayers && handResult.showdownPlayers.length > 1 && winners.length > 0}
      <div class="absolute top-[18%] right-[2%] z-[65] comparison-panel">
        <div
          class="rounded-xl p-2 space-y-1"
          style="
            background: rgba(5,8,15,0.94);
            border: 1px solid rgba(212,175,55,0.35);
            backdrop-filter: blur(10px);
            min-width: 140px;
          "
        >
          <p class="text-[8px] uppercase tracking-[0.25em] text-white/40 font-bold px-1">Showdown</p>
          {#each handResult.showdownPlayers as p}
            <div
              class="flex items-center justify-between px-2 py-1 rounded-lg"
              style="
                background: {p.isWinner ? 'linear-gradient(90deg, rgba(244,201,93,0.2), rgba(244,201,93,0.05))' : 'rgba(255,255,255,0.03)'};
                border: 1px solid {p.isWinner ? 'rgba(244,201,93,0.5)' : 'transparent'};
              "
            >
              <span class="text-[10px] font-bold truncate" style="color: {p.isWinner ? '#f4e5a8' : 'rgba(255,255,255,0.6)'};">
                {p.userId === myUserId ? 'You' : (allSeats.find((s: any) => s.seat === p.seat)?.displayName ?? '?')}
              </span>
              <span class="text-[9px] font-mono ml-2 shrink-0" style="color: {p.isWinner ? '#d4af37' : 'rgba(255,255,255,0.4)'};">
                {p.handName}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ========== POT DISPLAY ========== -->
    {#if gameState && totalPot > 0 && winners.length === 0}
      {#if sidePots.length > 1}
        <div class="absolute top-[30%] left-1/2 -translate-x-1/2 z-[25] flex flex-col items-center gap-1">
          {#each sidePots as pot}
            <div
              class="rounded-full pl-1.5 pr-3 py-0.5 flex items-center gap-1.5 pot-glow"
              style="
                background: rgba(0,0,0,0.92);
                border: 1.5px solid {pot.type === 'main' ? '#d4af37' : '#3b82f6'};
                box-shadow: 0 4px 12px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.1);
              "
            >
              <span class="text-[9px] uppercase tracking-widest font-extrabold"
                    style="color: {pot.type === 'main' ? '#d4af37' : '#3b82f6'};">
                {pot.label}
              </span>
              <span class="text-[12px] font-extrabold tabular-nums"
                    style="color: {pot.type === 'main' ? '#d4af37' : '#3b82f6'};">
                ${fmt(pot.amount)}
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="absolute top-[30%] left-1/2 -translate-x-1/2 z-[25]">
          <div
            class="rounded-full pl-1 pr-3.5 py-0.5 flex items-center gap-2 pot-glow"
            style="
              background: linear-gradient(180deg, rgba(0,0,0,0.95), rgba(0,0,0,0.85));
              border: 1.5px solid #d4af37;
              box-shadow: 0 4px 16px rgba(0,0,0,0.9), 0 0 20px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,235,170,0.3);
            "
          >
            <PokerChip amount={totalPot} size={18} />
            <span class="text-[10px] uppercase tracking-widest font-extrabold text-white/60">POT</span>
            <span class="text-[15px] font-extrabold text-gold-gradient tabular-nums">${fmt(totalPot)}</span>
          </div>
        </div>
      {/if}
    {/if}

    <!-- ========== CHIP FLY TO WINNER ========== -->
    {#each chipFlies as fly (fly.id)}
      <div
        class="chip-fly"
        style="
          --from-x: {fly.fromX}%;
          --from-y: {fly.fromY}%;
          --to-x: {fly.toX}%;
          --to-y: {fly.toY}%;
          animation-delay: {fly.delay}s;
        "
      >
        <PokerChip amount={Math.min(totalPot, 100)} size={22} />
      </div>
    {/each}

    <!-- ========== COMMUNITY CARDS ========== -->
    {#if gameState}
      <div class="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2 z-[10]">
        {#each Array(5) as _, i}
          {#if community[i]}
            {@const isWin = isWinningCard(community[i])}
            <div class="relative">
              <PlayingCard
                rank={community[i].r}
                suit={suitChar(community[i].s)}
                size="md"
                dealFrom="top"
                dealDelay={0}
              />
              {#if isWin && winners.length > 0}
                <div class="absolute -inset-1 rounded-lg winning-card-glow pointer-events-none z-[15]"></div>
              {/if}
            </div>
          {:else}
            <div
              class="rounded-[7px]"
              style="
                width: 50px;
                height: 70px;
                background: rgba(0,0,0,0.4);
                border: 1.5px solid rgba(212,175,55,0.12);
                box-shadow: inset 0 3px 8px rgba(0,0,0,0.7);
              "
            ></div>
          {/if}
        {/each}
      </div>
    {/if}
        <!-- ========== OPPONENTS ========== -->
    {#each opponents as s}
      {@const pos = oppPos(s.seat)}
      {@const isTurn = gameState?.currentSeat === s.seat && !s.folded && !s.allIn && winners.length === 0}
      {@const betAmount = s.betThisStreet}
      {@const chipOffset = towardCenter(pos.x, pos.y, 8)}
      {@const isWin = isWinnerSeat(s.seat)}
      {@const isShowdown = inShowdown(s.seat)}
      {@const isShowdownWin = showdownWin(s.seat)}
      {@const isShowdownLose = showdownLose(s.seat)}

      <div
        class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-[20] cursor-pointer"
        style="left: {pos.x}%; top: {pos.y}%;"
        on:click={() => onPlayerClick(s.userId)}
        on:keydown={(e) => e.key === 'Enter' && onPlayerClick(s.userId)}
        role="button"
        tabindex="0"
      >
        <div class="relative">
          {#if isTurn}
            <div class="absolute -inset-[8px] pointer-events-none z-[2]">
              <TimerRing size={72} strokeWidth={4} startedAt={turnStartedAt}
                         limitSec={turnBaseLimit} {serverTime} active={true} color="#3b82f6" />
            </div>
          {/if}

          <div
            class="relative rounded-full p-[3px] {isWin ? 'winner-glow' : ''} {s.allIn && !s.folded ? 'all-in-shake' : ''}"
            style="
              background: linear-gradient(180deg,
                {isWin ? '#f4e5a8' : isTurn ? '#3b82f6' : '#1e3a8a'} 0%,
                {isWin ? '#d4af37' : isTurn ? '#1e3a8a' : '#0f1f3a'} 50%,
                {isWin ? '#a87a15' : isTurn ? '#1e3a8a' : '#05080f'} 100%);
              box-shadow: 0 6px 18px rgba(0,0,0,0.9), {isWin ? '0 0 26px rgba(212,175,55,0.7),' : ''} inset 0 1px 0 rgba(255,255,255,0.2);
              {s.folded ? 'opacity: 0.35; filter: grayscale(0.7);' : ''}
            "
          >
            <div class="relative w-[54px] h-[54px] rounded-full overflow-hidden bg-gradient-to-br from-[#1a3a5c] to-[#05080f] flex items-center justify-center">
              <Avatar avatarId={s.avatarId || 'king'} size="md" />
            </div>
          </div>

          {#if s.folded}
            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-[6]">
              <span
                class="text-[8px] font-extrabold rounded-full px-1.5 py-0.5 whitespace-nowrap border shadow-lg text-white/90 tracking-wider"
                style="background: linear-gradient(180deg, #4b5563, #1f2937); border-color: rgba(255,255,255,0.2);"
              >
                FOLD
              </span>
            </div>
          {/if}

          {#if s.allIn && !s.folded}
            <div class="absolute -top-2 left-1/2 -translate-x-1/2 z-[6]">
              <span
                class="text-[8px] font-extrabold rounded-full px-2 py-0.5 whitespace-nowrap border shadow-lg text-white tracking-wider animate-pulse"
                style="background: linear-gradient(180deg, #ef4444, #991b1b); border-color: #fca5a5; box-shadow: 0 0 12px rgba(239,68,68,0.7);"
              >
                ALL-IN
              </span>
            </div>
          {/if}

          {#if gameState?.dealerSeat === s.seat}
            <div
              class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px] font-extrabold z-[15]"
              style="
                background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15);
                color: #0a0800;
                box-shadow: 0 2px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.5);
              "
            >
              D
            </div>
          {/if}
        </div>

        <!-- Nameplate -->
        <div
          class="mt-1.5 px-2.5 py-1 flex flex-col items-center relative z-[16]"
          style="
            border-radius: 8px;
            background: linear-gradient(180deg, #f5f5f5 0%, #d4d4d4 100%);
            border: 2px solid {isShowdownWin ? '#10b981' : isShowdownLose ? '#6b7280' : isWin ? '#d4af37' : 'rgba(0,0,0,0.5)'};
            min-width: 78px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.8);
          "
        >
          <p class="text-[10px] font-extrabold text-black leading-none whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis">{s.displayName}</p>
          <p class="text-[11px] font-extrabold leading-tight tabular-nums" style="color: #a87a15;">${fmt(s.stack)}</p>
        </div>

        {#if isShowdown}
          <div
            class="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider z-[20]"
            style="
              background: {isShowdownWin ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #991b1b)'};
              color: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            "
          >
            {isShowdownWin ? '✓ WIN' : '✗ LOSE'}
          </div>
          {#if payoutForSeat(s.seat) > 0 && !gameState?.tournamentId}
            <div class="mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-emerald-300 z-[20]" style="background: rgba(0,0,0,0.85);">
              +${fmt(payoutForSeat(s.seat))}
            </div>
          {/if}
          {#if handName(s.seat)}
            <div class="mt-0.5 text-[9px] font-bold text-white/70 whitespace-nowrap">{handName(s.seat)}</div>
          {/if}
        {/if}

        {#if betAmount > 0 && !s.folded && winners.length === 0}
          <div
            class="absolute -translate-x-1/2 -translate-y-1/2 z-[22] pointer-events-none"
            style="left: {chipOffset.x}%; top: {chipOffset.y}%;"
          >
            <div
              class="flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-0.5"
              style="background: rgba(0,0,0,0.92); border: 1.5px solid rgba(212,175,55,0.6); box-shadow: 0 3px 10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,235,170,0.2);"
            >
              <PokerChip amount={betAmount} size={12} />
              <span class="text-[11px] font-extrabold text-gold-gradient leading-none tabular-nums">${fmt(betAmount)}</span>
            </div>
          </div>
        {/if}
      </div>
    {/each}

    <!-- ========== HERO HOLE CARDS ========== -->
    {#if gameState && mySeat && heroHole.length > 0 && !isEliminated}
      {#key gameState.handNo}
        <div class="absolute top-[72%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center gap-2 z-[30]">
          {#each heroHole as c, i}
            {@const isWinCard = isWinningCard(c)}
            <div class="relative" style="filter: drop-shadow(0 10px 22px rgba(0,0,0,0.9));">
              <PlayingCard
                rank={c.r}
                suit={suitChar(c.s)}
                size="md"
                dealFrom="top-left"
                dealDelay={i * 0.15}
              />
              {#if isWinCard && winners.length > 0}
                <div class="absolute -inset-1 rounded-lg winning-card-glow pointer-events-none z-[15]"></div>
              {/if}
            </div>
          {/each}
        </div>
      {/key}
    {/if}

    <!-- ========== HERO SEAT ========== -->
    {#if gameState && mySeat}
      {@const isWin = isWinnerSeat(mySeat.seat)}
      {@const isShowdown = inShowdown(mySeat.seat)}
      {@const isShowdownWin = showdownWin(mySeat.seat)}
      {@const isShowdownLose = showdownLose(mySeat.seat)}

      <div
        class="absolute top-[97%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-[30] cursor-pointer"
        on:click={() => onPlayerClick(mySeat.userId)}
        on:keydown={(e) => e.key === 'Enter' && onPlayerClick(mySeat.userId)}
        role="button"
        tabindex="0"
      >
        <div class="relative">
          {#if isMyTurn}
            <div class="absolute -inset-[8px] pointer-events-none z-[2]">
              <TimerRing size={84} strokeWidth={4} startedAt={turnStartedAt}
                         limitSec={turnBaseLimit} {serverTime} active={true} color="#3b82f6" />
            </div>
          {/if}

          <div
            class="relative rounded-full p-[3px] {isWin ? 'winner-glow' : ''} {mySeat.allIn && !mySeat.folded ? 'all-in-shake' : ''}"
            style="
              background: linear-gradient(180deg,
                {isWin ? '#f4e5a8' : isMyTurn ? '#3b82f6' : '#1e3a8a'} 0%,
                {isWin ? '#d4af37' : isMyTurn ? '#1e3a8a' : '#0f1f3a'} 50%,
                {isWin ? '#a87a15' : isMyTurn ? '#1e3a8a' : '#05080f'} 100%);
              box-shadow: 0 6px 22px rgba(0,0,0,0.9),
                {isWin ? '0 0 30px rgba(212,175,55,0.8),' : ''}
                {isMyTurn ? '0 0 24px rgba(59,130,246,0.6),' : ''}
                inset 0 1px 0 rgba(255,255,255,0.2);
              {mySeat.folded || isEliminated ? 'opacity: 0.4;' : ''}
            "
          >
            <div class="relative w-[68px] h-[68px] rounded-full overflow-hidden bg-gradient-to-br from-[#1a3a5c] to-[#05080f] flex items-center justify-center">
              <Avatar avatarId={myAvatarId} size="md" />
            </div>
          </div>

          {#if gameState.dealerSeat === mySeat.seat}
            <div
              class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-extrabold z-[15]"
              style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 2px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.5);"
            >
              D
            </div>
          {/if}
        </div>

        <div
          class="mt-2 px-3.5 py-1 flex flex-col items-center relative z-[16]"
          style="
            border-radius: 8px;
            background: linear-gradient(180deg, #f5f5f5 0%, #d4d4d4 100%);
            border: 2px solid {isShowdownWin ? '#10b981' : isShowdownLose ? '#6b7280' : isWin ? '#d4af37' : 'rgba(0,0,0,0.5)'};
            min-width: 92px;
            box-shadow: 0 3px 12px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.8);
          "
        >
          <p class="text-[11px] font-extrabold text-black leading-none">You</p>
          <p class="text-[13px] font-extrabold leading-tight tabular-nums" style="color: #a87a15;">${fmt(mySeat.stack)}</p>
        </div>

        {#if isShowdown}
          <div
            class="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider z-[20]"
            style="
              background: {isShowdownWin ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #991b1b)'};
              color: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            "
          >
            {isShowdownWin ? '✓ WIN' : '✗ LOSE'}
          </div>
          {#if payoutForSeat(mySeat.seat) > 0 && !gameState?.tournamentId}
            <div class="mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold text-emerald-300 z-[20]" style="background: rgba(0,0,0,0.85);">
              +${fmt(payoutForSeat(mySeat.seat))}
            </div>
          {/if}
          {#if handName(mySeat.seat)}
            <div class="mt-0.5 text-[9px] font-bold text-white/70">{handName(mySeat.seat)}</div>
          {/if}
        {/if}

        {#if mySeat.betThisStreet > 0 && !mySeat.folded && winners.length === 0}
          <div class="mt-1 flex items-center gap-1 bg-black/85 rounded-full px-2 py-0.5" style="border: 1px solid rgba(212,175,55,0.5);">
            <PokerChip amount={mySeat.betThisStreet} size={12} />
            <span class="text-[10px] font-bold text-gold-gradient leading-none tabular-nums">${fmt(mySeat.betThisStreet)}</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* ===== WINNER ANNOUNCEMENT ===== */
  @keyframes winner-announce-in {
    0% {
      opacity: 0;
      transform: translate(-50%, -20px) scale(0.85);
    }
    60% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1.05);
    }
    100% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1);
    }
  }
  .winner-announce {
    animation: winner-announce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes winner-glow-card-kf {
    0%, 100% {
      box-shadow: 0 0 40px rgba(212,175,55,0.6), 0 12px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,235,170,0.3);
    }
    50% {
      box-shadow: 0 0 70px rgba(212,175,55,1), 0 12px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,235,170,0.5);
    }
  }
  .winner-glow-card {
    animation: winner-glow-card-kf 1.6s ease-in-out infinite;
  }

  /* ===== COMPARISON PANEL ===== */
  @keyframes comparison-in {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .comparison-panel {
    animation: comparison-in 0.4s ease-out 0.2s both;
  }

  /* ===== CHIP FLY ===== */
  @keyframes chip-fly-kf {
    0% {
      left: var(--from-x);
      top: var(--from-y);
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
    }
    15% {
      opacity: 1;
    }
    50% {
      left: calc((var(--from-x) + var(--to-x)) / 2);
      top: calc((var(--from-y) + var(--to-y)) / 2 - 15%);
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.3) rotate(180deg);
    }
    100% {
      left: var(--to-x);
      top: var(--to-y);
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.6) rotate(360deg);
    }
  }
  .chip-fly {
    position: absolute;
    z-index: 55;
    pointer-events: none;
    animation: chip-fly-kf 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* ===== WINNING CARD GLOW ===== */
  @keyframes winning-card-glow-kf {
    0%, 100% {
      box-shadow: 0 0 10px rgba(244,201,93,0.7), 0 0 0 2px rgba(244,201,93,0.9);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 28px rgba(244,201,93,1), 0 0 0 3px rgba(244,201,93,1);
      transform: scale(1.05);
    }
  }
  .winning-card-glow {
    animation: winning-card-glow-kf 1.4s ease-in-out infinite;
    border-radius: 8px;
  }

  /* ===== WINNER AVATAR GLOW ===== */
  @keyframes winner-glow-pulse {
    0%, 100% {
      filter: drop-shadow(0 0 6px rgba(244,201,93,0.6));
      transform: scale(1);
    }
    50% {
      filter: drop-shadow(0 0 22px rgba(244,201,93,1)) drop-shadow(0 0 40px rgba(212,175,55,0.6));
      transform: scale(1.06);
    }
  }
  :global(.winner-glow) {
    animation: winner-glow-pulse 1.4s ease-in-out infinite;
  }

  /* ===== ALL-IN SHAKE ===== */
  @keyframes all-in-shake-kf {
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-2px); }
    30% { transform: translateX(2px); }
    45% { transform: translateX(-2px); }
    60% { transform: translateX(2px); }
    75% { transform: translateX(-1px); }
  }
  :global(.all-in-shake) {
    animation: all-in-shake-kf 0.6s ease-in-out infinite;
  }

  /* ===== POT GLOW ===== */
  @keyframes pot-glow-kf {
    0%, 100% {
      filter: drop-shadow(0 0 6px rgba(244,201,93,0.5));
    }
    50% {
      filter: drop-shadow(0 0 14px rgba(244,201,93,0.9));
    }
  }
  :global(.pot-glow) {
    animation: pot-glow-kf 1.6s ease-in-out infinite;
  }
</style>
