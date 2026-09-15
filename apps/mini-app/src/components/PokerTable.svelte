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

  $: feltGradient = theme === 'tournament'
    ? 'radial-gradient(ellipse at 50% 45%, #5b21b6 0%, #3b0764 55%, #1e1b4b 100%)'
    : 'radial-gradient(ellipse at 50% 45%, #1a5c3a 0%, #0d3d24 55%, #072a1a 100%)';
  $: rimColor = '#050a0a';

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  const ANGLE_MAP: Record<number, number[]> = {
    1: [270],
    2: [225, 315],
    3: [200, 270, 340],
    4: [180, 230, 310, 0],
    5: [180, 220, 270, 320, 0],
    6: [180, 215, 250, 290, 325, 0],
  };

  function seatPos(idx: number, total: number): { x: number; y: number } {
    const angles = ANGLE_MAP[total] || ANGLE_MAP[6];
    const deg = angles[idx] ?? 270;
    const rad = (deg * Math.PI) / 180;
    const rx = total >= 6 ? 40 : 42;
    const ry = total >= 6 ? 36 : 38;
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

  // ============================================================
  // Derived
  // ============================================================
  $: allSeats = gameState?.seats ?? [];
  $: mySeat = allSeats.find((s: any) => s.userId === myUserId) ?? null;
  $: opponents = allSeats.filter((s: any) => s.userId !== myUserId);
  $: isMyTurn = !!(
    gameState &&
    mySeat &&
    gameState.currentSeat === mySeat.seat &&
    !mySeat.folded &&
    !mySeat.allIn
  );
  $: totalPot = gameState?.pot ?? 0;
  $: community = gameState?.community ?? [];
  $: serverTime = gameState?.serverTime ?? Date.now();
  $: turnStartedAt = gameState?.turnStartedAt ?? 0;
  $: turnBaseLimit = gameState?.turnBaseLimit ?? 30;

  $: winners = gameState?.winners ?? [];
  $: isSplitPot = winners.length > 1;
  $: sidePots = gameState?.sidePots ?? [];

  // ============================================================
  // WIN / LOSE data (from handResult at showdown)
  // ============================================================
  $: showdownData = (() => {
    if (!winners || winners.length === 0) return null;
    if (!handResult?.showdownPlayers) return null;

    const map: Record<number, { isWinner: boolean; handName: string; payout: number; best: any[] }> = {};
    for (const p of handResult.showdownPlayers) {
      map[p.seat] = {
        isWinner: !!p.isWinner,
        handName: p.handName || '',
        payout: p.payout || 0,
        best: p.best || [],
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

  // ============================================================
  // Winner animation (chip fly)
  // ============================================================
  let chipVisible = false;
  let chipLeft = 50;
  let chipTop = 26;
  let lastAnimatedHandNo = -1;

  $: if (winners.length > 0 && gameState?.handNo !== lastAnimatedHandNo) {
    lastAnimatedHandNo = gameState.handNo;
    const winnerSeat = winners[0];
    const winnerData = allSeats.find((s: any) => s.seat === winnerSeat);

    if (winnerData) {
      chipVisible = true;
      chipLeft = 50;
      chipTop = 26;

      setTimeout(() => {
        if (winnerData.userId === myUserId) {
          chipLeft = 50;
          chipTop = 92;
        } else {
          const idx = opponents.findIndex((s: any) => s.seat === winnerSeat);
          if (idx >= 0) {
            const pos = seatPos(idx, opponents.length);
            chipLeft = pos.x;
            chipTop = pos.y - 10;
          }
        }
      }, 80);

      setTimeout(() => { chipVisible = false; }, 2000);
    }
  }
</script>

<div class="absolute left-1/2 -translate-x-1/2 w-[92%] max-w-[420px]" style="top: 43%; transform: translate(-50%, -50%);">
  <div class="relative w-full" style="aspect-ratio: 1 / 1.15;">

    <!-- Outer rim -->
    <div
      class="absolute -inset-3 rounded-[50%]"
      style="
        background: {rimColor};
        box-shadow: 0 10px 40px rgba(0,0,0,0.95), inset 0 0 30px rgba(0,0,0,0.9),
          0 0 0 2px rgba(30,41,59,0.6), 0 0 0 6px rgba(0,0,0,0.5);
      "
    ></div>

    <div class="absolute -inset-1 rounded-[50%]" style="background: linear-gradient(180deg, rgba(255,255,255,0.08), transparent 30%, transparent 70%, rgba(255,255,255,0.04));"></div>

    <!-- Felt -->
    <div class="absolute inset-0 rounded-[50%] overflow-hidden" style="background: {feltGradient};">
      <div class="absolute inset-0 rounded-[50%]" style="box-shadow: inset 0 0 80px rgba(0,0,0,0.7);"></div>
      <div class="absolute inset-0 rounded-[50%] opacity-30" style="background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.2), transparent 55%);"></div>
    </div>

    <!-- ============ POT ============ -->
    {#if gameState && totalPot > 0 && winners.length === 0}
      {#if sidePots.length > 1}
        <div class="absolute top-[20%] left-1/2 -translate-x-1/2 z-[30] flex flex-col items-center gap-1">
          {#each sidePots as pot}
            <div class="rounded-full px-3 py-0.5 flex items-center gap-1.5" style="background: #000; border: 2px solid {pot.type === 'main' ? '#d97706' : '#0891b2'}; box-shadow: 0 4px 12px rgba(0,0,0,0.9);">
              <span class="text-[9px] uppercase tracking-widest font-extrabold {pot.type === 'main' ? 'text-amber-400/80' : 'text-cyan-400/80'}">{pot.label}</span>
              <span class="text-[12px] font-extrabold {pot.type === 'main' ? 'text-amber-400' : 'text-cyan-400'} tabular-nums">${fmt(pot.amount)}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="absolute top-[22%] left-1/2 -translate-x-1/2 z-[30]">
          <div class="rounded-full px-4 py-1 flex items-center gap-2" style="background: #000; border: 2px solid #d97706; box-shadow: 0 4px 16px rgba(0,0,0,0.9), 0 0 16px rgba(217,119,6,0.2);">
            <span class="text-[10px] uppercase tracking-widest font-extrabold text-white/80">POT</span>
            <span class="text-[14px] font-extrabold text-amber-400 tabular-nums">${fmt(totalPot)}</span>
          </div>
        </div>
      {/if}
    {/if}

    <!-- ============ Community Cards (ALWAYS visible) ============ -->
    {#if gameState}
      <div class="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5 z-10">
        {#each Array(5) as _, i}
          {#if community[i]}
            <PlayingCard rank={community[i].r} suit={suitChar(community[i].s)} size="md" />
          {:else}
            <div class="w-11 h-[60px] rounded-md bg-black/30 border border-white/5"></div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- ============ Opponents ============ -->
    {#if gameState}
      {#each opponents as s, i}
        {@const pos = seatPos(i, opponents.length)}
        {@const isTurn = gameState.currentSeat === s.seat && !s.folded && !s.allIn}
        {@const showCards = s.revealed && s.hole && s.hole.length > 0}
        {@const betAmount = s.betThisStreet}
        {@const chipOffset = towardCenter(pos.x, pos.y, 10)}
        {@const isWin = isWinnerSeat(s.seat)}
        {@const isShowdown = inShowdown(s.seat)}
        {@const isShowdownWin = showdownWin(s.seat)}
        {@const isShowdownLose = showdownLose(s.seat)}

        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 pointer-events-none"
          style="left: {pos.x}%; top: {pos.y}%;"
        >
          <div class="relative">
            {#if isTurn}
              <div class="absolute -inset-[6px] pointer-events-none z-[5]">
                <TimerRing
                  size={68}
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
              style="border: 3px solid {isWin ? '#10b981' : (isShowdownLose ? '#6b7280' : (isTurn ? '#f97316' : '#e5e7eb'))}; box-shadow: 0 4px 14px rgba(0,0,0,0.85){isWin ? ', 0 0 20px rgba(16,185,129,0.7)' : ''};"
            >
              <div class="relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center">
                <Avatar avatarId={s.avatarId || 'diamond'} size="md" />
              </div>
            </div>

            {#if s.folded}
              <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/75">
                <span class="text-[8px] font-extrabold text-white">FOLD</span>
              </div>
            {/if}

            {#if gameState.dealerSeat === s.seat}
              <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white text-black text-[9px] font-extrabold flex items-center justify-center shadow-lg border-2 border-black/30 z-[15]">D</div>
            {/if}

            <!-- 🔴 Hole cards near avatar (at showdown) -->
            {#if showCards}
              <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-0.5 z-[45]">
                {#each s.hole as c}
                  <div class="scale-[0.65] origin-top">
                    <PlayingCard rank={c.r} suit={suitChar(c.s)} size="sm" />
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Nameplate -->
          <div
            class="mt-5 px-2.5 py-1 bg-white flex flex-col items-center relative z-[40]"
            style="border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.9); border: 2px solid {isShowdownWin ? '#10b981' : (isShowdownLose ? '#ef4444' : 'rgba(0,0,0,0.3)')}; min-width: 76px;"
          >
            <p class="text-[10px] font-extrabold text-black leading-none whitespace-nowrap max-w-[100px] overflow-hidden text-ellipsis">{s.displayName}</p>
            <p class="text-[10px] font-extrabold text-amber-600 leading-tight tabular-nums mt-0.5">${fmt(s.stack)}</p>
          </div>

          <!-- 🔴 WIN / LOSE badge (like reference) -->
          {#if isShowdown}
            <div
              class="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold z-[45]"
              style="background: {isShowdownWin ? '#10b981' : '#ef4444'}; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"
            >
              {#if isShowdownWin}
                <span>✓ WIN</span>
              {:else}
                <span>✗ LOSE</span>
              {/if}
            </div>
            {#if payoutForSeat(s.seat) > 0}
              <div class="mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-emerald-300 z-[45]" style="background: rgba(0,0,0,0.85);">
                +${fmt(payoutForSeat(s.seat))}
              </div>
            {/if}
            {#if handName(s.seat)}
              <div class="mt-0.5 text-[9px] font-bold text-white/70">{handName(s.seat)}</div>
            {/if}
          {/if}

          {#if betAmount > 0 && !s.folded && winners.length === 0}
            <div
              class="absolute -translate-x-1/2 -translate-y-1/2 z-[35] pointer-events-none"
              style="left: {chipOffset.x}%; top: {chipOffset.y}%;"
            >
              <div class="flex items-center gap-1.5 rounded-full px-2.5 py-1 border-2 border-amber-500/60" style="background: rgba(0,0,0,0.92);">
                <PokerChip amount={betAmount} size={14} />
                <span class="text-[12px] font-extrabold text-amber-400 leading-none tabular-nums">${fmt(betAmount)}</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    {/if}

    <!-- ============ Chip Fly ============ -->
    {#if chipVisible}
      <div
        class="absolute pointer-events-none z-[55] transition-all duration-[1800ms] ease-out"
        style="left: {chipLeft}%; top: {chipTop}%; transform: translate(-50%,-50%);"
      >
        <div class="drop-shadow-[0_0_24px_rgba(251,191,36,0.9)]">
          <PokerChip amount={totalPot} size={28} />
        </div>
      </div>
    {/if}

    <!-- ============ Hero Cards ============ -->
    {#if gameState && mySeat && mySeat.hole && mySeat.hole.length > 0 && !isEliminated}
      <div class="absolute top-[68%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center gap-2 z-30">
        {#each mySeat.hole as c}
          <div class="drop-shadow-[0_6px_16px_rgba(0,0,0,0.95)]">
            <PlayingCard rank={c.r} suit={suitChar(c.s)} size="lg" />
          </div>
        {/each}
      </div>
    {/if}

    <!-- ============ Hero Avatar ============ -->
    {#if gameState && mySeat}
      {@const isWin = isWinnerSeat(mySeat.seat)}
      {@const isShowdown = inShowdown(mySeat.seat)}
      {@const isShowdownWin = showdownWin(mySeat.seat)}
      {@const isShowdownLose = showdownLose(mySeat.seat)}

      <div class="absolute top-[92%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30">
        <div class="relative">
          {#if isMyTurn}
            <div class="absolute -inset-[6px] pointer-events-none z-[5]">
              <TimerRing
                size={76}
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
            class="relative rounded-full p-[3px] bg-black {mySeat.folded || isEliminated ? 'opacity-40' : ''}"
            style="border: 3px solid {isWin ? '#10b981' : (isShowdownLose ? '#6b7280' : (isMyTurn ? '#f97316' : '#e5e7eb'))}; box-shadow: 0 4px 18px rgba(0,0,0,0.9){isWin ? ', 0 0 26px rgba(16,185,129,0.7)' : ''};"
          >
            <div class="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center">
              <Avatar avatarId={myAvatarId} size="md" />
            </div>
          </div>

          {#if gameState.dealerSeat === mySeat.seat}
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-black text-[11px] font-extrabold flex items-center justify-center shadow-lg border-2 border-gray-400 z-[15]">D</div>
          {/if}
        </div>

        <div class="mt-3 px-3 py-1 bg-white flex flex-col items-center relative z-[50]" style="border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.9); border: 2px solid {isShowdownWin ? '#10b981' : (isShowdownLose ? '#ef4444' : 'rgba(0,0,0,0.3)')}; min-width: 86px;">
          <p class="text-[11px] font-extrabold text-black leading-none">You</p>
          <p class="text-[12px] font-extrabold text-amber-600 leading-tight tabular-nums mt-0.5">${fmt(mySeat.stack)}</p>
        </div>

        {#if isShowdown}
          <div
            class="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold z-[50]"
            style="background: {isShowdownWin ? '#10b981' : '#ef4444'}; color: white;"
          >
            {isShowdownWin ? '✓ WIN' : '✗ LOSE'}
          </div>
          {#if payoutForSeat(mySeat.seat) > 0}
            <div class="mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold text-emerald-300 z-[50]" style="background: rgba(0,0,0,0.85);">
              +${fmt(payoutForSeat(mySeat.seat))}
            </div>
          {/if}
          {#if handName(mySeat.seat)}
            <div class="mt-0.5 text-[9px] font-bold text-white/70">{handName(mySeat.seat)}</div>
          {/if}
        {/if}

        {#if mySeat.betThisStreet > 0 && !mySeat.folded && winners.length === 0}
          <div class="mt-1 flex items-center gap-1 bg-black/85 rounded-full px-2 py-0.5 border border-amber-500/50">
            <PokerChip amount={mySeat.betThisStreet} size={12} />
            <span class="text-[10px] font-bold text-amber-400 leading-none tabular-nums">${fmt(mySeat.betThisStreet)}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ============ Table Info + Seed ============ -->
    <div class="absolute top-[4%] left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none w-full px-2">
      {#if gameState}
        <p class="text-[9px] uppercase tracking-widest font-bold text-white/35">
          {gameState?.variant === 'omaha4' ? "OMAHA 4" : gameState?.variant === 'omaha5' ? "OMAHA 5" : "HOLD'EM"}
        </p>
        <p class="text-[10px] font-mono text-white/30 tabular-nums leading-none mt-0.5">
          {gameState.phase ?? 'PREFLOP'} · Hand #{gameState.handNo ?? 0}
        </p>
      {/if}
    </div>
  </div>
</div>

{#if gameState && theme === 'tournament'}
  <div class="absolute top-14 left-0 right-0 z-20 flex flex-col items-center gap-1 pointer-events-none">
    <div class="rounded-full px-3 py-0.5 flex items-center gap-2" style="background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.1);">
      <span class="text-[9px] font-bold text-white/60">🎫</span>
      <span class="text-[10px] font-bold text-white/90 truncate max-w-[140px]">{tournamentTitle}</span>
    </div>
  </div>
{/if}

<style>
  .animate-winner-pulse {
    animation: winnerPulse 1.2s ease-in-out infinite;
  }
  @keyframes winnerPulse {
    0%, 100% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.08); filter: brightness(1.2); }
  }
</style>