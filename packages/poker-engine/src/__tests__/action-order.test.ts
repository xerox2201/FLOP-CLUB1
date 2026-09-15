import { describe, it, expect } from 'vitest';
import { PokerGame } from '../game.js';

type Variant = 'holdem' | 'omaha4' | 'omaha5';

function newGame(variant: Variant, numPlayers: number, stacks?: number[]) {
  const players = Array.from({ length: numPlayers }, (_, i) => ({
    userId: i + 1,
    displayName: `P${i + 1}`,
    stack: stacks?.[i] ?? 1000,
  }));
  return new PokerGame(
    {
      tableId: 1,
      variant,
      speed: 'regular',
      smallBlind: 10,
      bigBlind: 20,
      rakePct: 0,
    },
    players,
  );
}

function safeAct(g: PokerGame, seat: number) {
  const maxBet = Math.max(...g.state.seats.map((s) => s.betThisStreet));
  const toCall = maxBet - g.state.seats[seat].betThisStreet;
  return g.act(seat, toCall > 0 ? 'call' : 'check', 0);
}

// ============================================================
// 1. Pre-flop order — all 3 variants
// ============================================================
describe('Pre-flop order (multi-way)', () => {
  for (const variant of ['holdem', 'omaha4', 'omaha5'] as Variant[]) {
    it(`${variant}: UTG acts first (left of BB)`, () => {
      const g = newGame(variant, 6);
      g.startHand([]);
      expect(g.state.dealerSeat).toBe(0);
      expect(g.state.currentSeat).toBe(3);
    });

    it(`${variant}: full order = UTG → ... → BTN → SB → BB`, () => {
      const g = newGame(variant, 6);
      g.startHand([]);
      const order: number[] = [g.state.currentSeat];
      for (let i = 0; i < 5; i++) {
        safeAct(g, g.state.currentSeat);
        if (g.state.phase !== 'preflop') break;
        order.push(g.state.currentSeat);
      }
      expect(order).toEqual([3, 4, 5, 0, 1, 2]);
    });
  }
});

// ============================================================
// 2. Post-flop order
// ============================================================
describe('Post-flop order', () => {
  it('flop starts from SB (first active left of BTN)', () => {
    const g = newGame('holdem', 6);
    g.startHand([]);
    for (let i = 0; i < 6; i++) safeAct(g, g.state.currentSeat);
    expect(g.state.phase).toBe('flop');
    expect(g.state.currentSeat).toBe(1);
  });

  it('flop skips folded SB — starts from BB', () => {
    const g = newGame('holdem', 6);
    g.startHand([]);
    g.act(3, 'call', 0);
    g.act(4, 'call', 0);
    g.act(5, 'call', 0);
    g.act(0, 'call', 0);
    g.act(1, 'fold', 0);
    g.act(2, 'check', 0);
    expect(g.state.phase).toBe('flop');
    expect(g.state.currentSeat).toBe(2);
  });

  it('flop skips SB and BB if both folded', () => {
    const g = newGame('holdem', 6);
    g.startHand([]);
    g.act(3, 'call', 0);
    g.act(4, 'call', 0);
    g.act(5, 'call', 0);
    g.act(0, 'call', 0);
    g.act(1, 'fold', 0);
    g.act(2, 'fold', 0);
    expect(g.state.phase).toBe('flop');
    expect(g.state.currentSeat).toBe(3);
  });

  it('turn starts from first active left of BTN', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    g.act(3, 'call', 0);
    g.act(0, 'call', 0);
    g.act(1, 'call', 0);
    g.act(2, 'check', 0);
    g.act(1, 'check', 0);
    g.act(2, 'check', 0);
    g.act(3, 'check', 0);
    g.act(0, 'check', 0);
    expect(g.state.phase).toBe('turn');
    expect(g.state.currentSeat).toBe(1);
  });

  it('river starts from first active left of BTN', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    g.act(3, 'call', 0);
    g.act(0, 'call', 0);
    g.act(1, 'call', 0);
    g.act(2, 'check', 0);
    g.act(1, 'check', 0);
    g.act(2, 'check', 0);
    g.act(3, 'check', 0);
    g.act(0, 'check', 0);
    g.act(1, 'check', 0);
    g.act(2, 'check', 0);
    g.act(3, 'check', 0);
    g.act(0, 'check', 0);
    expect(g.state.phase).toBe('river');
    expect(g.state.currentSeat).toBe(1);
  });
});

