<script lang="ts">
  import PlayingCard from './PlayingCard.svelte';
  import PokerChip from './PokerChip.svelte';
  import PlayerSeat from './poker/PlayerSeat.svelte';

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
    const num = Number(n || 0);
    if (num === Math.floor(num)) return String(Math.floor(num));
    return num.toFixed(2);
  }

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  // ============================================================
  // ADAPTIVE SIZES
  // ============================================================
  type Sizes = {
    avatar: number;
    nameW: number;
    nameFont: number;
    stackFont: number;
    betChip: number;
    betFont: number;
    cardSize: 'xs' | 'sm' | 'md';
    potTop: number;
    potFont: number;
    timerExtra: number;
  };

  function getSizes(total: number): Sizes {
    if (total <= 2)
      return { avatar: 62, nameW: 88, nameFont: 11, stackFont: 11, betChip: 14, betFont: 10, cardSize: 'md', potTop: 28, potFont: 14, timerExtra: 14 };
    if (total === 3)
      return { avatar: 58, nameW: 84, nameFont: 11, stackFont: 11, betChip: 14, betFont: 10, cardSize: 'md', potTop: 28, potFont: 14, timerExtra: 12 };
    if (total === 4)
      return { avatar: 52, nameW: 78, nameFont: 10, stackFont: 10, betChip: 12, betFont: 9, cardSize: 'md', potTop: 28, potFont: 13, timerExtra: 12 };
    if (total === 5)
      return { avatar: 48, nameW: 72, nameFont: 10, stackFont: 10, betChip: 12, betFont: 9, cardSize: 'sm', potTop: 28, potFont: 13, timerExtra: 10 };
    if (total === 6)
      return { avatar: 44, nameW: 68, nameFont: 10, stackFont: 9, betChip: 12, betFont: 9, cardSize: 'sm', potTop: 28, potFont: 12, timerExtra: 10 };
    if (total === 7)
      return { avatar: 40, nameW: 62, nameFont: 9, stackFont: 9, betChip: 10, betFont: 8, cardSize: 'sm', potTop: 28, potFont: 12, timerExtra: 8 };
    return { avatar: 38, nameW: 58, nameFont: 9, stackFont: 9, betChip: 10, betFont: 8, cardSize: 'sm', potTop: 28, potFont: 12, timerExtra: 8 };
  }

  // ============================================================
  // SEAT POSITION — HERO at bottom, others counter-clockwise
  // ============================================================
  function seatPos(rotatedIdx: number, total: number): { x: number; y: number } {
    const angleDeg = 90 + (rotatedIdx * 360) / total;
    const rad = (angleDeg * Math.PI) / 180;
    const rx = 42;
    const ry = 37;
    return {
      x: 50 + Math.cos(rad) * rx,
      y: 50 + Math.sin(rad) * ry,
    };
  }

  // Bet chip offset — outside the player seat, toward center
    function betPos(pos: { x: number; y: number }, S: Sizes): { x: string; y: string } {
    const dx = 50 - pos.x;
    const dy = 50 - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    // Side players push further toward center
    const isHorizontal = Math.abs(ux) > Math.abs(uy);
    const offPx = isHorizontal
      ? S.avatar / 2 + 60
      : S.avatar / 2 + 32;

    return {
      x: `calc(${pos.x}% + ${ux * offPx}px)`,
      y: `calc(${pos.y}% + ${uy * offPx}px)`,
    };
  }

  // ============================================================
  // REACTIVE
  // ============================================================
  $: allSeats = gameState?.seats ?? [];
  $: totalSeats = allSeats.length;
  $: S = getSizes(totalSeats);
  $: pSize = ((totalSeats <= 3 ? 'xl' : totalSeats <= 5 ? 'lg' : totalSeats <= 7 ? 'md' : 'sm') as 'sm' | 'md' | 'lg' | 'xl');

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

  $: winnerPlayer = handResult?.showdownPlayers?.find((p: any) => p.isWinner);
  $: winnerIsMe = winnerPlayer?.userId === myUserId;
  $: winnerDisplayName = winnerIsMe ? 'You' : (() => {
    const s = allSeats.find((x: any) => x.seat === winnerPlayer?.seat);
    return s?.displayName || 'Winner';
  })();

  $: winningCardKeys = new Set(
    (winnerPlayer?.bestCards ?? []).map((c: any) => `${c.r}${c.s}`)
  );
  function isWinningCard(c: any): boolean {
    return winningCardKeys.has(`${c.r}${c.s}`);
  }

  // ===== Chip fly =====
  let chipFlies: { id: number; fromX: number; fromY: number; toX: number; toY: number; delay: number }[] = [];
  let chipFlyIdCounter = 0;

  $: if (winners.length > 0 && totalPot > 0) {
    const flies: typeof chipFlies = [];
    for (const winnerSeat of winners) {
      const winnerSeatInfo = allSeats.find((s: any) => s.seat === winnerSeat);
      if (!winnerSeatInfo) continue;

      let toX = 50, toY = 50;
      if (winnerSeat === mySeat?.seat) {
        toX = 50; toY = 88;
      } else {
        const pos = oppPos(winnerSeat);
        toX = pos.x; toY = pos.y;
      }

      const payout = showdownData?.[winnerSeat]?.payout ?? 0;
      if (payout > 0) {
        flies.push({
          id: ++chipFlyIdCounter,
          fromX: 50, fromY: S.potTop,
          toX, toY,
          delay: 0.3,
        });
      }
    }
    chipFlies = flies;
  } else {
    chipFlies = [];
  }

  function shortName(name: string): string {
    if (!name) return '?';
    return name;
  }

  $: isFinal = isFinalTable;
