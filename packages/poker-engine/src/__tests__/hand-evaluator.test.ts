import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHands } from '../hand-evaluator.js';
import { parseCard } from '../cards.js';

function evalCards(str: string) {
  const cards = str.split(' ').map(parseCard);
  return evaluateHand(cards);
}

describe('HandEvaluator', () => {
  describe('hand ranking', () => {
    it('Royal Flush', () => {
      expect(evalCards('As Ks Qs Js Ts').name).toBe('Royal Flush');
    });

    it('Straight Flush', () => {
      expect(evalCards('9h 8h 7h 6h 5h').name).toBe('Straight Flush');
    });

    it('Four of a Kind', () => {
      expect(evalCards('Ac Ad Ah As Kd').name).toBe('Four of a Kind');
    });

    it('Full House', () => {
      expect(evalCards('Kc Kd Kh Qs Qd').name).toBe('Full House');
    });

    it('Flush', () => {
      expect(evalCards('Ah 9h 7h 4h 2h').name).toBe('Flush');
    });

    it('Straight', () => {
      expect(evalCards('9c 8d 7h 6s 5c').name).toBe('Straight');
    });

    it('Wheel Straight (A-2-3-4-5)', () => {
      expect(evalCards('Ac 2d 3h 4s 5c').name).toBe('Straight');
    });

    it('Three of a Kind', () => {
      expect(evalCards('Qc Qd Qh 8s 2c').name).toBe('Three of a Kind');
    });

    it('Two Pair', () => {
      expect(evalCards('Jc Jd 9h 9s 2c').name).toBe('Two Pair');
    });

    it('One Pair', () => {
      expect(evalCards('Ac Ad 9h 6s 3c').name).toBe('One Pair');
    });

    it('High Card', () => {
      expect(evalCards('Ac Kd 9h 6s 3c').name).toBe('High Card');
    });
  });

  describe('tiebreaking', () => {
    it('higher pair wins', () => {
      const aces = evalCards('Ac Ad 9h 6s 3c');
      const kings = evalCards('Kc Kd 9h 6s 3c');
      expect(compareHands(aces, kings)).toBeGreaterThan(0);
    });

    it('same pair, higher kicker wins', () => {
      const acesKing = evalCards('Ac Ad Kh 6s 3c');
      const acesQueen = evalCards('Ac Ad Qh 6s 3c');
      expect(compareHands(acesKing, acesQueen)).toBeGreaterThan(0);
    });

    it('identical hands tie', () => {
      const a = evalCards('Ac Ad 9h 6s 3c');
      const b = evalCards('Ac Ad 9h 6s 3c');
      expect(compareHands(a, b)).toBe(0);
    });

    it('wheel is weakest straight', () => {
      const wheel = evalCards('Ac 2d 3h 4s 5c');
      const sixHigh = evalCards('6c 2d 3h 4s 5c');
      expect(compareHands(wheel, sixHigh)).toBeLessThan(0);
    });
  });
});