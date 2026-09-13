import type {
  Card, Variant, Speed, ActionType, PlayerInit, GameState, ActionResult, HandResult, ShowdownPlayer,
} from './types.js';
import { TIME_LIMITS } from './types.js';
import { makeDeck } from './cards.js';
import { shuffleDeck, generateServerSeed, sha256 } from './deck.js';
import { evaluateHand, compareHands } from './hand-evaluator.js';

export interface GameOptions {
  tableId: number;
  variant: Variant;
  speed?: Speed;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  rakePct?: number;
}

export class PokerGame {
  state: GameState;
  private variant: Variant;
  private speed: Speed;
  private ante: number;
  private rakePct: number;

  private deck: Card[] = [];
  private serverSeed = '';
  private clientSeeds: string[] = [];

  constructor(opts: GameOptions, players: PlayerInit[]) {
    this.variant = opts.variant;
    this.speed = opts.speed ?? 'regular';
    this.ante = opts.ante ?? 0;
    this.rakePct = opts.rakePct ?? 0.03;

    const limits = TIME_LIMITS[this.speed];

    this.state = {
      tableId: opts.tableId,
      variant: opts.variant,
      speed: this.speed,
      handNo: 0,
      phase: 'waiting',
      community: [],
      seats: players.map((p, i) => ({
        seat: i,
        userId: p.userId,
        displayName: p.displayName,
        stack: p.stack,
        betThisStreet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        hole: [],
        holeCount: 0,
        hasActed: false,
        revealed: false,
        timeBankRemaining: limits.bank,
      })),
      pot: 0,
      currentSeat: 0,
      dealerSeat: 0,
      minRaise: opts.bigBlind,
      smallBlind: opts.smallBlind,
      bigBlind: opts.bigBlind,
      serverSeedHash: '',
      turnStartedAt: 0,
      turnBaseLimit: limits.action,
      turnBankActive: false,
      turnBankLimit: limits.bank,
      autoActionAt: 0,
    };
  }

  private holeCount(): number {
    if (this.variant === 'holdem') return 2;
    if (this.variant === 'omaha4') return 4;
    return 5;
  }

  private startTurn(seat: number): void {
    this.state.currentSeat = seat;
    this.state.turnStartedAt = Date.now();
    this.state.turnBankActive = false;
    const limits = TIME_LIMITS[this.speed];
    this.state.turnBaseLimit = limits.action;
    this.state.turnBankLimit = limits.bank;
    this.state.autoActionAt = this.state.turnStartedAt + limits.action * 1000;
  }

  useTimeBank(seat: number): ActionResult {
    if (seat !== this.state.currentSeat) return { ok: false, error: 'not_your_turn' };
    if (this.state.turnBankActive) return { ok: false, error: 'bank_already_active' };

    const s = this.state.seats[seat];
    if (s.timeBankRemaining <= 0) return { ok: false, error: 'no_time_bank' };

    const elapsed = (Date.now() - this.state.turnStartedAt) / 1000;
    const remaining = Math.max(0, this.state.turnBaseLimit - elapsed);
    const use = Math.min(s.timeBankRemaining, this.state.turnBankLimit);
    s.timeBankRemaining -= use;

    this.state.turnBankActive = true;
    this.state.autoActionAt = Date.now() + (remaining + use) * 1000;

    return { ok: true };
  }

  forceTimeout(seat: number): ActionResult {
    if (seat !== this.state.currentSeat) return { ok: false, error: 'not_your_turn' };
    const maxBet = Math.max(...this.state.seats.map(s => s.betThisStreet));
    const s = this.state.seats[seat];
    const toCall = maxBet - s.betThisStreet;
    if (toCall <= 0) return this.act(seat, 'check');
    return this.act(seat, 'fold');
  }

