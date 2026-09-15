import { describe, it, expect, beforeEach } from 'vitest';
import { PokerGame } from '../game.js';

function newGame(numPlayers: number, stacks?: number[]) {
  const players = Array.from({ length: numPlayers }, (_, i) => ({
    userId: i + 1,
    displayName: `P${i + 1}`,
    stack: stacks?.[i] ?? 1000,
  }));
  return new PokerGame(
    { tableId: 1, variant: 'holdem', speed: 'regular', smallBlind: 10, bigBlind: 20, rakePct: 0 },
    players
  );
}

describe('PokerGame — 6-max preflop order', () => {
  it('UTG acts first preflop (multi-way)', () => {
    const g = newGame(6);
    g.startHand([]);
    // dealer=0, SB=1, BB=2, UTG=3
    expect(g.state.dealerSeat).toBe(0);
    expect(g.state.currentSeat).toBe(3);
  });

  it('preflop order: UTG → ... → BTN → SB → BB', () => {
    const g = newGame(6);
    g.startHand([]);
    const order: number[] = [g.state.currentSeat];
    for (let i = 0; i < 5; i++) {
      const seat = g.state.currentSeat;
      const maxBet = Math.max(...g.state.seats.map(s => s.betThisStreet));
      const toCall = maxBet - g.state.seats[seat].betThisStreet;
      g.act(seat, toCall > 0 ? 'call' : 'check', 0);
      if (g.state.phase !== 'preflop') break;
      order.push(g.state.currentSeat);
    }
    expect(order).toEqual([3, 4, 5, 0, 1, 2]);
  });

  it('postflop starts from SB (first active left of BTN)', () => {
    const g = newGame(6);
    g.startHand([]);
    // همه call/check کنن تا flop
    for (let i = 0; i < 6; i++) {
      const seat = g.state.currentSeat;
      const maxBet = Math.max(...g.state.seats.map(s => s.betThisStreet));
      const toCall = maxBet - g.state.seats[seat].betThisStreet;
      g.act(seat, toCall > 0 ? 'call' : 'check', 0);
    }
    expect(g.state.phase).toBe('flop');
    // بعد از flop، SB (seat 1) اول
    expect(g.state.currentSeat).toBe(1);
  });
});

describe('PokerGame — Heads-Up order', () => {
  it('heads-up: BTN is SB and acts first preflop', () => {
    const g = newGame(2);
    g.startHand([]);
    // dealer=0 → SB=0 (dealer), BB=1
    expect(g.state.dealerSeat).toBe(0);
    expect(g.state.currentSeat).toBe(0); // BTN/SB acts first preflop
  });

  it('heads-up: BB acts first postflop', () => {
    const g = newGame(2);
    g.startHand([]);
    // SB calls, BB checks → flop
    g.act(0, 'call', 0);
    g.act(1, 'check', 0);
    expect(g.state.phase).toBe('flop');
    expect(g.state.currentSeat).toBe(1); // BB first postflop
  });
});

describe('PokerGame — Side pots', () => {
  it('creates side pot when all-in amounts differ', () => {
    const g = newGame(3, [100, 200, 500]);
    g.startHand([]);
    // Ali (0) all-in $100
    g.act(0, 'raise', 100);
    // Sara (1) all-in $200
    g.act(1, 'raise', 200);
    // Reza (2) call $200
    g.act(2, 'call', 0);

    expect(g.state.phase).toBe('showdown');
    const result = g.finishHand();
    expect(result.sidePots).toBeDefined();
    expect(result.sidePots!.length).toBeGreaterThanOrEqual(2);

    // Main pot = 100*3 = 300
    const main = result.sidePots!.find(p => p.type === 'main');
    expect(main?.amount).toBe(300);

    // Side pot = 100*2 = 200
    const side = result.sidePots!.find(p => p.type === 'side_1');
    expect(side?.amount).toBe(200);
  });
});

describe('PokerGame — Chip conservation', () => {
  it('total chips are conserved after hand', () => {
    const g = newGame(6);
    g.startHand([]);

    // 🔴 Total chips = stacks + pot (betThisStreet is already in pot)
    const before = g.state.seats.reduce((sum, s) => sum + s.stack, 0) + g.state.pot;

    // Everyone calls/checks تا showdown
    let safety = 0;
    while (g.state.phase !== 'showdown' && safety < 100) {
      safety++;
      const seat = g.state.currentSeat;
      const maxBet = Math.max(...g.state.seats.map(s => s.betThisStreet));
      const toCall = maxBet - g.state.seats[seat].betThisStreet;
      g.act(seat, toCall > 0 ? 'call' : 'check', 0);
    }
    g.finishHand();

    // 🔴 After showdown: pot = 0, all chips are in stacks
    const after = g.state.seats.reduce((sum, s) => sum + s.stack, 0) + g.state.pot;
    expect(Math.round(after * 100) / 100).toBe(Math.round(before * 100) / 100);
  });
});
