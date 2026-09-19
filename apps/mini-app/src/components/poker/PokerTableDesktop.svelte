<script lang="ts">
  import PlayerSeat from './PlayerSeat.svelte';
  import PlayingCard from '../PlayingCard.svelte';
  import PokerChip from '../PokerChip.svelte';

  export let gameState: any = null;
  export let myUserId: number | null = null;
  export let myAvatarId: string = 'king';
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

  // ============================================================
  // ANGLES — hero at 90° (bottom center), others counter-clockwise
  // ============================================================
  const ANGLES: Record<number, number[]> = {
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
    const angles = ANGLES[total] || ANGLES[6];
    const deg = angles[rotatedIdx] ?? 90;
    const rad = (deg * Math.PI) / 180;
    // Ellipse radii — leave room for panels & cards
    const rx = 40;
    const ry = 32;
    return { x: 50 + Math.cos(rad) * rx, y: 50 + Math.sin(rad) * ry };
  }

  // Offset a given position toward the table center by N pixels
  function offsetTowardCenter(pos: { x: number; y: number }, px: number): { x: string; y: string } {
    const dx = 50 - pos.x;
    const dy = 50 - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: `calc(${pos.x}% + ${(dx / dist) * px}px)`,
      y: `calc(${pos.y}% + ${(dy / dist) * px}px)`,
    };
  }

  // Size based on total players
  function playerSize(total: number): 'sm' | 'md' | 'lg' | 'xl' {
    if (total <= 3) return 'xl';
    if (total <= 5) return 'lg';
    if (total <= 7) return 'md';
    return 'sm';
  }

  // ============================================================
  // REACTIVE
  // ============================================================
  $: allSeats = gameState?.seats ?? [];
  $: totalSeats = allSeats.length;
  $: pSize = playerSize(totalSeats);

  $: heroIdx = allSeats.findIndex((s: any) => Number(s.userId) === Number(myUserId));
  $: mySeat = heroIdx >= 0 ? allSeats[heroIdx] : (allSeats[0] ?? null);
  $: heroSeatNumber = mySeat?.seat ?? 0;
  $: opponents = allSeats.filter((_: any, i: number) => i !== (heroIdx >= 0 ? heroIdx : 0));

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

  $: community = (gameState?.community && gameState.community.length > 0)
    ? gameState.community
    : (handResult?.communityCards ?? []);

  $: heroShowdownPlayer = handResult?.showdownPlayers?.find(
    (p: any) => p.seat === mySeat?.seat
  );
  $: heroHole = (mySeat?.hole && mySeat.hole.length > 0)
    ? mySeat.hole
    : (heroShowdownPlayer?.hole ?? []);

  $: serverTime = gameState?.serverTime ?? Date.now();
  $: turnStartedAt = gameState?.turnStartedAt ?? 0;
  $: turnBaseLimit = gameState?.turnBaseLimit ?? 30;

  function oppPos(seatNumber: number): { x: number; y: number } {
    const rotated = ((seatNumber - heroSeatNumber + totalSeats) % totalSeats + totalSeats) % totalSeats;
    return seatPos(rotated, totalSeats);
  }

  $: showdownData = (() => {
    if (!winners || winners.length === 0) return null;
    if (!handResult?.showdownPlayers) return null;
    const map: Record<number, { isWinner: boolean; handName: string; payout: number }> = {};
    for (const p of handResult.showdownPlayers) {
      map[p.seat] = { isWinner: !!p.isWinner, handName: p.handName || '', payout: p.payout || 0 };
    }
    return map;
  })();

  function isWinnerSeat(seat: number): boolean { return winners.includes(seat); }
  function inShowdown(seat: number): boolean { return !!(showdownData && showdownData[seat]); }
  function showdownWin(seat: number): boolean { return !!(showdownData && showdownData[seat]?.isWinner); }
  function showdownLose(seat: number): boolean { return !!(showdownData && showdownData[seat] && !showdownData[seat].isWinner); }
  function payoutForSeat(seat: number): number { return showdownData?.[seat]?.payout ?? 0; }

  function oppHole(seat: number): any[] {
    if (!handResult?.showdownPlayers) return [];
    const p = handResult.showdownPlayers.find((x: any) => x.seat === seat);
    return p?.hole ?? [];
  }

  // ===== Winner announcement =====
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
</script>

<div
  class="absolute left-1/2 -translate-x-1/2 w-full max-w-[720px] px-2"
  style="top: 44%; transform: translate(-50%, -50%);"
