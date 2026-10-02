/**
 * Provably Fair endpoints — /api/fair/*
 *
 * Read-only transparency API plus player-controlled client seeds. The
 * commitment is public; the server seed is only returned after the hand ended
 * (reveal).
 *
 * Verification uses packages/shared/src/fair/verifier.ts — the same
 * isomorphic code the mini-app runs in the browser. For deck-v1 hands the
 * frozen server-side oracle (verify-v1.ts) is cross-checked too.
 */

import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { verifyToken } from './auth.js';
import { FairSeedService, type FairSeedInput, type FairSeedRecord } from './fair-seed-service.js';
import {
  CLIENT_SEED_CHANGE_COOLDOWN_MS,
  FairClientSeedService,
} from './fair-client-seed-service.js';
import {
  CLIENT_SEED_MAX_LENGTH,
  CLIENT_SEED_MIN_LENGTH,
} from '../../../packages/shared/src/fair/client-seed.js';
import {
  DECK_V1_ALGORITHM,
  DECK_V2_ALGORITHM,
  verifyHand,
  type FairCard,
  type FairProof,
} from '../../../packages/shared/src/fair/verifier.js';
import { verifyHandV1 } from '../../../packages/shared/src/fair/verify-v1.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret_change_me';

function authUser(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const p = verifyToken(auth.slice(7), JWT_SECRET);
  return p?.uid ?? null;
}

interface FairHandView {
  handId: number;
  tableId: number | null;
  handNo: number | null;
  algorithm: string;
  commitment: string;
  clientSeed: string;
  clientSeedHash: string | null;
  clientSeedSource: string | null;
  clientSeedInputs: FairSeedInput[] | null;
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
    clientSeedHash: row.client_seed_hash ?? null,
    clientSeedSource: row.client_seed_source ?? null,
    clientSeedInputs: row.client_seed_inputs ?? null,
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
  const clientSeeds = new FairClientSeedService(db);

  // ============================================================
  // GET /api/fair/algorithm — what the verifier currently proves
  // ============================================================
  app.get('/api/fair/algorithm', async () => ({
    algorithm: DECK_V2_ALGORITHM,
    legacyAlgorithm: DECK_V1_ALGORITHM,
    verifier: 'isomorphic (server + client run the same code)',
    derivation: 'shuffle seed = HMAC-SHA256(serverSeed, "<combinedClientSeed>:<nonce>")',
    entropy: {
      serverSeed: 'commit/reveal',
      clientSeed: 'player-controlled (combined from the seated players), server-generated fallback',
      nonce: 'table-level hand counter (poker_tables.hand_sequence)',
    },
    clientSeedRules: {
      minLength: CLIENT_SEED_MIN_LENGTH,
      maxLength: CLIENT_SEED_MAX_LENGTH,
      charset: 'A-Za-z0-9_-',
      changeCooldownMs: CLIENT_SEED_CHANGE_COOLDOWN_MS,
    },
    disclosure: [
      'Player-controlled entropy: enabled (deck-v2).',
      'Independent client verification: enabled.',
    ],
  }));

  // ============================================================
  // GET /api/fair/client-seed?tableId= — the caller's own seed
  // ============================================================
  app.get<{ Querystring: { tableId?: string } }>('/api/fair/client-seed', async (req, reply) => {
    const userId = authUser(req);
    if (!userId) return reply.code(401).send({ error: 'notoken' });

    const tableId = Number(req.query?.tableId);
    if (!Number.isFinite(tableId) || tableId <= 0) {
      return reply.code(400).send({ error: 'invalid_table_id' });
    }

    const record = await clientSeeds.get(tableId, userId);
    return {
      tableId,
      seed: record?.seed ?? null,
      seedHash: record?.seedHash ?? null,
      updatedAt: record?.updatedAt ?? null,
      rules: {
        minLength: CLIENT_SEED_MIN_LENGTH,
        maxLength: CLIENT_SEED_MAX_LENGTH,
        charset: 'A-Za-z0-9_-',
        changeCooldownMs: CLIENT_SEED_CHANGE_COOLDOWN_MS,
      },
    };
  });

  // ============================================================
  // PUT /api/fair/client-seed — set the caller's seed for a table
  // ============================================================
  app.put<{ Body: { tableId?: number | string; seed?: string } }>(
    '/api/fair/client-seed',
    async (req, reply) => {
      const userId = authUser(req);
      if (!userId) return reply.code(401).send({ error: 'notoken' });

      const body = req.body ?? {};
      const tableId = Number(body.tableId);
      if (!Number.isFinite(tableId) || tableId <= 0) {
        return reply.code(400).send({ error: 'invalid_table_id' });
      }

      // A seed can only change between hands: mid-hand it would land after the
      // commitment for the running hand was already published.
      try {
        const { gameManager } = await import('./game-manager.js');
        const room = gameManager.getRoom(tableId);
        const phase = room?.game?.state?.phase;
        if (phase && phase !== 'waiting' && phase !== 'showdown') {
          return reply.code(409).send({ error: 'hand_in_progress', phase });
        }
      } catch (e: any) {
        console.error('[fair] client-seed lock check failed:', e.message);
      }

      const result = await clientSeeds.set(tableId, userId, body.seed);
      if (!result.ok) {
        if (result.code === 'cooldown') {
          return reply.code(429).send({ error: result.error, retryAfterMs: result.retryAfterMs });
        }
        return reply.code(400).send({ error: result.error });
      }

      return { ok: true, tableId, seedHash: result.seedHash };
    },
  );

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
  //
  // Returns the proof so the client can re-run the verifier locally; the
  // server verdict comes from the exact same verifier module.
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
          algorithm: DECK_V2_ALGORITHM,
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

      const proof: FairProof = {
        algorithm: view.algorithm,
        serverSeed: view.serverSeed as string,
        commitment: view.commitment,
        clientSeed: view.clientSeed,
        nonce: view.nonce,
        communityCards,
        playerCount,
        variant,
        expectedDeckHash: view.deckHash,
      };

      const verdict = await verifyHand(proof);

      // deck-v1 stays cross-checked against the frozen Part B oracle.
      let oracleAgrees: boolean | null = null;
      if (view.algorithm === DECK_V1_ALGORITHM) {
        const oracle = verifyHandV1({
          serverSeed: proof.serverSeed,
          serverSeedHash: proof.commitment,
          clientSeed: view.clientSeed,
          nonce: view.nonce,
          communityCards,
          expectedDeckHash: view.deckHash,
          playerCount,
          variant,
        });
        oracleAgrees =
          oracle.ok === verdict.ok &&
          JSON.stringify(oracle.checks) === JSON.stringify(verdict.checks);
      }

      return {
        verified: verdict.ok,
        pending: false,
        found: true,
        hand: view,
        algorithm: verdict.algorithm,
        checks: verdict.checks,
        deckHash: verdict.deckHash,
        communityPositions: verdict.communityPositions,
        expectedBoardPositions: verdict.expectedBoardPositions,
        oracleAgrees,
        notes: verdict.notes,
        proof,
      };
    },
  );
}
