export type Variant = 'holdem' | 'omaha4' | 'omaha5';
export type Mode = 'free' | 'real';
export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A';

export interface Card { r: Rank; s: Suit; }

export interface TableInfo {
  id: number;
  name: string;
  variant: Variant;
  mode: Mode;
  blinds: { sb: number; bb: number; ante: number };
  minBuyin: number;
  maxBuyin: number;
  rakePct: number;
  seats: number;
}

export const RAKE_CASH = 0.03;
export const RAKE_TOURNAMENT = 0.10;
export const REFERRAL_PCT = 0.05;
export const PRIZE_CAP_PCT = 0.10;
export const FREE_CHIPS_START = 10000;

export const LANGUAGES = ['en','fa','ar','tr','ru','zh'] as const;
export type Lang = typeof LANGUAGES[number];