  startHand(clientSeeds: string[] = []): void {
    if (this.state.seats.filter(s => !s.folded && s.stack >= 0).length < 2) {
      throw new Error('Not enough players');
    }

    this.serverSeed = generateServerSeed();
    this.state.serverSeedHash = sha256(this.serverSeed);
    this.clientSeeds = clientSeeds;
    this.state.handNo++;
    this.state.phase = 'preflop';
    this.state.community = [];
    this.state.pot = 0;
    this.state.minRaise = this.state.bigBlind;
    this.state.winners = undefined;
    this.state.serverSeed = undefined;

    for (const seat of this.state.seats) {
      seat.folded = seat.stack <= 0;
      seat.allIn = false;
      seat.betThisStreet = 0;
      seat.totalBet = 0;
      seat.hole = [];
      seat.holeCount = 0;
      seat.hasActed = false;
      seat.revealed = false;
    }

    this.deck = shuffleDeck(makeDeck(), this.serverSeed, clientSeeds, this.state.handNo);

    this.state.dealerSeat = this.nextOccupiedSeat(this.state.dealerSeat);
    const sbSeat = this.nextOccupiedSeat(this.state.dealerSeat);
    const bbSeat = this.nextOccupiedSeat(sbSeat);

    this.placeBet(sbSeat, this.state.smallBlind);
    this.placeBet(bbSeat, this.state.bigBlind);

    if (this.ante > 0) {
      for (const seat of this.state.seats) {
        if (seat.stack > 0) this.placeBet(seat.seat, this.ante);
      }
    }

    const hc = this.holeCount();
    for (let round = 0; round < hc; round++) {
      for (let i = 0; i < this.state.seats.length; i++) {
        const seatIdx = (this.state.dealerSeat + 1 + i) % this.state.seats.length;
        const seat = this.state.seats[seatIdx];
        if (seat.folded) continue;
        seat.hole.push(this.deck.pop()!);
      }
    }
    for (const seat of this.state.seats) {
      seat.holeCount = seat.hole.length;
    }

    if (this.shouldRunOutBoard()) {
      this.runOutBoard();
      return;
    }

    const firstSeat = this.nextActiveSeat(bbSeat);
    this.startTurn(firstSeat);
  }

  act(seatIdx: number, action: ActionType, amount = 0): ActionResult {
    if (this.state.phase === 'waiting' || this.state.phase === 'showdown') {
      return { ok: false, error: 'not_playing' };
    }
    if (seatIdx !== this.state.currentSeat) {
      return { ok: false, error: 'not_your_turn' };
    }

    const seat = this.state.seats[seatIdx];
    if (seat.folded || seat.allIn) {
      return { ok: false, error: 'inactive' };
    }

    const maxBet = Math.max(...this.state.seats.map(s => s.betThisStreet));
    const toCall = maxBet - seat.betThisStreet;

    switch (action) {
      case 'fold':
        seat.folded = true;
        break;
      case 'check':
        if (toCall > 0) return { ok: false, error: 'must_call' };
        break;
      case 'call':
        this.placeBet(seatIdx, Math.min(toCall, seat.stack));
        break;
      case 'raise': {
        const raiseTo = amount;
        const maxRaiseTo = seat.betThisStreet + seat.stack;
        if (raiseTo > maxRaiseTo) return { ok: false, error: 'not_enough_chips' };
        if (raiseTo <= maxBet) return { ok: false, error: 'raise_too_small' };

        const minRaiseTo = maxBet + this.state.minRaise;
        const isAllIn = raiseTo >= maxRaiseTo;
        if (raiseTo < minRaiseTo && !isAllIn) return { ok: false, error: 'raise_too_small' };

        const delta = raiseTo - seat.betThisStreet;
        this.placeBet(seatIdx, Math.min(delta, seat.stack));

        if (raiseTo - maxBet >= this.state.minRaise) {
          this.state.minRaise = raiseTo - maxBet;
        }
        for (const s of this.state.seats) {
          if (!s.folded && !s.allIn && s.seat !== seatIdx) s.hasActed = false;
        }
        break;
      }
    }

    seat.hasActed = true;

    if (this.state.seats.filter(s => !s.folded).length <= 1) {
      this.state.phase = 'showdown';
      return { ok: true };
    }

    if (this.shouldRunOutBoard()) {
      this.runOutBoard();
      return { ok: true };
    }

    if (this.allCalled()) {
      this.advanceStreet();
    } else {
      const nextSeat = this.nextActiveSeat(seatIdx);
      this.startTurn(nextSeat);
    }

    return { ok: true };
  }

  private shouldRunOutBoard(): boolean {
    const contenders = this.state.seats.filter(s => !s.folded);
    if (contenders.length <= 1) return true;
    const canAct = contenders.filter(s => !s.allIn && s.stack > 0);
    if (canAct.length === 0) return true;
    if (canAct.length === 1) {
      const maxBet = Math.max(...contenders.map(s => s.betThisStreet));
      const lastPlayer = canAct[0];
      if (lastPlayer.betThisStreet >= maxBet && lastPlayer.hasActed) return true;
      return false;
    }
    return false;
  }

  private runOutBoard(): void {
    while (this.state.community.length < 5) {
      this.state.community.push(this.deck.pop()!);
    }
    for (const s of this.state.seats) {
      s.betThisStreet = 0;
      s.hasActed = false;
    }
    this.state.phase = 'showdown';
  }

