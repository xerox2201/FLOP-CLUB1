export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';
export type Variant = 'holdem' | 'omaha4' | 'omaha5';
export type Speed = 'regular' | 'fast' | 'turbo' | 'hyper';

export interface Card { r: Rank; s: Suit; }

export type Phase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'raise';

export interface PlayerInit {
  userId: number;
  displayName: string;
  stack: number;
}

export interface SeatState {
  seat: number;
  userId: number;
  displayName: string;
  stack: number;
  betThisStreet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  hole: Card[];
  holeCount: number;
  hasActed: boolean;
  revealed: boolean;
  timeBankRemaining: number;
}

export interface GameState {
  tableId: number;
  variant: Variant;
  speed: Speed;
  handNo: number;
  phase: Phase;
  community: Card[];
  seats: SeatState[];
  pot: number;
  currentSeat: number;
  dealerSeat: number;
  minRaise: number;
  bigBlind: number;
  smallBlind: number;
  serverSeedHash: string;
  serverSeed?: string;
  winners?: number[];

  turnStartedAt: number;
  turnBaseLimit: number;
  turnBankActive: boolean;
  turnBankLimit: number;
  autoActionAt: number;
}

export interface ActionResult { ok: boolean; error?: string; }

export interface ShowdownPlayer {
  seat: number;
  displayName: string;
  hole: Card[];
  best: Card[];
  handName: string;
  isWinner: boolean;
  payout: number;
}

export interface HandResult {
  winners: number[];
  payouts: { seat: number; amount: number }[];
  rake: number;
  revealSeed: string;
  showdown: boolean;
  showdownPlayers: ShowdownPlayer[];
}

export const TIME_LIMITS: Record<Speed, { action: number; bank: number }> = {
  regular: { action: 30, bank: 30 },
  fast:    { action: 15, bank: 15 },
  turbo:   { action: 10, bank: 10 },
  hyper:   { action: 8,  bank: 8  },
};