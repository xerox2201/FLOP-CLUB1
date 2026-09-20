<script lang="ts">
  import { onMount } from 'svelte';
  import PlayingCard from '../PlayingCard.svelte';
  import PokerChip from '../PokerChip.svelte';
  import PlayerSeat from './PlayerSeat.svelte';

  export let gameState: any = null;
  export let myUserId: number | null = null;
  export let myAvatarId: string = 'king';
  export let theme: 'cash' | 'tournament' = 'cash';
  export let tournamentTitle: string = '';
  export let isEliminated: boolean = false;
  export let handResult: any = null;
  export let isFinalTable: boolean = false;
  export let onPlayerClick: (userId: number) => void = () => {};

  // ============================================================
  // SEAT LAYOUTS — percentages of TABLE container
  // index 0 = hero (always bottom), indices 1..N-1 = opponents CCW
  // ============================================================
  const SEAT_LAYOUTS: Record<number, { x: number; y: number }[]> = {
    2: [
      { x: 50, y: 91 },
      { x: 50, y: 9 },
    ],
    3: [
      { x: 50, y: 91 },
      { x: 16, y: 25 },
      { x: 84, y: 25 },
    ],
    4: [
      { x: 50, y: 91 },
      { x: 12, y: 55 },
      { x: 50, y: 8 },
      { x: 88, y: 55 },
    ],
    5: [
      { x: 50, y: 91 },
      { x: 12, y: 67 },
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 88, y: 67 },
    ],
    6: [
      { x: 50, y: 91 },
      { x: 13, y: 68 },
      { x: 14, y: 30 },
      { x: 50, y: 8 },
      { x: 86, y: 30 },
      { x: 87, y: 68 },
    ],
    7: [
      { x: 50, y: 91 },
      { x: 12, y: 73 },
      { x: 13, y: 42 },
      { x: 25, y: 13 },
      { x: 75, y: 13 },
      { x: 87, y: 42 },
      { x: 88, y: 73 },
    ],
    8: [
      { x: 50, y: 91 },
      { x: 11, y: 76 },
      { x: 12, y: 52 },
      { x: 15, y: 25 },
      { x: 50, y: 8 },
      { x: 85, y: 25 },
      { x: 88, y: 52 },
      { x: 89, y: 76 },
    ],
    9: [
      { x: 50, y: 91 },
      { x: 11, y: 78 },
      { x: 12, y: 59 },
      { x: 13, y: 38 },
      { x: 22, y: 16 },
      { x: 50, y: 7 },
      { x: 78, y: 16 },
      { x: 87, y: 38 },
      { x: 88, y: 59 },
    ],
  };

  function getLayout(total: number): { x: number; y: number }[] {
    return SEAT_LAYOUTS[total] || SEAT_LAYOUTS[6];
  }

  // ============================================================
  // FELT SIZE — JS-computed, portrait 9:16
  // ============================================================
  let wrapperEl: HTMLDivElement;
  let feltW = 0;
  let feltH = 0;

  function computeFelt() {
    if (!wrapperEl) return;
    const availW = wrapperEl.clientWidth;
    const availH = wrapperEl.clientHeight;
    if (availW <= 0 || availH <= 0) return;
    const ratio = 9 / 16;
    if (availW / ratio <= availH) {
      feltW = availW;
      feltH = Math.round(availW / ratio);
    } else {
      feltH = availH;
      feltW = Math.round(availH * ratio);
    }
  }

  onMount(() => {
    computeFelt();
    const ro = new ResizeObserver(computeFelt);
    if (wrapperEl) ro.observe(wrapperEl);
    return () => ro.disconnect();
  });

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
      return { avatar: 60, nameW: 84, nameFont: 11, stackFont: 11, betChip: 14, betFont: 10, cardSize: 'sm', potTop: 41, potFont: 15, timerExtra: 14 };
    if (total === 3)
      return { avatar: 52, nameW: 78, nameFont: 10, stackFont: 10, betChip: 12, betFont: 9,  cardSize: 'sm', potTop: 41, potFont: 13, timerExtra: 12 };
    if (total === 4)
      return { avatar: 46, nameW: 70, nameFont: 10, stackFont: 10, betChip: 11, betFont: 9,  cardSize: 'sm', potTop: 41, potFont: 12, timerExtra: 10 };
    if (total === 5)
      return { avatar: 40, nameW: 64, nameFont: 9,  stackFont: 9,  betChip: 10, betFont: 8,  cardSize: 'xs', potTop: 41, potFont: 11, timerExtra: 8  };
    if (total === 6)
      return { avatar: 36, nameW: 60, nameFont: 9,  stackFont: 9,  betChip: 10, betFont: 8,  cardSize: 'xs', potTop: 41, potFont: 11, timerExtra: 8  };
    if (total === 7)
      return { avatar: 34, nameW: 56, nameFont: 8,  stackFont: 8,  betChip: 9,  betFont: 7,  cardSize: 'xs', potTop: 41, potFont: 10, timerExtra: 6  };
    return { avatar: 32, nameW: 52, nameFont: 8,  stackFont: 8,  betChip: 9,  betFont: 7,  cardSize: 'xs', potTop: 41, potFont: 10, timerExtra: 6  };
  }

  // ============================================================
  // BET POSITION — 42% along player→center vector
  // ============================================================
  function betPos(pos: { x: number; y: number }): { x: string; y: string } {
    const dx = 50 - pos.x;
    const dy = 50 - pos.y;
    return { x: `${pos.x + dx * 0.28}%`, y: `${pos.y + dy * 0.28}%` };
  }

  $: allSeats = gameState?.seats ?? [];
  $: totalSeats = allSeats.length;
  $: S = getSizes(totalSeats);
  $: pSize = ((totalSeats <= 2 ? 'lg' : totalSeats <= 4 ? 'md' : 'sm') as 'sm' | 'md' | 'lg' | 'xl');
  $: layout = getLayout(totalSeats);

  // Static positions
  $: heroPos    = { x: 50, y: 91 };
  $: heroCardsY = 82;
  $: potY       = 41;
  $: boardY     = 49;
  $: logoY      = 62;

  $: heroIdx = allSeats.findIndex((s: any) => Number(s.userId) === Number(myUserId));
  $: heroArrayIdx = heroIdx >= 0 ? heroIdx : 0;
  $: mySeat = allSeats[heroArrayIdx] ?? null;
  $: opponents = allSeats
    .map((s: any, i: number) => ({ ...s, _arrayIdx: i }))
    .filter((_: any, i: number) => i !== heroArrayIdx);

  // Rotate layout so hero's physical seat maps to layout[0]
  function seatPositionAt(arrayIdx: number): { x: number; y: number } {
    if (totalSeats === 0) return { x: 50, y: 50 };
    const rotated = ((arrayIdx - heroArrayIdx) % totalSeats + totalSeats) % totalSeats;
    return layout[rotated] || { x: 50, y: 50 };
  }

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

  let chipFlies: { id: number; fromX: number; fromY: number; toX: number; toY: number; delay: number }[] = [];
  let chipFlyIdCounter = 0;

  $: if (winners.length > 0 && totalPot > 0) {
    const flies: typeof chipFlies = [];
    for (const winnerSeat of winners) {
      const winnerSeatInfo = allSeats.find((s: any) => s.seat === winnerSeat);
      if (!winnerSeatInfo) continue;
      const winnerArrayIdx = allSeats.findIndex((s: any) => s.seat === winnerSeat);
      let toX = 50, toY = 91;
      if (winnerSeat === mySeat?.seat) {
        toX = 50; toY = 91;
      } else {
        const p = seatPositionAt(winnerArrayIdx);
        toX = p.x; toY = p.y;
      }
      const payout = showdownData?.[winnerSeat]?.payout ?? 0;
      if (payout > 0) {
        flies.push({ id: ++chipFlyIdCounter, fromX: 50, fromY: potY, toX, toY, delay: 0.3 });
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

<div
  bind:this={wrapperEl}
  class="absolute inset-0 flex items-center justify-center"
  style="padding: 110px 6px 210px 6px;"
>
  <div
    class="relative felt"
    style="width: {feltW}px; height: {feltH}px;"
  >
    <!-- Table image -->
    <img
      src="/table-top-mobile.webp"
      alt=""
      class="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
      draggable="false"
      style="filter: drop-shadow(0 16px 40px rgba(0,0,0,0.9)) {isFinal ? 'drop-shadow(0 0 32px rgba(212,175,55,0.4))' : ''};"
    />

    <!-- ========== WINNER ANNOUNCEMENT ========== -->
    {#if winnerPlayer && winners.length > 0}
      <div class="absolute left-1/2 -translate-x-1/2 z-[70] winner-announce pointer-events-none" style="top: 22%;">
        <div
          class="rounded-xl px-3 py-1 text-center winner-glow-card"
          style="background: linear-gradient(180deg, rgba(8,13,36,0.98), rgba(5,8,15,0.98)); border: 1.5px solid #d4af37; min-width: 130px;"
        >
          <p class="text-[7px] uppercase tracking-[0.3em] text-gold/80 font-bold mb-0.5">
            {winners.length > 1 ? 'Winners' : 'Winner'}
          </p>
          <p class="text-[12px] font-extrabold text-white leading-tight">{winnerDisplayName}</p>
          {#if winnerPlayer.handName && handResult?.showdownPlayers?.filter((p: any) => p.hole?.length > 0).length > 1}
            <p class="text-[9px] text-gold font-bold">{winnerPlayer.handName}</p>
          {:else}
            <p class="text-[8px] text-white/70 font-bold">wins the pot</p>
          {/if}
          {#if winnerPlayer.payout > 0}
            <p class="text-[11px] font-extrabold text-emerald-400 tabular-nums">+${fmt(winnerPlayer.payout)}</p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ========== HAND COMPARISON ========== -->
    {#if handResult?.showdownPlayers && handResult.showdownPlayers.length > 1 && winners.length > 0 && handResult.showdownPlayers.filter((p: any) => p.hole?.length > 0).length > 1}
      <div class="absolute top-[1%] right-[2%] z-[65] comparison-panel">
        <div class="rounded-lg p-1 space-y-0.5" style="background: rgba(5,8,15,0.94); border: 1px solid rgba(212,175,55,0.35); backdrop-filter: blur(10px); min-width: 108px;">
          <p class="text-[6px] uppercase tracking-[0.2em] text-white/40 font-bold px-1">Showdown</p>
          {#each handResult.showdownPlayers as p}
            <div class="flex items-center justify-between px-1.5 py-0.5 rounded-md" style="background: {p.isWinner ? 'linear-gradient(90deg, rgba(244,201,93,0.2), rgba(244,201,93,0.05))' : 'transparent'}; border: 1px solid {p.isWinner ? 'rgba(244,201,93,0.5)' : 'transparent'};">
              <span class="text-[7px] font-bold truncate" style="color: {p.isWinner ? '#f4e5a8' : 'rgba(255,255,255,0.6)'};">
                {p.userId === myUserId ? 'You' : shortName(allSeats.find((s: any) => s.seat === p.seat)?.displayName ?? '?')}
              </span>
              <span class="text-[6px] font-mono ml-1 shrink-0" style="color: {p.isWinner ? '#d4af37' : 'rgba(255,255,255,0.4)'};">{p.handName}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ========== POT ========== -->
    {#if gameState && totalPot > 0 && winners.length === 0}
      {#if sidePots.length > 1}
        <div class="absolute left-1/2 -translate-x-1/2 z-[15] flex flex-col items-center gap-0.5" style="top: {potY}%;">
          {#each sidePots as pot}
            <div class="rounded-full pl-1.5 pr-2 py-0.5 flex items-center gap-1" style="background: rgba(0,0,0,0.92); border: 1.5px solid {pot.type === 'main' ? '#d4af37' : '#3b82f6'};">
              <span class="text-[6px] uppercase tracking-widest font-extrabold" style="color: {pot.type === 'main' ? '#d4af37' : '#3b82f6'};">{pot.label}</span>
              <span class="text-[8px] font-extrabold tabular-nums" style="color: {pot.type === 'main' ? '#d4af37' : '#3b82f6'};">${fmt(pot.amount)}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="absolute left-1/2 -translate-x-1/2 z-[15]" style="top: {potY}%;">
          <div class="rounded-full px-2.5 py-0.5 flex items-center gap-1.5" style="background: linear-gradient(180deg, rgba(0,0,0,0.95), rgba(0,0,0,0.85)); border: 1.5px solid #d4af37; box-shadow: 0 3px 14px rgba(0,0,0,0.9), 0 0 16px rgba(212,175,55,0.3);">
            <span class="text-[7px] uppercase tracking-widest font-extrabold text-gold/70">POT</span>
            <span class="font-black text-gold tabular-nums" style="font-size: {S.potFont}px;">${fmt(totalPot)}</span>
          </div>
        </div>
      {/if}
    {/if}

    <!-- ========== CENTER LOGO ========== -->
    <div class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] pointer-events-none" style="top: {logoY}%;">
      <img src="/logo-flop-club.png" alt="" class="object-contain select-none" style="width: 40px; height: 40px; opacity: 0.5;" draggable="false" />
    </div>

    <!-- ========== CHIP FLY ========== -->
    {#each chipFlies as fly (fly.id)}
      <div class="chip-fly" style="--from-x: {fly.fromX}%; --from-y: {fly.fromY}%; --to-x: {fly.toX}%; --to-y: {fly.toY}%; animation-delay: {fly.delay}s;">
        <PokerChip amount={Math.min(totalPot, 100)} size={16} />
      </div>
    {/each}

    <!-- ========== COMMUNITY CARDS ========== -->
    {#if gameState}
      <div class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 z-[10]" style="top: {boardY}%;">
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
            <div class="rounded-md" style="width: {S.cardSize === 'md' ? 50 : S.cardSize === 'sm' ? 34 : 26}px; height: {S.cardSize === 'md' ? 70 : S.cardSize === 'sm' ? 48 : 36}px; background: rgba(0,0,0,0.4); border: 1px solid rgba(212,175,55,0.12); box-shadow: inset 0 2px 6px rgba(0,0,0,0.7);"></div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- ========== OPPONENTS ========== -->
    {#each opponents as s}
      {@const pos = seatPositionAt(s._arrayIdx)}
      {@const bPos = betPos(pos)}
      {@const panelSide = pos.x > 50 ? 'left' : 'right'}
      {@const isTurn = gameState?.currentSeat === s.seat && !s.folded && !s.allIn && winners.length === 0}
      {@const betAmount = s.betThisStreet}
      {@const isWin = isWinnerSeat(s.seat)}
      {@const isShowdown = inShowdown(s.seat)}
      {@const isShowdownWin = showdownWin(s.seat)}
      {@const isShowdownLose = showdownLose(s.seat)}
      {@const hole = (() => { if (!handResult?.showdownPlayers) return []; const p = handResult.showdownPlayers.find((x: any) => x.seat === s.seat); return p?.hole ?? []; })()}

      <div class="absolute -translate-x-1/2 -translate-y-1/2 z-[20]" style="left: {pos.x}%; top: {pos.y}%;">
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
          cardsAbove={pos.y < 46}
          {panelSide}
          onClick={() => onPlayerClick(s.userId)}
        />
      </div>

      {#if betAmount > 0 && !s.folded && winners.length === 0}
        <div class="absolute -translate-x-1/2 -translate-y-1/2 z-[22] pointer-events-none chip-enter" style="left: {bPos.x}; top: {bPos.y};">
          <div class="flex items-center justify-center rounded-full" style="height: 18px; min-width: 26px; padding: 0 7px; background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 55%, #a87a15 100%); box-shadow: 0 2px 6px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.3); border: 1px solid rgba(122,86,10,0.9);">
            <span class="font-black text-black tabular-nums leading-none" style="font-size: 9px; letter-spacing: -0.02em;">{fmt(betAmount)}</span>
          </div>
        </div>
      {/if}
    {/each}

    <!-- ========== HERO ========== -->
    {#if gameState && mySeat}
      {@const isWin = isWinnerSeat(mySeat.seat)}
      {@const isShowdown = inShowdown(mySeat.seat)}
      {@const isShowdownWin = showdownWin(mySeat.seat)}
      {@const isShowdownLose = showdownLose(mySeat.seat)}

      <!-- Hero hole cards at y=82 -->
      {#if heroHole.length > 0 && !isEliminated}
        {#key gameState.handNo}
          <div
            class="absolute left-1/2 -translate-x-1/2 flex justify-center gap-1.5 z-[25]"
            style="top: {heroCardsY}%; filter: drop-shadow(0 6px 14px rgba(0,0,0,0.9));"
          >
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

      <!-- Hero seat at y=91 -->
      <div class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[30]" style="top: {heroPos.y}%;">
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
      </div>

      <!-- Hero bet chip toward center -->
      {#if mySeat.betThisStreet > 0 && !mySeat.folded && winners.length === 0}
        {@const heroBet = betPos(heroPos)}
        <div class="absolute -translate-x-1/2 -translate-y-1/2 z-[22] pointer-events-none chip-enter" style="left: {heroBet.x}; top: {heroBet.y};">
          <div class="flex items-center justify-center rounded-full" style="height: 18px; min-width: 26px; padding: 0 7px; background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 55%, #a87a15 100%); box-shadow: 0 2px 6px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.3); border: 1px solid rgba(122,86,10,0.9);">
            <span class="font-black text-black tabular-nums leading-none" style="font-size: 9px; letter-spacing: -0.02em;">{fmt(mySeat.betThisStreet)}</span>
          </div>
        </div>
      {/if}
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
  .chip-fly { position: absolute; z-index: 55; pointer-events: none; animation: chip-fly-kf 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

  @keyframes winning-card-glow-kf {
    0%, 100% { box-shadow: 0 0 10px rgba(244,201,93,0.7), 0 0 0 2px rgba(244,201,93,0.9); transform: scale(1); }
    50% { box-shadow: 0 0 28px rgba(244,201,93,1), 0 0 0 3px rgba(244,201,93,1); transform: scale(1.05); }
  }
  .winning-card-glow { animation: winning-card-glow-kf 1.4s ease-in-out infinite; border-radius: 6px; }
</style>