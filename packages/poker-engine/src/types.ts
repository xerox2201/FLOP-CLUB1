export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  r: Rank;
  s: Suit;
}

export type Variant = 'holdem' | 'omaha4' | 'omaha5';
export type Speed = 'regular' | 'fast' | 'turbo' | 'hyper';
export type ActionType = 'fold' | 'check' | 'call' | 'raise';
export type Phase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface GameOptions {
  tableId: number;
  variant: Variant;
  speed: Speed;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  rakePct?: number;
}

export interface PlayerInit {
  userId: number;
  displayName: string;
  stack: number;
  avatarId?: string;
}

export interface Seat {
  seat: number;
  userId: number;
  displayName: string;
  stack: number;
  hole: Card[];
  betThisStreet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  hasActed: boolean;
  revealed: boolean;
  timeBankRemaining: number;
  avatarId: string;
}

// 🔴 NEW: Side Pot
export interface SidePot {
  type: string;         // 'main' | 'side_1' | 'side_2'
  label: string;        // 'Main Pot' | 'Side Pot 1'
  amount: number;       // total contributed
  netAmount: number;    // after rake
  eligibleSeats: number[];
  winnerSeats: number[];
  payouts: { seat: number; amount: number }[];
}

export interface GameState {
  tableId: number;
  variant: Variant;
  speed: Speed;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  handNo: number;
  phase: Phase;
  dealerSeat: number;
  currentSeat: number;
  pot: number;
  community: Card[];
  seats: Seat[];
  minRaise: number;
  lastAggressor: number;
  winners?: number[];
  sidePots?: SidePot[];   // 🔴 NEW
  turnStartedAt: number;
  turnBankActive: boolean;

  // Provably Fair
  serverSeed?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
  revealSeed?: string;
}

export interface HandResult {
  winners: number[];
  payouts: { seat: number; amount: number }[];
  rake: number;
  revealSeed: string;
  showdown: boolean;
  showdownPlayers: ShowdownPlayer[];
  sidePots?: SidePot[];   // 🔴 NEW
}

export interface ShowdownPlayer {
  seat: number;
  displayName: string;
  hole: Card[];
  best: Card[];
  handName: string;
  isWinner: boolean;
  payout: number;
}