</script>

<!-- ============================================================
     CONTAINER — 16:10 landscape
     ============================================================ -->
<div
  class="absolute left-1/2 -translate-x-1/2 w-full px-3"
  style="
    top: 45%;
    transform: translate(-50%, -50%);
    max-width: min(1100px, calc((100dvh - 300px) * 1.6));
  "
>
>
  <div class="relative w-full" style="aspect-ratio: 16 / 10;">

    <!-- Table image -->
    <img
      src="/table-top-desktop.webp"
      alt=""
      class="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
      draggable="false"
      style="filter: drop-shadow(0 20px 48px rgba(0,0,0,0.9)) {isFinal ? 'drop-shadow(0 0 40px rgba(212,175,55,0.4))' : ''};"
    />

    <!-- ========== WINNER ANNOUNCEMENT ========== -->
    {#if winnerPlayer && winners.length > 0}
      <div class="absolute left-1/2 -translate-x-1/2 z-[70] winner-announce pointer-events-none" style="top: 2%;">
        <div
          class="rounded-xl px-3 py-1.5 text-center winner-glow-card"
          style="
            background: linear-gradient(180deg, rgba(8,13,36,0.98), rgba(5,8,15,0.98));
            border: 1.5px solid #d4af37;
            min-width: 140px;
          "
        >
          <p class="text-[7px] uppercase tracking-[0.3em] text-gold/80 font-bold mb-0.5">
            {winners.length > 1 ? 'Winners' : 'Winner'}
          </p>
          <p class="text-sm font-extrabold text-white leading-tight">
            {winnerDisplayName}
          </p>
          {#if winnerPlayer.handName && handResult?.showdownPlayers?.filter((p: any) => p.hole?.length > 0).length > 1}
            <p class="text-[10px] text-gold font-bold">{winnerPlayer.handName}</p>
          {:else}
            <p class="text-[9px] text-white/70 font-bold">wins the pot</p>
          {/if}
          {#if winnerPlayer.payout > 0}
            <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums">
              +${fmt(winnerPlayer.payout)}
            </p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ========== HAND COMPARISON ========== -->
    {#if handResult?.showdownPlayers && handResult.showdownPlayers.length > 1 && winners.length > 0 && handResult.showdownPlayers.filter((p: any) => p.hole?.length > 0).length > 1}
      <div class="absolute top-[3%] right-[2%] z-[65] comparison-panel">
        <div
          class="rounded-lg p-1 space-y-0.5"
          style="background: rgba(5,8,15,0.94); border: 1px solid rgba(212,175,55,0.35); backdrop-filter: blur(10px); min-width: 120px;"
        >
          <p class="text-[7px] uppercase tracking-[0.2em] text-white/40 font-bold px-1">Showdown</p>
          {#each handResult.showdownPlayers as p}
            <div
              class="flex items-center justify-between px-1.5 py-0.5 rounded-md"
              style="
                background: {p.isWinner ? 'linear-gradient(90deg, rgba(244,201,93,0.2), rgba(244,201,93,0.05))' : 'transparent'};
                border: 1px solid {p.isWinner ? 'rgba(244,201,93,0.5)' : 'transparent'};
              "
            >
              <span class="text-[8px] font-bold truncate" style="color: {p.isWinner ? '#f4e5a8' : 'rgba(255,255,255,0.6)'};">
                {p.userId === myUserId ? 'You' : shortName(allSeats.find((s: any) => s.seat === p.seat)?.displayName ?? '?')}
              </span>
              <span class="text-[7px] font-mono ml-1 shrink-0" style="color: {p.isWinner ? '#d4af37' : 'rgba(255,255,255,0.4)'};">
                {p.handName}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ========== POT ========== -->
    {#if gameState && totalPot > 0 && winners.length === 0}
      {#if sidePots.length > 1}
        <div class="absolute left-1/2 -translate-x-1/2 z-[15] flex flex-col items-center gap-0.5" style="top: {S.potTop}%;">
          {#each sidePots as pot}
            <div
              class="rounded-full pl-1.5 pr-2.5 py-0.5 flex items-center gap-1"
              style="background: rgba(0,0,0,0.92); border: 1.5px solid {pot.type === 'main' ? '#d4af37' : '#3b82f6'};"
            >
              <span class="text-[7px] uppercase tracking-widest font-extrabold" style="color: {pot.type === 'main' ? '#d4af37' : '#3b82f6'};">
                {pot.label}
              </span>
              <span class="text-[9px] font-extrabold tabular-nums" style="color: {pot.type === 'main' ? '#d4af37' : '#3b82f6'};">
                ${fmt(pot.amount)}
              </span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="absolute left-1/2 -translate-x-1/2 z-[15]" style="top: {S.potTop}%;">
          <div
            class="rounded-full px-3 py-0.5 flex items-center gap-2"
            style="
              background: linear-gradient(180deg, rgba(0,0,0,0.95), rgba(0,0,0,0.85));
              border: 1.5px solid #d4af37;
              box-shadow: 0 3px 14px rgba(0,0,0,0.9), 0 0 16px rgba(212,175,55,0.3);
            "
          >
            <span class="text-[8px] uppercase tracking-widest font-extrabold text-gold/70">POT</span>
            <span class="font-black text-gold tabular-nums" style="font-size: {S.potFont}px;">
              ${fmt(totalPot)}
            </span>
          </div>
        </div>
      {/if}
    {/if}

    <!-- ========== CENTER LOGO (below community cards) ========== -->
    <div
      class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] pointer-events-none"
      style="top: 60%;"
    >
      <img
        src="/logo-flop-club.png"
        alt=""
        class="object-contain select-none"
        style="width: 56px; height: 56px; opacity: 0.6;"
        draggable="false"
      />
    </div>

    <!-- ========== CHIP FLY ========== -->
    {#each chipFlies as fly (fly.id)}
      <div
        class="chip-fly"
        style="--from-x: {fly.fromX}%; --from-y: {fly.fromY}%; --to-x: {fly.toX}%; --to-y: {fly.toY}%; animation-delay: {fly.delay}s;"
      >
        <PokerChip amount={Math.min(totalPot, 100)} size={18} />
      </div>
    {/each}

    <!-- ========== COMMUNITY CARDS ========== -->
    {#if gameState}
      <div class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 z-[10]" style="top: 46%;">
        {#each Array(5) as _, i}
          {#if community[i]}
            {@const isWinCard = isWinningCard(community[i])}
            <div class="relative">
              <PlayingCard rank={community[i].r} suit={suitChar(community[i].s)} size={S.cardSize} dealFrom="top" dealDelay={0} />
              {#if isWinCard && winners.length > 0}
                <div class="absolute -inset-0.5 rounded-md winning-card-glow pointer-events-none z-[15]"></div>
              {/if}
            </div>
          {:else}
            <div
              class="rounded-md"
              style="
                width: {S.cardSize === 'md' ? 50 : 34}px;
                height: {S.cardSize === 'md' ? 70 : 48}px;
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
      {@const bPos = betPos(pos, S)}
      {@const panelSide = pos.x > 50 ? 'left' : 'right'}
      {@const isTurn = gameState?.currentSeat === s.seat && !s.folded && !s.allIn && winners.length === 0}
      {@const betAmount = s.betThisStreet}
      {@const isWin = isWinnerSeat(s.seat)}
      {@const isShowdown = inShowdown(s.seat)}
      {@const isShowdownWin = showdownWin(s.seat)}
      {@const isShowdownLose = showdownLose(s.seat)}
      {@const hole = (() => {
        if (!handResult?.showdownPlayers) return [];
        const p = handResult.showdownPlayers.find((x: any) => x.seat === s.seat);
        return p?.hole ?? [];
      })()}

      <!-- PLAYER SEAT -->
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
          isWinner={isWin}
          {isShowdown}
          {isShowdownWin}
          {isShowdownLose}
          handName={showdownData?.[s.seat]?.handName ?? ''}
          payout={payoutForSeat(s.seat)}
          holeCards={hole}
          {turnStartedAt}
          {turnBaseLimit}
          {serverTime}
          size={pSize}
          cardsAbove={pos.y < 50}
          {panelSide}
          onClick={() => onPlayerClick(s.userId)}
        />
      </div>

      <!-- BET CHIP -->
      {#if betAmount > 0 && !s.folded && winners.length === 0}
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 z-[22] pointer-events-none chip-enter"
          style="left: {bPos.x}; top: {bPos.y};"
        >
          <div
            class="flex items-center justify-center rounded-full"
            style="
              height: 20px;
              min-width: 30px;
              padding: 0 8px;
              background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 55%, #a87a15 100%);
              box-shadow:
                0 2px 6px rgba(0,0,0,0.9),
                inset 0 1px 0 rgba(255,255,255,0.6),
                inset 0 -1px 0 rgba(0,0,0,0.3);
              border: 1px solid rgba(122,86,10,0.9);
            "
          >
            <span
              class="font-black text-black tabular-nums leading-none"
              style="font-size: 10px; letter-spacing: -0.02em;"
            >
              {fmt(betAmount)}
            </span>
          </div>
        </div>
      {/if}
    {/each}

    <!-- ========== HERO SEAT ========== -->
    {#if gameState && mySeat}
      {@const isWin = isWinnerSeat(mySeat.seat)}
      {@const isShowdown = inShowdown(mySeat.seat)}
      {@const isShowdownWin = showdownWin(mySeat.seat)}
      {@const isShowdownLose = showdownLose(mySeat.seat)}

      <div
        class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[30]"
        style="top: 86%;"
      >
        <!-- Hero hole cards (bigger, shown ABOVE hero panel) -->
        {#if heroHole.length > 0 && !isEliminated}
          {#key gameState.handNo}
            <div class="flex justify-center gap-1 mb-1" style="filter: drop-shadow(0 6px 14px rgba(0,0,0,0.9));">
              {#each heroHole as c, i}
                {@const isWinCard = isWinningCard(c)}
                <div class="relative">
                  <PlayingCard rank={c.r} suit={suitChar(c.s)} size={S.cardSize} dealFrom="top-left" dealDelay={i * 0.15} />
                  {#if isWinCard && winners.length > 0}
                    <div class="absolute -inset-0.5 rounded-md winning-card-glow pointer-events-none z-[15]"></div>
                  {/if}
                </div>
              {/each}
            </div>
          {/key}
        {/if}

        <PlayerSeat
          player={mySeat}
          {myUserId}
          isHero={true}
          heroAvatarId={myAvatarId}
          isDealer={gameState?.dealerSeat === mySeat.seat}
          isTurn={isMyTurn}
          isWinner={isWin}
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

        <!-- Hero bet chip -->
        {#if mySeat.betThisStreet > 0 && !mySeat.folded && winners.length === 0}
          <div class="mt-1 flex justify-center chip-enter">
            <div
              class="flex items-center justify-center rounded-full"
              style="
                height: 20px;
                min-width: 30px;
                padding: 0 8px;
                background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 55%, #a87a15 100%);
                box-shadow:
                  0 2px 6px rgba(0,0,0,0.9),
                  inset 0 1px 0 rgba(255,255,255,0.6),
                  inset 0 -1px 0 rgba(0,0,0,0.3);
                border: 1px solid rgba(122,86,10,0.9);
              "
            >
              <span
                class="font-black text-black tabular-nums leading-none"
                style="font-size: 10px; letter-spacing: -0.02em;"
              >
                {fmt(mySeat.betThisStreet)}
              </span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes chip-enter-kf {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
    60% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  .chip-enter { animation: chip-enter-kf 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

@keyframes winner-announce-in {
    0% { opacity: 0; transform: translate(-50%, -20px) scale(0.85); }
    60% { opacity: 1; transform: translate(-50%, 0) scale(1.05); }
    100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  }
  .winner-announce { animation: winner-announce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

  @keyframes winner-glow-card-kf {
    0%, 100% { box-shadow: 0 0 30px rgba(212,175,55,0.6); }
    50% { box-shadow: 0 0 55px rgba(212,175,55,1); }
  }
  .winner-glow-card { animation: winner-glow-card-kf 1.6s ease-in-out infinite; }

  @keyframes comparison-in {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .comparison-panel { animation: comparison-in 0.4s ease-out 0.2s both; }

  @keyframes chip-fly-kf {
    0% { left: var(--from-x); top: var(--from-y); opacity: 0; transform: translate(-50%, -50%) scale(0.5) rotate(0deg); }
    15% { opacity: 1; }
    50% { left: calc((var(--from-x) + var(--to-x)) / 2); top: calc((var(--from-y) + var(--to-y)) / 2 - 10%); opacity: 1; transform: translate(-50%, -50%) scale(1.3) rotate(180deg); }
    100% { left: var(--to-x); top: var(--to-y); opacity: 0; transform: translate(-50%, -50%) scale(0.6) rotate(360deg); }
  }
  .chip-fly {
    position: absolute; z-index: 55; pointer-events: none;
    animation: chip-fly-kf 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes winning-card-glow-kf {
    0%, 100% { box-shadow: 0 0 10px rgba(244,201,93,0.7), 0 0 0 2px rgba(244,201,93,0.9); transform: scale(1); }
    50% { box-shadow: 0 0 28px rgba(244,201,93,1), 0 0 0 3px rgba(244,201,93,1); transform: scale(1.05); }
  }
  .winning-card-glow { animation: winning-card-glow-kf 1.4s ease-in-out infinite; border-radius: 6px; }


</style>