<script lang="ts">
  import PlayingCard from './PlayingCard.svelte';
  import PokerChip from './PokerChip.svelte';
  import Avatar from './Avatar.svelte';
  import TimerRing from './TimerRing.svelte';

  export let gameState: any = null;
  export let myUserId: number | null = null;
  export let myAvatarId: string = 'spade';
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

  const BASE_ANGLES: Record<number, number[]> = {
    2: [90, 270],
    3: [90, 210, 330],
    4: [90, 180, 270, 0],
    5: [90, 162, 234, 306, 18],
    6: [90, 150, 210, 270, 330, 30],
  };

  function seatPos(rotatedIdx: number, total: number): { x: number; y: number } {
    const angles = BASE_ANGLES[total] || BASE_ANGLES[6];
    const deg = angles[rotatedIdx] ?? 90;
    const rad = (deg * Math.PI) / 180;
    const rx = total === 2 ? 38 : 44;
    const ry = total === 2 ? 34 : 34;
    return {
      x: 50 + Math.cos(rad) * rx,
      y: 50 + Math.sin(rad) * ry,
    };
  }

  function towardCenter(px: number, py: number, dist: number): { x: number; y: number } {
    const dx = 50 - px;
    const dy = 50 - py;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: (dx / len) * dist, y: (dy / len) * dist };
  }

  $: allSeats = gameState?.seats ?? [];
  $: totalSeats = allSeats.length;
  $: heroIdx = allSeats.findIndex((s: any) => s.userId === myUserId);
  $: mySeat = heroIdx >= 0 ? allSeats[heroIdx] : null;
  $: opponents = allSeats.filter((s: any) => s.userId !== myUserId);

  $: isMyTurn = !!(
    gameState &&
    mySeat &&
    gameState.currentSeat === mySeat.seat &&
    !mySeat.folded &&
    !mySeat.allIn &&
    winners.length === 0
  );

  $: totalPot = gameState?.pot ?? 0;
  $: community = gameState?.community ?? [];
  $: serverTime = gameState?.serverTime ?? Date.now();
  $: turnStartedAt = gameState?.turnStartedAt ?? 0;
  $: turnBaseLimit = gameState?.turnBaseLimit ?? 30;

  $: winners = gameState?.winners ?? [];
  $: sidePots = gameState?.sidePots ?? [];

  function oppPos(opponentSeatIdx: number): { x: number; y: number } {
    if (heroIdx < 0) return { x: 50, y: 10 };
    const rotated = (opponentSeatIdx - heroIdx + totalSeats) % totalSeats;
    return seatPos(rotated, totalSeats);
  }

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

  let chipVisible = false;
  let chipLeft = 50;
  let chipTop = 40;
  let lastAnimatedHandNo = -1;

  $: if (winners.length > 0 && gameState?.handNo !== lastAnimatedHandNo) {
    lastAnimatedHandNo = gameState.handNo;
    const winnerSeat = winners[0];
    const winnerData = allSeats.find((s: any) => s.seat === winnerSeat);

    if (winnerData && winnerData.userId !== myUserId) {
      const pos = oppPos(winnerData.seat);
      chipVisible = true;
      chipLeft = 50;
      chipTop = 30;
      setTimeout(() => {
        chipLeft = pos.x;
        chipTop = pos.y + 6;
      }, 80);
      setTimeout(() => {
        chipVisible = false;
      }, 2000);
    } else {
      chipVisible = true;
      chipLeft = 50;
      chipTop = 30;
      setTimeout(() => {
        chipLeft = 50;
        chipTop = 88;
      }, 80);
      setTimeout(() => {
        chipVisible = false;
      }, 2000);
    }
  }
</script>

<div
  class="absolute left-1/2 -translate-x-1/2 w-[94%] max-w-[430px]"
  style="top: 46%; transform: translate(-50%, -50%);"
