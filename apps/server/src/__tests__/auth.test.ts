import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../auth.js';

const SECRET = 'test-secret';

describe('Auth — JWT', () => {
  describe('signToken', () => {
    it('creates a valid JWT string', () => {
      const token = signToken({ uid: 1, tg: 123 }, SECRET);
      expect(token).toBeTypeOf('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('embeds payload', () => {
      const token = signToken({ uid: 42, tg: 999 }, SECRET);
      const payload = verifyToken(token, SECRET);
      expect(payload.uid).toBe(42);
      expect(payload.tg).toBe(999);
    });

    it('sets exp in future', () => {
      const token = signToken({ uid: 1 }, SECRET, 3600);
      const payload = verifyToken(token, SECRET);
      const now = Math.floor(Date.now() / 1000);
      expect(payload.exp).toBeGreaterThan(now);
    });
  });

  describe('verifyToken', () => {
    it('verifies valid token', () => {
      const token = signToken({ uid: 1 }, SECRET);
      const payload = verifyToken(token, SECRET);
      expect(payload).toBeTruthy();
      expect(payload.uid).toBe(1);
    });

    it('rejects token with wrong secret', () => {
      const token = signToken({ uid: 1 }, SECRET);
      const payload = verifyToken(token, 'wrong-secret');
      expect(payload).toBeNull();
    });

    it('rejects malformed token', () => {
      expect(verifyToken('not.a.token', SECRET)).toBeNull();
      expect(verifyToken('', SECRET)).toBeNull();
    });

    it('rejects expired token', () => {
      const token = signToken({ uid: 1 }, SECRET, -1);
      const payload = verifyToken(token, SECRET);
      expect(payload).toBeNull();
    });
  });
});
