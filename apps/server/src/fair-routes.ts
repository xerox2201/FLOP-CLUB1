/**
 * Provably Fair endpoints — /api/fair/*
 *
 * Read-only transparency API. The commitment is public; the server seed is
 * only returned after the hand ended (reveal). Verification runs entirely on
 * the server (verify-v1.ts); the client just renders the verdict.
 */

import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { FairSeedService, type FairSeedRecord } from './fair-seed-service.js';
import { DECK_V1_ALGORITHM, type FairCard } from '../../../packages/shared/src/fair/deck-v1.js';
import { verifyHandV1 } from '../../../packages/shared/src/fair/verify-v1.js';

interface FairHandView {
  handId: number;
  tableId: number | null;
  handNo: number | null;
  algorithm: string;
  commitment: string;
  clientSeed: string;
  nonce: number;
  revealed: boolean;
  serverSeed: string | null;
  deckHash: string | null;
  committedAt: Date;
  revealedAt: Date | null;
}

function toView(row: FairSeedRecord): FairHandView {
  const revealed = !!row.revealed_at && !!row.server_seed;
  return {
    handId: Number(row.hand_id),
    tableId: row.table_id === null ? null : Number(row.table_id),
    handNo: row.hand_no === null ? null : Number(row.hand_no),
    algorithm: row.algorithm,
    commitment: row.server_seed_hash,
    clientSeed: row.client_seed,
    nonce: Number(row.nonce),
    revealed,
    serverSeed: revealed ? row.server_seed : null,
    deckHash: row.deck_hash,
    committedAt: row.committed_at,
    revealedAt: row.revealed_at,
  };
}

function parseCommunityCards(raw: any): FairCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.r === 'string' && typeof c.s === 'string')
    .map((c) => ({ r: c.r, s: c.s }));
}

export async function registerFairRoutes(app: FastifyInstance, db: Pool): Promise<void> {
  const seeds = new FairSeedService(db);

  // ============================================================
  // GET /api/fair/algorithm — what the verifier currently proves
  // ============================================================
  app.get('/api/fair/algorithm', async () => ({
    algorithm: DECK_V1_ALGORITHM,
    verifier: 'server',
    entropy: {
      serverSeed: 'commit/reveal',
      clientSeed: 'server-generated (Part C: player-controlled)',
      nonce: 'fixed at 1 (Part C: table-level hand counter)',
    },
    disclosure: [
      'Server-side verification. Independent client verification coming soon.',
      'The client seed is server-generated in this version. Player-controlled entropy is planned.',
    ],
  }));

  // ============================================================
  // GET /api/fair/hand/:handId — commitment (seed only once revealed)
  // ============================================================
  app.get<{ Params: { handId: string } }>('/api/fair/hand/:handId', async (req, reply) => {
    const handId = Number(req.params.handId);
    if (!Number.isFinite(handId) || handId <= 0) {
      return reply.code(400).send({ error: 'invalid_hand_id' });
    }

    const row = await seeds.getByHandId(handId);
    if (!row) return reply.code(404).send({ error: 'commitment_not_found' });

    return { hand: toView(row) };
  });

  // ============================================================
  // POST /api/fair/verify — body: { handId } or { commitment }
  // ============================================================
  app.post<{ Body: { handId?: number | string; commitment?: string } }>(
    '/api/fair/verify',
    async (req, reply) => {
      const body = req.body ?? {};
      const handId = body.handId === undefined ? null : Number(body.handId);
      const commitment = body.commitment ? String(body.commitment).trim() : null;

      if (!handId && !commitment) {
        return reply.code(400).send({ error: 'missing_hand_id_or_commitment' });
      }
      if (handId !== null && (!Number.isFinite(handId) || handId <= 0)) {
        return reply.code(400).send({ error: 'invalid_hand_id' });
      }

      const row = commitment
        ? await seeds.getByCommitment(commitment)
        : await seeds.getByHandId(handId as number);

      if (!row) {
        return {
          verified: false,
          pending: false,
          found: false,
          reason: 'commitment_not_found',
          algorithm: DECK_V1_ALGORITHM,
        };
      }

      const view = toView(row);

      if (!view.revealed) {
        return {
          verified: false,
          pending: true,
          found: true,
          hand: view,
          algorithm: view.algorithm,
          reason: 'not_revealed_yet',
        };
      }

      const boardRes = await db.query(
        `SELECT community_cards, player_count, variant FROM hands WHERE id = $1`,
        [view.handId],
      );
      const communityCards = parseCommunityCards(boardRes.rows[0]?.community_cards);
      const playerCount = Number(boardRes.rows[0]?.player_count ?? 0);
      const variant = boardRes.rows[0]?.variant ?? null;

      const result = verifyHandV1({
        serverSeed: view.serverSeed as string,
        serverSeedHash: view.commitment,
        clientSeed: view.clientSeed,
        nonce: view.nonce,
        communityCards,
        expectedDeckHash: view.deckHash,
        playerCount,
        variant,
      });

      return {
        verified: result.ok,
        pending: false,
        found: true,
        hand: view,
        algorithm: result.algorithm,
        checks: result.checks,
        deckHash: result.deckHash,
        communityPositions: result.communityPositions,
        expectedBoardPositions: result.expectedBoardPositions,
        notes: result.notes,
      };
    },
  );
}