>
  <div class="relative w-full" style="aspect-ratio: 1 / 1.12;">
    <div
      class="absolute -inset-2 rounded-[50%] {isFinalTable ? 'felt-rim-final' : 'felt-rim'}"
    ></div>

    <div class="absolute inset-0 rounded-[50%] overflow-hidden felt-cash">
      <div
        class="absolute inset-0 rounded-[50%]"
        style="box-shadow: inset 0 0 80px rgba(0,0,0,0.75), inset 0 4px 12px rgba(255,255,255,0.06);"
      ></div>
      <div
        class="absolute inset-0 rounded-[50%] opacity-40"
        style="background: radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.15), transparent 55%);"
      ></div>
    </div>

    {#if gameState && totalPot > 0 && winners.length === 0}
      {#if sidePots.length > 1}
        <div
          class="absolute top-[33%] left-1/2 -translate-x-1/2 z-[25] flex flex-col items-center gap-1"
        >
          {#each sidePots as pot}
            <div
              class="rounded-full px-3 py-0.5 flex items-center gap-1.5"
              style="background: rgba(0,0,0,0.92); border: 1.5px solid {pot.type === 'main'
                ? '#f4c95d'
                : '#22d3ee'}; box-shadow: 0 4px 12px rgba(0,0,0,0.9);"
            >
              <span
                class="text-[9px] uppercase tracking-widest font-extrabold {pot.type === 'main'
                  ? 'text-gold'
                  : 'text-cyan'}"
              >
                {pot.label}
              </span>
              <span
                class="text-[12px] font-extrabold {pot.type === 'main'
                  ? 'text-gold'
                  : 'text-cyan'} tabular-nums"
              >
                ${fmt(pot.amount)}
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="absolute top-[33%] left-1/2 -translate-x-1/2 z-[25]">
          <div
            class="rounded-full pl-1.5 pr-3.5 py-0.5 flex items-center gap-2"
            style="background: rgba(0,0,0,0.92); border: 1.5px solid #f4c95d; box-shadow: 0 4px 16px rgba(0,0,0,0.9), 0 0 16px rgba(244,201,93,0.25);"
          >
            <PokerChip amount={totalPot} size={16} />
            <span class="text-[10px] uppercase tracking-widest font-extrabold text-white/70">
              POT
            </span>
            <span class="text-[14px] font-extrabold text-gold tabular-nums">
              ${fmt(totalPot)}
            </span>
          </div>
        </div>
      {/if}
    {/if}

    {#if gameState}
      <div class="absolute top-[49%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 z-[8]">
        {#each Array(5) as _, i}
          {#if community[i]}
            <PlayingCard rank={community[i].r} suit={suitChar(community[i].s)} size="md" />
          {:else}
            <div class="w-11 h-[60px] rounded-md bg-black/25 border border-white/5"></div>
          {/if}
        {/each}
      </div>
    {/if}

    {#each opponents as s}
      {@const pos = oppPos(s.seat)}
      {@const isTurn =
        gameState?.currentSeat === s.seat && !s.folded && !s.allIn && winners.length === 0}
      {@const showCards = s.revealed && s.hole && s.hole.length > 0}
      {@const betAmount = s.betThisStreet}
      {@const chipOffset = towardCenter(pos.x, pos.y, 9)}
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
            <div class="absolute -inset-[7px] pointer-events-none z-[2]">
              <TimerRing
                size={70}
                strokeWidth={4}
                startedAt={turnStartedAt}
                limitSec={turnBaseLimit}
                {serverTime}
                active={true}
                color="#f97316"
              />
            </div>
          {/if}

          <div
            class="relative rounded-full p-[3px] bg-black {s.folded ? 'opacity-40' : ''}"
            style="border: 3px solid {isWin
              ? '#f4c95d'
              : isShowdownLose
                ? '#4b5563'
                : isTurn
                  ? '#f97316'
                  : 'rgba(255,255,255,0.85)'}; box-shadow: 0 4px 14px rgba(0,0,0,0.9){isWin
              ? ', 0 0 22px rgba(244,201,93,0.7)'
              : ''};"
          >
            <div
              class="relative w-[52px] h-[52px] rounded-full overflow-hidden bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center"
            >
              <Avatar avatarId={s.avatarId || 'diamond'} size="md" />
            </div>
          </div>

          {#if s.folded}
            <div
              class="absolute inset-0 flex items-center justify-center rounded-full bg-black/75 z-[3]"
            >
              <span class="text-[8px] font-extrabold text-white/90 tracking-wider">FOLD</span>
            </div>
          {/if}

          {#if s.allIn && !s.folded}
            <div class="absolute -top-2 left-1/2 -translate-x-1/2 z-[6]">
              <span
                class="text-[8px] font-extrabold bg-red-600 rounded-full px-2 py-0.5 whitespace-nowrap border border-red-400 shadow-lg text-white tracking-wider"
              >
                ALL-IN
              </span>
            </div>
          {/if}

          {#if gameState?.dealerSeat === s.seat}
            <div
              class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-extrabold z-[15] badge-gold"
            >
              D
            </div>
          {/if}
        </div>

        <div
          class="mt-2 px-2.5 py-0.5 bg-soft-white flex flex-col items-center relative z-[16] shadow-lg"
          style="border-radius: 6px; border: 2px solid {isShowdownWin
            ? '#10b981'
            : isShowdownLose
              ? '#6b7280'
              : 'rgba(0,0,0,0.35)'}; min-width: 72px;"
        >
          <p
            class="text-[10px] font-extrabold text-black leading-none whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis"
          >
            {s.displayName}
          </p>
          <p class="text-[10px] font-extrabold text-amber-600 leading-tight tabular-nums">
            ${fmt(s.stack)}
          </p>
        </div>

        {#if isShowdown}
          <div
            class="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider z-[20]"
            style="background: {isShowdownWin
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #ef4444, #991b1b)'}; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.6);"
          >
            {isShowdownWin ? '✓ WIN' : '✗ LOSE'}
          </div>
          {#if payoutForSeat(s.seat) > 0 && !gameState?.tournamentId}
            <div
              class="mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-emerald-300 z-[20]"
              style="background: rgba(0,0,0,0.85);"
            >
              +${fmt(payoutForSeat(s.seat))}
            </div>
          {/if}
          {#if handName(s.seat)}
            <div class="mt-0.5 text-[9px] font-bold text-white/70 whitespace-nowrap">
              {handName(s.seat)}
            </div>
          {/if}
        {/if}

        {#if betAmount > 0 && !s.folded && winners.length === 0}
          <div
            class="absolute -translate-x-1/2 -translate-y-1/2 z-[22] pointer-events-none"
            style="left: {chipOffset.x}%; top: {chipOffset.y}%;"
          >
            <div
              class="flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-0.5"
              style="background: rgba(0,0,0,0.92); border: 1.5px solid rgba(244,201,93,0.55);"
            >
              <PokerChip amount={betAmount} size={12} />
              <span class="text-[11px] font-extrabold text-gold leading-none tabular-nums">
                ${fmt(betAmount)}
              </span>
            </div>
          </div>
        {/if}
      </div>
    {/each}

    {#if chipVisible}
      <div
        class="absolute pointer-events-none z-[60] transition-all duration-[1800ms] ease-out"
        style="left: {chipLeft}%; top: {chipTop}%; transform: translate(-50%,-50%);"
      >
        <div class="drop-shadow-[0_0_24px_rgba(244,201,93,0.9)]">
          <PokerChip amount={totalPot} size={28} />
        </div>
      </div>
    {/if}

    {#if gameState && mySeat && mySeat.hole && mySeat.hole.length > 0 && !isEliminated}
      <div
        class="absolute top-[68%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center gap-2 z-[30]"
      >
        {#each mySeat.hole as c}
          <div class="drop-shadow-[0_8px_20px_rgba(0,0,0,0.95)]">
            <PlayingCard rank={c.r} suit={suitChar(c.s)} size="lg" />
          </div>
        {/each}
      </div>
    {/if}

    {#if gameState && mySeat}
      {@const isWin = isWinnerSeat(mySeat.seat)}
      {@const isShowdown = inShowdown(mySeat.seat)}
      {@const isShowdownWin = showdownWin(mySeat.seat)}
      {@const isShowdownLose = showdownLose(mySeat.seat)}

      <div
        class="absolute top-[92%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-[30] cursor-pointer"
        on:click={() => onPlayerClick(mySeat.userId)}
        on:keydown={(e) => e.key === 'Enter' && onPlayerClick(mySeat.userId)}
        role="button"
        tabindex="0"
      >
        <div class="relative">
          {#if isMyTurn}
            <div class="absolute -inset-[7px] pointer-events-none z-[2]">
              <TimerRing
                size={78}
                strokeWidth={4}
                startedAt={turnStartedAt}
                limitSec={turnBaseLimit}
                {serverTime}
                active={true}
                color="#f97316"
              />
            </div>
          {/if}

          <div
            class="relative rounded-full p-[3px] bg-black {mySeat.folded || isEliminated
              ? 'opacity-40'
              : ''}"
            style="border: 3px solid {isWin
              ? '#f4c95d'
              : isShowdownLose
                ? '#4b5563'
                : isMyTurn
                  ? '#f97316'
                  : 'rgba(255,255,255,0.9)'}; box-shadow: 0 4px 18px rgba(0,0,0,0.9){isWin
              ? ', 0 0 26px rgba(244,201,93,0.8)'
              : ''};"
          >
            <div
              class="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center"
            >
              <Avatar avatarId={myAvatarId} size="md" />
            </div>
          </div>

          {#if gameState.dealerSeat === mySeat.seat}
            <div
              class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold z-[15] badge-gold"
            >
              D
            </div>
          {/if}
        </div>

        <div
          class="mt-3 px-3 py-0.5 bg-soft-white flex flex-col items-center relative z-[16] shadow-xl"
          style="border-radius: 6px; border: 2px solid {isShowdownWin
            ? '#10b981'
            : isShowdownLose
              ? '#6b7280'
              : 'rgba(0,0,0,0.35)'}; min-width: 86px;"
        >
          <p class="text-[11px] font-extrabold text-black leading-none">You</p>
          <p class="text-[12px] font-extrabold text-amber-600 leading-tight tabular-nums">
            ${fmt(mySeat.stack)}
          </p>
        </div>

        {#if isShowdown}
          <div
            class="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider z-[20]"
            style="background: {isShowdownWin
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #ef4444, #991b1b)'}; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.6);"
          >
            {isShowdownWin ? '✓ WIN' : '✗ LOSE'}
          </div>
          {#if payoutForSeat(mySeat.seat) > 0 && !gameState?.tournamentId}
            <div
              class="mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold text-emerald-300 z-[20]"
              style="background: rgba(0,0,0,0.85);"
            >
              +${fmt(payoutForSeat(mySeat.seat))}
            </div>
          {/if}
          {#if handName(mySeat.seat)}
            <div class="mt-0.5 text-[9px] font-bold text-white/70">
              {handName(mySeat.seat)}
            </div>
          {/if}
        {/if}

        {#if mySeat.betThisStreet > 0 && !mySeat.folded && winners.length === 0}
          <div
            class="mt-1 flex items-center gap-1 bg-black/85 rounded-full px-2 py-0.5 border border-gold/50"
          >
            <PokerChip amount={mySeat.betThisStreet} size={12} />
            <span class="text-[10px] font-bold text-gold leading-none tabular-nums">
              ${fmt(mySeat.betThisStreet)}
            </span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
