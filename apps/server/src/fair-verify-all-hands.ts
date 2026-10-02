/**
 * Provably Fair — verify every committed hand in the database.
 *
 * Runs the isomorphic verifier (the same module the browser uses) over all
 * hand_seeds rows and, for deck-v1 rows, cross-checks the frozen Part B
 * oracle. Exits non-zero if any hand fails, so it is usable in CI or as a
 * release gate.
 *
 *   npx tsx apps/server/src/fair-verify-all-hands.ts [minPerAlgorithm]
 */

import { Pool } from 'pg';
import './env.js';
import {
  verifyHand,
  type FairProof,
  type FairCard,
} from '../../../packages/shared/src/fair/verifier.js';
import { verifyHandV1 } from '../../../packages/shared/src/fair/verify-v1.js';

const MIN_PER_ALGORITHM = Number(process.argv[2] ?? 20);

const db = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://poker:pokerpass@localhost:5432/poker',
});

function parseBoard(raw: any): FairCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c.r === 'string' && typeof c.s === 'string')
    .map((c) => ({ r: c.r, s: c.s }));
}

async function main() {
  const res = await db.query(
    `SELECT s.hand_id, s.algorithm, s.server_seed, s.server_seed_hash, s.client_seed, s.nonce,
            s.deck_hash, h.community_cards, h.player_count, h.variant
     FROM hand_seeds s
     LEFT JOIN hands h ON h.id = s.hand_id
     WHERE s.server_seed IS NOT NULL
     ORDER BY s.hand_id`,
  );

  const byAlgorithm = new Map<
    string,
    { total: number; ok: number; failed: number[]; oracleMismatch: number[] }
  >();
  const failures: Array<{ handId: number; algorithm: string; checks: unknown }> = [];

  for (const row of res.rows) {
    const algorithm = String(row.algorithm ?? 'deck-v1');
    const stats = byAlgorithm.get(algorithm) ?? {
      total: 0,
      ok: 0,
      failed: [] as number[],
      oracleMismatch: [] as number[],
    };
    stats.total += 1;

    const board = parseBoard(row.community_cards);
    const playerCount = Number(row.player_count ?? 0);
    const proof: FairProof = {
      algorithm,
      serverSeed: String(row.server_seed),
      commitment: String(row.server_seed_hash),
      clientSeed: String(row.client_seed ?? ''),
      nonce: Number(row.nonce ?? 0),
      communityCards: board,
      playerCount,
      variant: row.variant ?? null,
      expectedDeckHash: row.deck_hash ?? null,
    };

    const verdict = await verifyHand(proof);
    if (verdict.ok) {
      stats.ok += 1;
    } else {
      stats.failed.push(Number(row.hand_id));
      failures.push({ handId: Number(row.hand_id), algorithm, checks: verdict.checks });
    }

    if (algorithm === 'deck-v1') {
      const oracle = verifyHandV1({
        serverSeed: proof.serverSeed,
        serverSeedHash: proof.commitment,
        clientSeed: proof.clientSeed,
        nonce: proof.nonce,
        communityCards: board,
        expectedDeckHash: proof.expectedDeckHash,
        playerCount,
        variant: proof.variant,
      });
      const agrees =
        oracle.ok === verdict.ok &&
        JSON.stringify(oracle.checks) === JSON.stringify(verdict.checks);
      if (!agrees) stats.oracleMismatch.push(Number(row.hand_id));
    }

    byAlgorithm.set(algorithm, stats);
  }

  let exitCode = 0;
  console.log(`[fair] committed hands: ${res.rows.length}`);
  for (const [algorithm, stats] of [...byAlgorithm.entries()].sort()) {
    const oracleNote =
      stats.oracleMismatch.length > 0
        ? `  ORACLE MISMATCH: ${stats.oracleMismatch.join(', ')}`
        : algorithm === 'deck-v1'
          ? '  oracle: agrees'
          : '';
    console.log(
      `[fair] ${algorithm}: ${stats.ok}/${stats.total} verified${stats.failed.length ? `  FAILED: ${stats.failed.join(', ')}` : ''}${oracleNote}`,
    );
    if (stats.failed.length > 0 || stats.oracleMismatch.length > 0) exitCode = 1;
    if (stats.total < MIN_PER_ALGORITHM) {
      console.error(
        `[fair] ${algorithm}: only ${stats.total} hands verified, expected at least ${MIN_PER_ALGORITHM}`,
      );
      exitCode = 1;
    }
  }

  if (failures.length > 0) {
    console.error('[fair] failures:', JSON.stringify(failures.slice(0, 10), null, 2));
  }

  await db.end();
  console.log(exitCode === 0 ? '[fair] ALL HANDS VERIFIED' : '[fair] VERIFICATION FAILED');
  process.exit(exitCode);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