// ============================================================
// 3. Heads-up
// ============================================================
describe('Heads-up order', () => {
  it('preflop: BTN/SB acts first, BB last', () => {
    const g = newGame('holdem', 2);
    g.startHand([]);
    expect(g.state.dealerSeat).toBe(0);
    expect(g.state.currentSeat).toBe(0);
  });

  it('postflop: BB acts first', () => {
    const g = newGame('holdem', 2);
    g.startHand([]);
    g.act(0, 'call', 0);
    g.act(1, 'check', 0);
    expect(g.state.phase).toBe('flop');
    expect(g.state.currentSeat).toBe(1);
  });

  it('turn in heads-up: BB first again', () => {
    const g = newGame('holdem', 2);
    g.startHand([]);
    g.act(0, 'call', 0);
    g.act(1, 'check', 0);
    g.act(1, 'check', 0);
    g.act(0, 'check', 0);
    expect(g.state.phase).toBe('turn');
    expect(g.state.currentSeat).toBe(1);
  });
});

// ============================================================
// 4. Folded players are skipped
// ============================================================
describe('Folded players are skipped', () => {
  it('folded player is skipped in advanceTurn', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    expect(g.state.currentSeat).toBe(3);
    g.act(3, 'call', 0);
    expect(g.state.currentSeat).toBe(0);
    g.act(0, 'fold', 0);
    expect(g.state.currentSeat).toBe(1);
  });

  it('folded player cannot act', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    g.act(3, 'call', 0);
    g.act(0, 'fold', 0);
    const result = g.act(0, 'call', 0);
    expect(result.ok).toBe(false);
  });
});

// ============================================================
// 5. All-in players are skipped
// ============================================================
describe('All-in players are skipped', () => {
  it('all-in player is skipped in advanceTurn', () => {
    const g = newGame('holdem', 3, [50, 1000, 1000]);
    g.startHand([]);
    expect(g.state.currentSeat).toBe(0);
    g.act(0, 'raise', 50);
    expect(g.state.seats[0].allIn).toBe(true);
    expect(g.state.currentSeat).toBe(1);
  });

  it('all-in player cannot act again', () => {
    const g = newGame('holdem', 3, [50, 1000, 1000]);
    g.startHand([]);
    g.act(0, 'raise', 50);
    const result = g.act(0, 'call', 0);
    expect(result.ok).toBe(false);
  });
});

// ============================================================
// 6. Street end conditions
// ============================================================
describe('Street end conditions', () => {
  it('street ends when all active players have acted and matched', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    expect(g.state.phase).toBe('preflop');
    g.act(3, 'call', 0);
    g.act(0, 'call', 0);
    g.act(1, 'call', 0);
    g.act(2, 'check', 0);
    expect(g.state.phase).toBe('flop');
  });

  it('street continues if a player raises after others acted', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    g.act(3, 'call', 0);
    g.act(0, 'call', 0);
    g.act(1, 'call', 0);
    g.act(2, 'raise', 40);
    expect(g.state.phase).toBe('preflop');
    expect(g.state.seats[0].hasActed).toBe(false);
    expect(g.state.seats[1].hasActed).toBe(false);
    expect(g.state.seats[3].hasActed).toBe(false);
  });
});

// ============================================================
// 7. Check only allowed when toCall === 0
// ============================================================
describe('Check only allowed when no bet to call', () => {
  it('cannot check if there is a bet', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    g.act(3, 'raise', 40);
    const result = g.act(0, 'check', 0);
    expect(result.ok).toBe(false);
  });

  it('BB can check after everyone calls', () => {
    const g = newGame('holdem', 4);
    g.startHand([]);
    g.act(3, 'call', 0);
    g.act(0, 'call', 0);
    g.act(1, 'call', 0);
    const result = g.act(2, 'check', 0);
    expect(result.ok).toBe(true);
  });
});

// ============================================================
// 8. Full hand flow for all variants
// ============================================================
describe('Full hand flow', () => {
  for (const variant of ['holdem', 'omaha4', 'omaha5'] as Variant[]) {
    it(`${variant}: plays to showdown without errors`, () => {
      const g = newGame(variant, 6);
      g.startHand([]);
      let safety = 0;
      while (g.state.phase !== 'showdown' && safety < 100) {
        safety++;
        safeAct(g, g.state.currentSeat);
      }
      expect(g.state.phase).toBe('showdown');
      expect(safety).toBeLessThan(100);
    });
  }
});
