import * as crypto from 'node:crypto';
import { evaluateHand, compareHands } from './hand-evaluator.js';
import { makeDeck, shuffleDeck } from './deck.js';
import type {
  Card,
  GameOptions,
  GameState,
  PlayerInit,
  Seat,
  HandResult,
  ShowdownPlayer,
  ActionType,
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
        avatarId: (p as any).avatarId ?? 'spade',
      });
    }
  }

  // ============================================================
  // ============ Start Hand ====================================
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
    this.state.revealSeed = undefined;
    this.state.turnBankActive = false;

    // ===== Provably Fair =====
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.state.serverSeedHash = crypto
      .createHash('sha256')
      .update(this.serverSeed)
      .digest('hex');
    this.state.serverSeed = undefined;

    // Reset seats
    for (const s of this.state.seats) {
      s.hole = [];
      s.betThisStreet = 0;
      s.totalBet = 0;
      s.folded = s.stack <= 0;
      s.allIn = false;
      s.hasActed = false;
      s.revealed = false;
    }

    // Dealer
    const activeSeats = this.state.seats.filter((s) => !s.folded);
    if (this.state.dealerSeat < 0) {
      this.state.dealerSeat = activeSeats[0].seat;
    } else {
      const curIdx = activeSeats.findIndex((s) => s.seat === this.state.dealerSeat);
      this.state.dealerSeat = activeSeats[(curIdx + 1) % activeSeats.length].seat;
    }

    // Deck
    this.deck = makeDeck();
    shuffleDeck(this.deck, this.serverSeed);

    // Blinds
    const order = this.orderFromDealer();
    const sbSeat = order[0];
    const bbSeat = order[1];

    this.postBet(sbSeat, this.state.smallBlind);
    this.postBet(bbSeat, this.state.bigBlind);

    // Ante
    if (this.state.ante > 0) {
      for (const s of activeSeats) {
        this.postBet(s.seat, this.state.ante);
      }
    }

    // Deal hole cards (2 rounds)
    const hc = this.holeCount();
    for (let round = 0; round < hc; round++) {
      for (const seatIdx of order) {
        const seat = this.state.seats[seatIdx];
        if (seat.folded) continue;
        const c = this.deck.pop();
        if (c) seat.hole.push(c);
      }
    }

    // First to act
    this.state.currentSeat = order[2] ?? order[0];
    this.state.turnStartedAt = Date.now();
  }

  // ============================================================
  // ============ Actions =======================================
  // ============================================================
  act(seatIdx: number, action: ActionType, amount: number): { ok: boolean; error?: string } {
    const seat = this.state.seats[seatIdx];
    if (!seat) return { ok: false, error: 'bad_seat' };
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
      const total = round2(amount);
      const minTotal = maxBet + this.state.minRaise;
      if (total < minTotal && total < seat.stack + seat.betThisStreet) {
        return { ok: false, error: 'raise_too_small' };
      }
      const add = total - seat.betThisStreet;
      if (add > seat.stack) return { ok: false, error: 'not_enough_stack' };
      this.postBet(seatIdx, add);
      this.state.minRaise = total - maxBet;
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

  // ============================================================
  // ============ Internals =====================================
  // ============================================================
  private holeCount(): number {
    if (this.state.variant === 'omaha4') return 4;
    if (this.state.variant === 'omaha5') return 5;
    return 2;
  }

  private orderFromDealer(): number[] {
    const active = this.state.seats.filter((s) => !s.folded).map((s) => s.seat);
    const startIdx = active.indexOf(this.state.dealerSeat);
    const out: number[] = [];
    for (let i = 1; i <= active.length; i++) {
      out.push(active[(startIdx + i) % active.length]);
    }
    return out;
  }

  private postBet(seatIdx: number, amt: number): void {
    const seat = this.state.seats[seatIdx];
    const real = Math.min(amt, seat.stack);
    seat.stack = round2(seat.stack - real);
    seat.betThisStreet = round2(seat.betThisStreet + real);
    seat.totalBet = round2(seat.totalBet + real);
    this.state.pot = round2(this.state.pot + real);
  }

  private advanceTurn(): void {
    const active = this.state.seats.filter((s) => !s.folded && !s.allIn);
    if (active.length <= 1) {
      this.finishStreet();
      return;
    }

    const allActed = active.every((s) => s.hasActed);
    const maxBet = Math.max(...this.state.seats.map((s) => s.betThisStreet));
    const allMatched = active.every((s) => s.betThisStreet === maxBet);

    if (allActed && allMatched) {
      this.finishStreet();
      return;
    }

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

    const active = this.state.seats.filter((s) => !s.folded);
    if (active.length <= 1) {
      this.state.phase = 'showdown';
      return;
    }

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

    // First to act post-flop: first active after dealer
    const order = this.orderFromDealer();
    for (const idx of order) {
      const s = this.state.seats[idx];
      if (!s.folded && !s.allIn) {
        this.state.currentSeat = idx;
        this.state.turnStartedAt = Date.now();
        this.state.turnBankActive = false;
        return;
      }
    }
  }

  private burnAndDeal(n: number): void {
    this.deck.pop(); // burn
    for (let i = 0; i < n; i++) {
      const c = this.deck.pop();
      if (c) this.state.community.push(c);
    }
  }

  private extractBestFive(cards: Card[]): Card[] {
    if (cards.length <= 5) return cards;
    const combos: Card[][] = [];
    const rec = (start: number, cur: Card[]) => {
      if (cur.length === 5) {
        combos.push([...cur]);
        return;
      }
      for (let i = start; i < cards.length; i++) {
        cur.push(cards[i]);
        rec(i + 1, cur);
        cur.pop();
      }
    };
    rec(0, []);
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

  // ============================================================
  // ============ Finish Hand ===================================
  // ============================================================
  finishHand(): HandResult {
    // Reset all street bets before settlement
    for (const s of this.state.seats) {
      s.betThisStreet = 0;
    }

    const active = this.state.seats.filter((s) => !s.folded);
    const showdown = active.length > 1;

    // ============ Winner by fold ============
    if (active.length === 1) {
      const winner = active[0];
      winner.revealed = false;
      const rake = round2(this.state.pot * this.rakePct);
      const payout = round2(this.state.pot - rake);
      winner.stack = round2(winner.stack + payout);
      this.state.winners = [winner.seat];
      this.state.phase = 'showdown';
      this.state.revealSeed = this.serverSeed;

      return {
        winners: [winner.seat],
        payouts: [{ seat: winner.seat, amount: payout }],
        rake,
        revealSeed: this.serverSeed,
        showdown: false,
        showdownPlayers: [],
      };
    }

    // ============ Showdown ============
    const evaluations = active.map((s) => ({
      seat: s,
      hand: evaluateHand([...s.hole, ...this.state.community]),
    }));

    let best = evaluations[0];
    for (const e of evaluations) {
      if (compareHands(e.hand, best.hand) > 0) best = e;
    }

    const winners = evaluations.filter((e) => compareHands(e.hand, best.hand) === 0);
    const winnerSeats = winners.map((w) => w.seat.seat);

    for (const e of evaluations) e.seat.revealed = true;

    const rake = round2(this.state.pot * this.rakePct);
    const netPot = round2(this.state.pot - rake);
    const share = round2(netPot / winners.length);

    const payouts = winners.map((w) => ({ seat: w.seat.seat, amount: share }));
    for (const w of winners) w.seat.stack = round2(w.seat.stack + share);

    this.state.winners = winnerSeats;
    this.state.phase = 'showdown';
    this.state.revealSeed = this.serverSeed;

    const showdownPlayers: ShowdownPlayer[] = evaluations.map((e) => ({
      seat: e.seat.seat,
      displayName: e.seat.displayName,
      hole: e.seat.hole,
      best: this.extractBestFive([...e.seat.hole, ...this.state.community]),
      handName: e.hand.name,
      isWinner: winnerSeats.includes(e.seat.seat),
      payout: winnerSeats.includes(e.seat.seat) ? share : 0,
    }));

    return {
      winners: winnerSeats,
      payouts,
      rake,
      revealSeed: this.serverSeed,
      showdown: true,
      showdownPlayers,
    };
  }

  // ============================================================
  // ============ Public View ===================================
  // ============================================================
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
      turnStartedAt: this.state.turnStartedAt,
      turnBankActive: this.state.turnBankActive,

      // ===== Provably Fair =====
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
          s.userId === forUserId || s.revealed
            ? s.hole
            : s.hole.map(() => ({ r: '?', s: '?' })),
      })),
    };
  }
}