  finishHand(): HandResult {
    const active = this.state.seats.filter(s => !s.folded);
    const showdown = active.length > 1;

    if (active.length === 1) {
      const winner = active[0];
      winner.revealed = false;
      const rake = Math.round(this.state.pot * this.rakePct * 100) / 100;
      const payout = Math.round((this.state.pot - rake) * 100) / 100;
      winner.stack += payout;
      this.state.winners = [winner.seat];
      this.state.serverSeed = this.serverSeed;
      this.state.phase = 'showdown';

      return {
        winners: [winner.seat],
        payouts: [{ seat: winner.seat, amount: payout }],
        rake,
        revealSeed: this.serverSeed,
        showdown: false,
        showdownPlayers: [],
      };
    }

    const evaluations = active.map(s => ({
      seat: s,
      hand: evaluateHand([...s.hole, ...this.state.community]),
    }));

    let best = evaluations[0];
    for (const e of evaluations) {
      if (compareHands(e.hand, best.hand) > 0) best = e;
    }

    const winners = evaluations.filter(e => compareHands(e.hand, best.hand) === 0);
    const winnerSeats = winners.map(w => w.seat.seat);

    for (const e of evaluations) e.seat.revealed = true;

    const rake = Math.round(this.state.pot * this.rakePct * 100) / 100;
    const netPot = this.state.pot - rake;
    const share = Math.round((netPot / winners.length) * 100) / 100;

    const payouts = winners.map(w => ({ seat: w.seat.seat, amount: share }));
    for (const w of winners) w.seat.stack += share;

    this.state.winners = winnerSeats;
    this.state.serverSeed = this.serverSeed;
    this.state.phase = 'showdown';

    const showdownPlayers: ShowdownPlayer[] = evaluations.map(e => ({
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

  private extractBestFive(cards: Card[]): Card[] {
    if (cards.length <= 5) return cards;
    const combos: Card[][] = [];
    const rec = (start: number, cur: Card[]) => {
      if (cur.length === 5) { combos.push([...cur]); return; }
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
      if (compareHands(h, bestHand) > 0) { bestHand = h; bestCombo = c; }
    }
    return bestCombo;
  }

  private placeBet(seatIdx: number, amount: number): void {
    const seat = this.state.seats[seatIdx];
    const real = Math.min(amount, seat.stack);
    seat.stack -= real;
    seat.betThisStreet += real;
    seat.totalBet += real;
    this.state.pot += real;
    if (seat.stack === 0) seat.allIn = true;
  }

  private allCalled(): boolean {
    const contenders = this.state.seats.filter(s => !s.folded);
    if (contenders.length <= 1) return true;
    const needToAct = contenders.filter(s => !s.allIn);
    if (needToAct.length === 0) return true;
    const maxBet = Math.max(...contenders.map(s => s.betThisStreet));
    return needToAct.every(s => s.betThisStreet === maxBet && s.hasActed);
  }

  private advanceStreet(): void {
    for (const s of this.state.seats) {
      s.betThisStreet = 0;
      s.hasActed = false;
    }
    this.state.minRaise = this.state.bigBlind;

    switch (this.state.phase) {
      case 'preflop':
        this.state.community.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
        this.state.phase = 'flop';
        break;
      case 'flop':
        this.state.community.push(this.deck.pop()!);
        this.state.phase = 'turn';
        break;
      case 'turn':
        this.state.community.push(this.deck.pop()!);
        this.state.phase = 'river';
        break;
      case 'river':
        this.state.phase = 'showdown';
        return;
    }

    if (this.shouldRunOutBoard()) {
      this.runOutBoard();
      return;
    }

    const nextSeat = this.nextActiveSeat(this.state.dealerSeat);
    this.startTurn(nextSeat);
  }

  private nextOccupiedSeat(from: number): number {
    let i = (from + 1) % this.state.seats.length;
    for (let k = 0; k < this.state.seats.length; k++) {
      if (this.state.seats[i].stack > 0 || !this.state.seats[i].folded) return i;
      i = (i + 1) % this.state.seats.length;
    }
    return from;
  }

  private nextActiveSeat(from: number): number {
    let i = (from + 1) % this.state.seats.length;
    for (let k = 0; k < this.state.seats.length; k++) {
      const s = this.state.seats[i];
      if (!s.folded && !s.allIn && s.stack > 0) return i;
      i = (i + 1) % this.state.seats.length;
    }
    return from;
  }

  publicView(forUserId?: number): any {
    return {
      ...this.state,
      serverTime: Date.now(),
      seats: this.state.seats.map(s => ({
        ...s,
        hole: (s.userId === forUserId || s.revealed) ? s.hole : [],
      })),
    };
  }
}