>
  <div class="relative w-full" style="aspect-ratio: 16 / 10;">
    <!-- Table image -->
    <img
      src="/table-top-desktop.webp"
      alt=""
      class="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      draggable="false"
      style="filter: drop-shadow(0 20px 48px rgba(0,0,0,0.9)) {isFinalTable ? 'drop-shadow(0 0 40px rgba(212,175,55,0.4))' : ''};"
    />

    <!-- ========== WINNER ANNOUNCEMENT ========== -->
    {#if winnerPlayer && winners.length > 0}
      <div class="absolute left-1/2 -translate-x-1/2 z-[70] pointer-events-none" style="top: 2%;">
        <div
          class="rounded-2xl px-5 py-2 text-center winner-glow-card"
          style="
            background: linear-gradient(180deg, rgba(8,13,36,0.98), rgba(5,8,15,0.98));
            border: 2px solid #d4af37;
            min-width: 180px;
          "
        >
          <p class="text-[8px] uppercase tracking-[0.3em] text-gold/80 font-bold mb-0.5">
            {winners.length > 1 ? 'Winners' : 'Winner'}
          </p>
          <p class="text-base font-extrabold text-white leading-tight">
            {winnerDisplayName}
          </p>
          {#if winnerPlayer.handName && handResult?.showdownPlayers?.filter((p: any) => p.hole?.length > 0).length > 1}
            <p class="text-[11px] text-gold font-bold">{winnerPlayer.handName}</p>
          {:else}
            <p class="text-[10px] text-white/70 font-bold">wins the pot</p>
          {/if}
          {#if winnerPlayer.payout > 0}
            <p class="text-[15px] font-extrabold text-emerald-400 tabular-nums mt-0.5">
              +${fmt(winnerPlayer.payout)}
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ========== POT ========== -->
    {#if gameState && totalPot > 0 && winners.length === 0}
      <div class="absolute left-1/2 -translate-x-1/2 z-[15]" style="top: 24%;">
        <div
          class="rounded-full pl-1.5 pr-3 py-0.5 flex items-center gap-1.5 pot-glow"
          style="
            background: linear-gradient(180deg, rgba(0,0,0,0.95), rgba(0,0,0,0.85));
            border: 1.5px solid #d4af37;
            box-shadow: 0 3px 14px rgba(0,0,0,0.9), 0 0 16px rgba(212,175,55,0.3);
          "
        >
          <PokerChip amount={totalPot} size={14} />
          <span class="text-[9px] uppercase tracking-widest font-extrabold text-white/60">POT</span>
          <span class="text-[14px] font-extrabold text-gold-gradient tabular-nums">${fmt(totalPot)}</span>
        </div>
      </div>
    {/if}

    <!-- ========== CENTER LOGO ========== -->
    <div
      class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] pointer-events-none flex flex-col items-center"
      style="top: 33%;"
    >
      <img
        src="/logo-flop-club.png"
        alt=""
        class="object-contain select-none"
        style="width: 36px; height: 36px; opacity: 0.32;"
        draggable="false"
      />
      <p
        class="font-extrabold select-none mt-0.5"
        style="font-family: 'Sora', sans-serif; font-size: 7px; letter-spacing: 0.35em; color: rgba(212,175,55,0.45); padding-left: 0.35em;"
      >
        FLOP CLUB
      </p>
    </div>

    <!-- ========== COMMUNITY CARDS ========== -->
    {#if gameState}
      <div class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5 z-[10]" style="top: 47%;">
        {#each Array(5) as _, i}
          {#if community[i]}
            {@const isWinCard = isWinningCard(community[i])}
            <div class="relative">
              <PlayingCard
                rank={community[i].r}
                suit={suitChar(community[i].s)}
                size="md"
                dealFrom="top"
                dealDelay={0}
              />
              {#if isWinCard && winners.length > 0}
                <div class="absolute -inset-0.5 rounded-md winning-card-glow pointer-events-none z-[15]"></div>
              {/if}
            </div>
          {:else}
            <div
              class="rounded-md"
              style="
                width: 50px; height: 70px;
                background: rgba(0,0,0,0.4);
                border: 1px solid rgba(212,175,55,0.12);
                box-shadow: inset 0 2px 6px rgba(0,0,0,0.7);
              "
            ></div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- ========== OPPONENTS ========== -->
    {#each opponents as s}
      {@const pos = oppPos(s.seat)}
      {@const towardCenter = pos.x < 50 ? 'left' : 'right'}
      {@const isTurn = gameState?.currentSeat === s.seat && !s.folded && !s.allIn && winners.length === 0}
      {@const isWin = isWinnerSeat(s.seat)}
      {@const isShowdown = inShowdown(s.seat)}
      {@const isShowdownWin = showdownWin(s.seat)}
      {@const isShowdownLose = showdownLose(s.seat)}
      <!-- Use panelSide based on position: if player is on the RIGHT half, panel to the LEFT (so panel is toward center) -->
      {@const panelSide = pos.x > 50 ? 'left' : 'right'}

      <div
        class="absolute -translate-x-1/2 -translate-y-1/2 z-[20]"
        style="left: {pos.x}%; top: {pos.y}%;"
      >
        <PlayerSeat
          player={s}
          {myUserId}
          isHero={false}
          isDealer={gameState?.dealerSeat === s.seat}
          {isTurn}
          {isWin}
          {isShowdown}
          {isShowdownWin}
          {isShowdownLose}
          handName={showdownData?.[s.seat]?.handName ?? ''}
          payout={payoutForSeat(s.seat)}
          holeCards={oppHole(s.seat)}
          {turnStartedAt}
          {turnBaseLimit}
          {serverTime}
          size={pSize}
          cardsAbove={true}
          {panelSide}
          onClick={() => onPlayerClick(s.userId)}
        />
      </div>
    {/each}

    <!-- ========== HERO ========== -->
    {#if gameState && mySeat && !isEliminated}
      {@const isWin = isWinnerSeat(mySeat.seat)}
      {@const isShowdown = inShowdown(mySeat.seat)}
      {@const isShowdownWin = showdownWin(mySeat.seat)}
      {@const isShowdownLose = showdownLose(mySeat.seat)}

      <div
        class="absolute left-1/2 -translate-x-1/2 z-[30]"
        style="top: 88%;"
      >
        <!-- Hero cards (bigger, shown ABOVE hero panel) -->
        {#if heroHole.length > 0}
          {#key gameState.handNo}
            <div class="flex justify-center gap-1.5 mb-1" style="filter: drop-shadow(0 8px 18px rgba(0,0,0,0.9));">
              {#each heroHole as c, i}
                {@const isWinCard = isWinningCard(c)}
                <div class="relative">
                  <PlayingCard
                    rank={c.r}
                    suit={suitChar(c.s)}
                    size="md"
                    dealFrom="top-left"
                    dealDelay={i * 0.15}
                  />
                  {#if isWinCard && winners.length > 0}
                    <div class="absolute -inset-0.5 rounded-md winning-card-glow pointer-events-none z-[15]"></div>
                  {/if}
                </div>
              {/each}
            </div>
          {/key}
        {/if}

        <div class="-translate-y-1/2">
          <PlayerSeat
            player={mySeat}
            {myUserId}
            isHero={true}
            {myAvatarId}
            isDealer={gameState?.dealerSeat === mySeat.seat}
            isTurn={isMyTurn}
            {isWin}
            {isShowdown}
            {isShowdownWin}
            {isShowdownLose}
            handName={showdownData?.[mySeat.seat]?.handName ?? ''}
            payout={payoutForSeat(mySeat.seat)}
            holeCards={[]}
            {turnStartedAt}
            {turnBaseLimit}
            {serverTime}
            size={pSize}
            cardsAbove={false}
            panelSide="right"
            onClick={() => onPlayerClick(mySeat.userId)}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes winner-glow-card-kf {
    0%, 100% { box-shadow: 0 0 30px rgba(212,175,55,0.6); }
    50% { box-shadow: 0 0 55px rgba(212,175,55,1); }
  }
  .winner-glow-card { animation: winner-glow-card-kf 1.6s ease-in-out infinite; }

  @keyframes winning-card-glow-kf {
    0%, 100% { box-shadow: 0 0 10px rgba(244,201,93,0.7), 0 0 0 2px rgba(244,201,93,0.9); transform: scale(1); }
    50% { box-shadow: 0 0 28px rgba(244,201,93,1), 0 0 0 3px rgba(244,201,93,1); transform: scale(1.05); }
  }
  .winning-card-glow { animation: winning-card-glow-kf 1.4s ease-in-out infinite; border-radius: 6px; }

  @keyframes pot-glow-kf {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(244,201,93,0.5)); }
    50% { filter: drop-shadow(0 0 14px rgba(244,201,93,0.9)); }
  }
  :global(.pot-glow) { animation: pot-glow-kf 1.6s ease-in-out infinite; }
</style>