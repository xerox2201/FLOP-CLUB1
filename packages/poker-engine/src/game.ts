import crypto from 'crypto';
import { evaluateHand, compareHands, type EvalResult } from './hand-evaluator.js';
import { makeDeck, shuffleDeck } from './deck.js';
import type {
  Card,
  GameOptions,
  GameState,
  PlayerInit,
  HandResult,
  ShowdownPlayer,
  ActionType,
  Seat,
  SidePot,
} from './types.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class PokerGame {
  state: GameState;
  private deck: Card[] = [];
  private serverSeed = '';
  private rakePct: number;

  constructor(opts: GameOptions, players: PlayerInit[]) {
    this.rakePct = opts.rakePct ?? 0.03;
    this.state = {
      tableId: opts.tableId,
      variant: opts.variant,
      speed: opts.speed,
      smallBlind: opts.smallBlind,
      bigBlind: opts.bigBlind,
      ante: opts.ante ?? 0,
      handNo: 0,
      phase: 'waiting',
      dealerSeat: -1,
      currentSeat: -1,
      pot: 0,
      community: [],
      seats: [],
      minRaise: opts.bigBlind,
      lastAggressor: -1,
      winners: undefined,
      sidePots: undefined,
      serverSeed: undefined,
      serverSeedHash: undefined,
      clientSeed: crypto.randomBytes(16).toString('hex'),
      nonce: 0,
      revealSeed: undefined,
      turnStartedAt: 0,
      turnBankActive: false,
    };

    for (const p of players) {
      this.state.seats.push({
        seat: this.state.seats.length,
        userId: p.userId,
        displayName: p.displayName,
        stack: p.stack,
        hole: [],
        betThisStreet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        hasActed: false,
        revealed: false,
        timeBankRemaining: 30,
        avatarId: p.avatarId ?? 'spade',
      });
    }
  }

  private combinations<T>(arr: T[], k: number): T[][] {
    const result: T[][] = [];
    const rec = (start: number, cur: T[]) => {
      if (cur.length === k) {
        result.push([...cur]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        cur.push(arr[i]);
        rec(i + 1, cur);
        cur.pop();
      }
    };
    rec(0, []);
    return result;
  }

  private extractBestFive(hole: Card[]): Card[] {
    const community = this.state.community;
    const variant = this.state.variant;

    if (variant === 'holdem') {
      const all = [...hole, ...community];
      if (all.length <= 5) return all;
      const combos = this.combinations(all, 5);
      let bestCombo = combos[0];
      let bestHand = evaluateHand(bestCombo);
      for (const c of combos) {
        const h = evaluateHand(c);
        if (compareHands(h, bestHand) > 0) {
          bestHand = h;
          bestCombo = c;
        }
      }
      return bestCombo;
    }

    const holeCombos = this.combinations(hole, 2);
    const boardCombos = this.combinations(community, 3);
    let best: Card[] = [];
    let bestHand: EvalResult | null = null;
    for (const h of holeCombos) {
      for (const b of boardCombos) {
        const five = [...h, ...b];
        const hand = evaluateHand(five);
        if (!bestHand || compareHands(hand, bestHand) > 0) {
          bestHand = hand;
          best = five;
        }
      }
    }
    return best;
  }

  private evaluateSeat(seat: Seat): EvalResult {
    const variant = this.state.variant;
    if (variant === 'holdem') {
      return evaluateHand([...seat.hole, ...this.state.community]);
    }
    const holeCombos = this.combinations(seat.hole, 2);
    const boardCombos = this.combinations(this.state.community, 3);
    let best: EvalResult | null = null;
    for (const h of holeCombos) {
      for (const b of boardCombos) {
        const hand = evaluateHand([...h, ...b]);
        if (!best || compareHands(hand, best) > 0) best = hand;
      }
    }
    return best ?? evaluateHand([...seat.hole, ...this.state.community]);
  }

  private calculatePots(): SidePot[] {
    const seats = this.state.seats;
    const contributions = seats.map((s) => ({ seat: s.seat, total: s.totalBet, folded: s.folded }));
    const levels = [
      ...new Set(seats.filter((s) => !s.folded && s.totalBet > 0).map((s) => round2(s.totalBet))),
    ].sort((a, b) => a - b);

    if (levels.length === 0) return [];

    const pots: SidePot[] = [];
    let prevLevel = 0;

    for (const level of levels) {
      const diff = round2(level - prevLevel);
      if (diff <= 0) continue;
      let potAmount = 0;
      const eligible: number[] = [];
      for (const c of contributions) {
        const contrib = Math.min(diff, Math.max(0, round2(c.total - prevLevel)));
        if (contrib > 0) {
          potAmount = round2(potAmount + contrib);
          if (!c.folded && c.total >= level) eligible.push(c.seat);
        }
      }
      if (potAmount > 0 && eligible.length > 0) {
        const idx = pots.length;
        pots.push({
          type: idx === 0 ? 'main' : `side_${idx}`,
          label: idx === 0 ? 'Main Pot' : `Side Pot ${idx}`,
          amount: potAmount,
          netAmount: 0,
          eligibleSeats: eligible,
          winnerSeats: [],
          payouts: [],
        });
      }
      prevLevel = level;
    }
    return pots;
  }

  // ============================================================
  // 🔴 PRE-FLOP ACTION ORDER
  // Multi-way: UTG (left of BB) → ... → BTN → SB → BB
  // Heads-up: BTN/SB first, BB last
  // ============================================================
  private preflopOrder(): number[] {
    const active = this.state.seats.filter((s) => !s.folded).map((s) => s.seat);

    if (active.length === 0) return [];

    if (active.length === 2) {
      // Heads-up preflop: BTN/SB acts first, BB acts last
      const dealerIdx = active.indexOf(this.state.dealerSeat);
      if (dealerIdx < 0) return active;
      return [active[dealerIdx], active[(dealerIdx + 1) % active.length]];
    }

    // Multi-way: find BB, then start from UTG (left of BB)
    const dealerIdx = active.indexOf(this.state.dealerSeat);
    if (dealerIdx < 0) return active;
    const bbIdx = (dealerIdx + 2) % active.length; // BB is 2 seats after BTN
    const utgIdx = (bbIdx + 1) % active.length; // UTG is left of BB

    const out: number[] = [];
    for (let i = 0; i < active.length; i++) {
      out.push(active[(utgIdx + i) % active.length]);
    }
    return out;
  }

  // ============================================================
  // 🔴 POST-FLOP ACTION ORDER
  // Starts with the first ACTIVE player to the LEFT of the button
  // and proceeds clockwise. BTN acts last.
  // ============================================================
  private postflopOrder(): number[] {
    const active = this.state.seats.filter((s) => !s.folded).map((s) => s.seat);

    if (active.length === 0) return [];

    if (active.length === 2) {
      // Heads-up postflop: BB acts first, BTN/SB acts last
      const dealerIdx = active.indexOf(this.state.dealerSeat);
      if (dealerIdx < 0) return active;
      return [
        active[(dealerIdx + 1) % active.length], // BB
        active[dealerIdx], // BTN/SB
      ];
    }

    // Multi-way: find first active seat strictly clockwise from BTN
    const dealerIdx = active.indexOf(this.state.dealerSeat);
    if (dealerIdx < 0) return active;

    // Start from the seat immediately left of BTN (i.e., SB position)
    const sbIdx = (dealerIdx + 1) % active.length;

    const out: number[] = [];
    for (let i = 0; i < active.length; i++) {
      out.push(active[(sbIdx + i) % active.length]);
    }
    return out;
  }

  // ============================================================
  // START HAND
  // ============================================================
  startHand(_: any[]): void {
    const seats = this.state.seats.filter((s) => s.stack > 0);
    if (seats.length < 2) {
      this.state.phase = 'waiting';
      return;
    }

    this.state.handNo += 1;
    this.state.nonce = this.state.handNo;
    this.state.phase = 'preflop';
    this.state.community = [];
    this.state.pot = 0;
    this.state.minRaise = this.state.bigBlind;
    this.state.lastAggressor = -1;
    this.state.winners = undefined;
    this.state.sidePots = undefined;
    this.state.revealSeed = undefined;
    this.state.turnBankActive = false;

    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.state.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.state.serverSeed = undefined;

    for (const s of this.state.seats) {
      s.hole = [];
      s.betThisStreet = 0;
      s.totalBet = 0;
      s.folded = s.stack <= 0;
      s.allIn = false;
      s.hasActed = false;
      s.revealed = false;
    }

    const activeSeats = this.state.seats.filter((s) => !s.folded);
    if (this.state.dealerSeat < 0) {
      this.state.dealerSeat = activeSeats[0].seat;
    } else {
      const curIdx = activeSeats.findIndex((s) => s.seat === this.state.dealerSeat);
      this.state.dealerSeat = activeSeats[(curIdx + 1) % activeSeats.length].seat;
    }

    this.deck = makeDeck();
    const seed = this.serverSeed || `${this.state.tableId}-${this.state.handNo}-${Date.now()}`;
    shuffleDeck(this.deck, seed);

    // Post blinds
    const activeCount = activeSeats.length;
    let sbSeat: number, bbSeat: number;

    if (activeCount === 2) {
      // Heads-up: BTN is SB, other is BB
      sbSeat = this.state.dealerSeat;
      bbSeat = activeSeats.find((s) => s.seat !== sbSeat)!.seat;
    } else {
      // Multi-way: SB = left of BTN, BB = left of SB
      const dealerIdx = activeSeats.findIndex((s) => s.seat === this.state.dealerSeat);
      sbSeat = activeSeats[(dealerIdx + 1) % activeCount].seat;
      bbSeat = activeSeats[(dealerIdx + 2) % activeCount].seat;
    }

    this.postBet(sbSeat, this.state.smallBlind);
    this.postBet(bbSeat, this.state.bigBlind);

    if (this.state.ante > 0) {
      for (const s of activeSeats) this.postBet(s.seat, this.state.ante);
    }

    // Deal hole cards starting from SB, clockwise
    const dealOrder: number[] = [];
    const sbIdx = activeSeats.findIndex((s) => s.seat === sbSeat);
    for (let i = 0; i < activeSeats.length; i++) {
      dealOrder.push(activeSeats[(sbIdx + i) % activeSeats.length].seat);
    }

    const hc = this.holeCount();
    for (let round = 0; round < hc; round++) {
      for (const seatIdx of dealOrder) {
        const seat = this.state.seats[seatIdx];
        if (seat.folded) continue;
        const c = this.deck.pop();
        if (c) seat.hole.push(c);
      }
    }

    // First to act preflop
    const order = this.preflopOrder();
    this.state.currentSeat = order[0] ?? bbSeat;
    this.state.turnStartedAt = Date.now();

    console.log(
      `[engine] hand #${this.state.handNo} dealer=${this.state.dealerSeat} SB=${sbSeat} BB=${bbSeat} first=${this.state.currentSeat}`,
    );
  }

  act(seatIdx: number, action: ActionType, amount: number): { ok: boolean; error?: string } {
    const seat = this.state.seats[seatIdx];
    if (!seat) return { ok: false, error: 'bad_seat' };
    if (this.state.phase === 'showdown' || this.state.phase === 'waiting') {
      return { ok: false, error: 'hand_not_active' };
    }
    if (seat.folded || seat.allIn) return { ok: false, error: 'not_active' };
    if (this.state.currentSeat !== seatIdx) return { ok: false, error: 'not_your_turn' };

    const maxBet = Math.max(...this.state.seats.map((s) => s.betThisStreet));
    const toCall = maxBet - seat.betThisStreet;

    if (action === 'fold') {
      seat.folded = true;
      seat.hasActed = true;
    } else if (action === 'check') {
      if (toCall > 0) return { ok: false, error: 'cannot_check' };
      seat.hasActed = true;
    } else if (action === 'call') {
      const callAmt = Math.min(toCall, seat.stack);
      this.postBet(seatIdx, callAmt);
      if (seat.stack === 0) seat.allIn = true;
      seat.hasActed = true;
    } else if (action === 'raise') {
      const EPSILON = 0.001;
      const total = round2(amount);
      const minTotal = round2(maxBet + this.state.minRaise);
      const allInTotal = round2(seat.stack + seat.betThisStreet);
      if (total + EPSILON < minTotal && total + EPSILON < allInTotal) {
        return { ok: false, error: 'raise_too_small' };
      }
      const add = round2(total - seat.betThisStreet);
      if (add <= 0) return { ok: false, error: 'raise_below_current' };
      if (add > seat.stack + EPSILON) return { ok: false, error: 'not_enough_stack' };
      this.postBet(seatIdx, Math.min(add, seat.stack));
      this.state.minRaise = round2(total - maxBet);
      this.state.lastAggressor = seatIdx;
      if (seat.stack === 0) seat.allIn = true;
      for (const s of this.state.seats) {
        if (s.seat !== seatIdx && !s.folded && !s.allIn) s.hasActed = false;
      }
      seat.hasActed = true;
    } else {
      return { ok: false, error: 'bad_action' };
    }

    this.advanceTurn();
    return { ok: true };
  }

  useTimeBank(seatIdx: number): { ok: boolean; error?: string } {
    const seat = this.state.seats[seatIdx];
    if (!seat) return { ok: false, error: 'bad_seat' };
    if (this.state.currentSeat !== seatIdx) return { ok: false, error: 'not_your_turn' };
    if (seat.timeBankRemaining <= 0) return { ok: false, error: 'no_time_bank' };
    this.state.turnBankActive = true;
    return { ok: true };
  }

  private holeCount(): number {
    if (this.state.variant === 'omaha4') return 4;
    if (this.state.variant === 'omaha5') return 5;
    return 2;
  }

  private postBet(seatIdx: number, amt: number): void {
    const seat = this.state.seats[seatIdx];
    const real = round2(Math.min(amt, seat.stack));
    seat.stack = round2(Math.max(0, seat.stack - real));
    seat.betThisStreet = round2(seat.betThisStreet + real);
    seat.totalBet = round2(seat.totalBet + real);
    this.state.pot = round2(this.state.pot + real);
    if (seat.stack <= 0) {
      seat.stack = 0;
      seat.allIn = true;
    }
  }

  private advanceTurn(): void {
    const active = this.state.seats.filter((s) => !s.folded && !s.allIn);
    const maxBet = Math.max(...this.state.seats.map((s) => s.betThisStreet));

    if (active.length === 0) {
      this.finishStreet();
      return;
    }

    if (active.length === 1) {
      // Only one non-folded player remains
      const s = active[0];
      const nonFolded = this.state.seats.filter((x) => !x.folded);
      if (nonFolded.length === 1) {
        // Everyone else folded → hand over immediately
        this.finishStreet();
        return;
      }
      // One player + all-ins: continue if not matched
      if (s.betThisStreet >= maxBet && s.hasActed) {
        this.finishStreet();
        return;
      }
      this.state.currentSeat = s.seat;
      this.state.turnStartedAt = Date.now();
      this.state.turnBankActive = false;
      return;
    }

    const allActed = active.every((s) => s.hasActed);
    const allMatched = active.every((s) => s.betThisStreet === maxBet);

    if (allActed && allMatched) {
      this.finishStreet();
      return;
    }

    // Move to next active seat clockwise
    const seats = this.state.seats.map((s) => s.seat);
    const curIdx = seats.indexOf(this.state.currentSeat);
    for (let i = 1; i <= seats.length; i++) {
      const next = seats[(curIdx + i) % seats.length];
      const s = this.state.seats[next];
      if (!s.folded && !s.allIn && (!s.hasActed || s.betThisStreet < maxBet)) {
        this.state.currentSeat = next;
        this.state.turnStartedAt = Date.now();
        this.state.turnBankActive = false;
        return;
      }
    }
    this.finishStreet();
  }

  private finishStreet(): void {
    for (const s of this.state.seats) {
      s.betThisStreet = 0;
      s.hasActed = false;
    }

    this.state.minRaise = this.state.bigBlind;

    const active = this.state.seats.filter((s) => !s.folded);
    if (active.length <= 1) {
      this.state.phase = 'showdown';
      return;
    }

    const actionable = active.filter((s) => !s.allIn);
    const shouldRunOut = actionable.length <= 1;

    if (this.state.phase === 'preflop') {
      this.state.phase = 'flop';
      this.burnAndDeal(3);
    } else if (this.state.phase === 'flop') {
      this.state.phase = 'turn';
      this.burnAndDeal(1);
    } else if (this.state.phase === 'turn') {
      this.state.phase = 'river';
      this.burnAndDeal(1);
    } else if (this.state.phase === 'river') {
      this.state.phase = 'showdown';
      return;
    }

    if (shouldRunOut) {
      this.finishStreet();
      return;
    }

    // 🔴 CRITICAL FIX: use postflopOrder() which correctly skips folded players
    const postflop = this.postflopOrder();
    for (const idx of postflop) {
      const s = this.state.seats[idx];
      if (!s.folded && !s.allIn) {
        this.state.currentSeat = idx;
        this.state.turnStartedAt = Date.now();
        this.state.turnBankActive = false;
        return;
      }
    }
    this.finishStreet();
  }

  private burnAndDeal(n: number): void {
    this.deck.pop();
    for (let i = 0; i < n; i++) {
      const c = this.deck.pop();
      if (c) this.state.community.push(c);
    }
  }

  finishHand(): HandResult {
    for (const s of this.state.seats) s.betThisStreet = 0;

    const active = this.state.seats.filter((s) => !s.folded);
    const showdown = active.length > 1;

    if (active.length === 1) {
      const winner = active[0];
      winner.revealed = false;
      const rake = round2(this.state.pot * this.rakePct);
      const payout = round2(this.state.pot - rake);
      winner.stack = round2(winner.stack + payout);
      this.state.pot = 0;
      this.state.winners = [winner.seat];
      this.state.sidePots = [
        {
          type: 'main',
          label: 'Main Pot',
          amount: round2(payout + rake),
          netAmount: payout,
          eligibleSeats: [winner.seat],
          winnerSeats: [winner.seat],
          payouts: [{ seat: winner.seat, amount: payout }],
        },
      ];
      this.state.phase = 'showdown';
      this.state.revealSeed = this.serverSeed;

      return {
        winners: [winner.seat],
        payouts: [{ seat: winner.seat, amount: payout }],
        rake,
        revealSeed: this.serverSeed,
        showdown: false,
        showdownPlayers: [],
        sidePots: this.state.sidePots,
      };
    }

    const evaluations = active.map((s) => ({
      seat: s,
      hand: this.evaluateSeat(s),
    }));

    const pots = this.calculatePots();
    if (pots.length === 0) {
      pots.push({
        type: 'main',
        label: 'Main Pot',
        amount: this.state.pot,
        netAmount: this.state.pot,
        eligibleSeats: active.map((s) => s.seat),
        winnerSeats: [],
        payouts: [],
      });
    }

    const totalRake = round2(this.state.pot * this.rakePct);
    let rakeRemaining = totalRake;

    const allPayouts: { seat: number; amount: number }[] = [];
    const winnerSeatsSet = new Set<number>();

    for (let i = 0; i < pots.length; i++) {
      const pot = pots[i];
      let rakeFromPot = 0;
      if (i === 0 && rakeRemaining > 0) {
        rakeFromPot = Math.min(rakeRemaining, pot.amount);
        rakeRemaining = round2(rakeRemaining - rakeFromPot);
      }
      pot.netAmount = round2(pot.amount - rakeFromPot);

      const eligibleEvals = evaluations.filter((e) => pot.eligibleSeats.includes(e.seat.seat));
      if (eligibleEvals.length === 0) continue;

      let best = eligibleEvals[0];
      for (const e of eligibleEvals) {
        if (compareHands(e.hand, best.hand) > 0) best = e;
      }

      const potWinners = eligibleEvals.filter((e) => compareHands(e.hand, best.hand) === 0);
      const share = round2(pot.netAmount / potWinners.length);

      for (const w of potWinners) {
        w.seat.stack = round2(w.seat.stack + share);
        winnerSeatsSet.add(w.seat.seat);
        pot.winnerSeats.push(w.seat.seat);
        pot.payouts.push({ seat: w.seat.seat, amount: share });
        const existing = allPayouts.find((p) => p.seat === w.seat.seat);
        if (existing) existing.amount = round2(existing.amount + share);
        else allPayouts.push({ seat: w.seat.seat, amount: share });
      }
    }

    for (const e of evaluations) e.seat.revealed = true;

    this.state.pot = 0;
    this.state.winners = [...winnerSeatsSet];
    this.state.sidePots = pots;
    this.state.phase = 'showdown';
    this.state.revealSeed = this.serverSeed;

    const showdownPlayers: ShowdownPlayer[] = evaluations.map((e) => ({
      seat: e.seat.seat,
      displayName: e.seat.displayName,
      hole: e.seat.hole,
      best: this.extractBestFive(e.seat.hole),
      handName: e.hand.name,
      isWinner: winnerSeatsSet.has(e.seat.seat),
      payout: allPayouts.find((p) => p.seat === e.seat.seat)?.amount ?? 0,
    }));

    return {
      winners: [...winnerSeatsSet],
      payouts: allPayouts,
      rake: totalRake,
      revealSeed: this.serverSeed,
      showdown: true,
      showdownPlayers,
      sidePots: pots,
    };
  }

  publicView(forUserId: number): any {
    return {
      tableId: this.state.tableId,
      variant: this.state.variant,
      speed: this.state.speed,
      handNo: this.state.handNo,
      phase: this.state.phase,
      dealerSeat: this.state.dealerSeat,
      currentSeat: this.state.currentSeat,
      pot: this.state.pot,
      community: this.state.community,
      minRaise: this.state.minRaise,
      smallBlind: this.state.smallBlind,
      bigBlind: this.state.bigBlind,
      ante: this.state.ante,
      winners: this.state.winners,
      sidePots: this.state.sidePots,
      turnStartedAt: this.state.turnStartedAt,
      turnBankActive: this.state.turnBankActive,
      serverSeedHash: this.state.serverSeedHash,
      clientSeed: this.state.clientSeed,
      nonce: this.state.nonce,
      revealSeed: this.state.revealSeed,

      seats: this.state.seats.map((s) => ({
        seat: s.seat,
        userId: s.userId,
        displayName: s.displayName,
        avatarId: s.avatarId,
        stack: s.stack,
        betThisStreet: s.betThisStreet,
        totalBet: s.totalBet,
        folded: s.folded,
        allIn: s.allIn,
        revealed: s.revealed,
        timeBankRemaining: s.timeBankRemaining,
        hole:
          s.userId === forUserId || s.revealed ? s.hole : s.hole.map(() => ({ r: '?', s: '?' })),
      })),
    };
  }
}
