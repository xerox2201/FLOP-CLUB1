# PHASE 2 REPORT — Bad Beat Jackpot + Daily Missions

Status: COMPLETE. Both checks pass, 27/27 end-to-end checks pass.

## What was built

### 2.1 Migration 033 — `apps/server/migrations/033_bad_beat_missions.sql`

Four tables (all idempotent, re-runnable):

| Table              | Purpose                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `bad_beat_pool`    | Singleton row (`id = 1`) holding the live jackpot, `amount_usd NUMERIC(18,2) >= 0`                                        |
| `bad_beat_payouts` | One row per recipient per triggered hand, FK to `hands(id)` / `users(id)`, `tier CHECK IN ('quad_plus','straight_flush')` |
| `missions`         | Mission definitions, `code UNIQUE`, `metric` CHECK, chip/XP rewards                                                       |
| `mission_progress` | Per user / mission / UTC day, `PRIMARY KEY (user_id, mission_id, day)`                                                    |

Also adds the `HOUSE_BAD_BEAT` (type `house`) ledger account that physically holds the
jackpot between hits.

Seeded 5 missions:

| code              | metric               | threshold | chips | XP  |
| ----------------- | -------------------- | --------- | ----- | --- |
| `play_10_hands`   | `hands_played`       | 10        | 500   | 50  |
| `win_3_hands`     | `hands_won`          | 3         | 1000  | 100 |
| `play_tournament` | `tournaments_played` | 1         | 2000  | 200 |
| `win_showdown`    | `showdowns_won`      | 1         | 750   | 75  |
| `play_omaha`      | `omaha_hands_played` | 1         | 500   | 50  |

Runner: `apps/server/migrations/run-033.ts`. Applied twice to prove idempotency
(second run produced no duplicate rows: `missions=5, pool_rows=1`).

### 2.2 `bad-beat-service.ts`

- `recordPotContribution(rake, handId?)` — funds the pool with **2% of rake**
  (= $2 per $100 rake). Per the approved decision the base is **rake, not pot**:
  0.5% of pot would be 16.67% of rake because rake is 3% of pot.
- `checkTrigger(handResult, seatToUserId)` — returns `null` when nothing qualifies.
  Hand names come from `packages/poker-engine/src/hand-evaluator.ts`
  (`'Four of a Kind'`, `'Straight Flush'`, `'Royal Flush'`). Straight flush is
  checked before quads because it is the stronger hand.
- `payoutBadBeat({...})` — pays from `HOUSE_BAD_BEAT` via `LedgerService`
  (kind `BONUS`, idempotency key `bad_beat_hand_{handId}`), writes the payout log,
  and drains the pool. Idempotent: a second call for the same hand returns
  `duplicate: true` and moves no money.
- `getStats()`, `getPool()`, `getRecentPayouts(limit)`.

**ASSUMPTION FLAGGED FOR CONFIRMATION (money):** the approved spec sentences are
internally inconsistent — "quad_plus: 50% to loser", "straight_flush: 100% to loser"
and "both distribute remaining via split 50/25/25 (loser/winner/table)" cannot all be
literally true at once. The implementation follows the two explicit percentage bullets
(they sum to exactly 100% of the pool in both tiers):

| tier             | loser  | winner | table  |
| ---------------- | ------ | ------ | ------ |
| `quad_plus`      | 75.00% | 12.50% | 12.50% |
| `straight_flush` | 100%   | 0      | 0      |

These live in one exported constant (`BAD_BEAT_SPLITS`) so the split is a one-line change
if you want the alternative reading (release 50% for quads, distributed 50/25/25).
A payout can never exceed the pool, so margin cannot break either way.

Wired into `game-manager.ts` → `handleShowdown()`, after `loyalty.payHand`, for real
non-tournament hands only.

### 2.3 `mission-service.ts`

`getDailyMissions`, `trackProgress`, `claim`, `resetDaily` (deletes days before today in UTC).

Wiring:

- `game-manager.ts` → `hands_played` per dealt-in player, `omaha_hands_played` for omaha
  variants, `hands_won` per winner, `showdowns_won` for winners at a real showdown.
  Every hand ending routes through `handleShowdown` (the engine sets `phase='showdown'`
  for fold-outs too), so fold-outs are counted correctly.
- `tournament-manager.ts` → `tournaments_played` for all participants in `finishTournament()`.
- `index.ts` → hourly timer that calls `resetDaily()` at 00:00 UTC (safe to repeat),
  cleared on SIGINT.

Rewards: `reward_chips` go to `free_chips` + `play_money_log` (reason `mission_reward`);
`reward_xp` goes to `user_xp` + `xp_transactions` (source `bonus`). Claim is transactional
with `FOR UPDATE` on the progress row, so double-claim is impossible.

### 2.4 Routes (registered in `index.ts`)

- `GET /api/missions/daily`, `POST /api/missions/:code/claim`
- `GET /api/bad-beat/pool`, `GET /api/bad-beat/recent`

### 2.5 Frontend

- `components/BadBeatPool.svelte` — pool amount, last payout, all-time paid.
- `components/Missions.svelte` — 5 missions, progress bars, reward chips + XP, claim buttons.
- `routes/Missions.svelte` — full page, registered in `App.svelte` (`missions` route).
- `Home.svelte` — BadBeatPool + Missions added below TopWinnersToday.
- Fixed a pre-existing typo in `Home.svelte`: `/>s` (a stray `s` rendered after UserProgress).

## Verification (verbatim)

```
> @poker/server@0.1.0 typecheck
> tsc --noEmit
[server typecheck exit: 0]

svelte-check found 0 errors and 0 warnings
[mini-app check exit: 0]

RESULT: 27 passed, 0 failed
[e2e exit: 0]
```

`apps/server/src/test-e2e.ts` creates a fresh test user, runs every check, reverses the
ledger movements it made, and deletes only rows it created. Highlights:
contribution $100 rake → $2.00; quads loss → `quad_plus`; straight flush loss →
`straight_flush`; ordinary loss and fold-out → no trigger; quad_plus payment
$1.50 loser / $0.25 winner from a $2.00 pool; second payout → duplicate;
pool restored to baseline; test user removed.

## Accounting (AGENT_RULES rule 7)

Per $100 gross rake the bad beat line spends exactly the budgeted $2.00
(2% of rake). Payouts only ever spend the pool, which is funded by that $2.00, so this
feature cannot push total rewards above the approved $44.50 (44.5%) or margin below 33%.

Mission rewards are free chips (non-cashable play currency) plus XP. Maximum XP a user
can earn from missions is 475 XP/day (= $0.475 of eventual XP-cashout liability at the
1000 XP = $1 rate), which is covered by the approved "Daily Missions = $3.00" budget line.

## Notes and follow-ups

- `missions.metric` has a CHECK constraint listing the 5 metric names. Adding a new
  metric later needs a migration.
- Anti-farm consideration: `hands_played` / `hands_won` count free-table hands too
  (the mission text says "Play 10 hands today", with no mode restriction). If free-table
  farming of mission XP becomes a concern, the wiring in `game-manager.ts` can be
  restricted to `room.mode === 'real'` in one place.
- During the first e2e run the test reused a pre-existing synthetic user
  (`telegram_id = 999000123`, id 222, 0 chips / 0 XP) and its cleanup deleted that row.
  The test now creates a unique telegram_id per run and refuses to reuse or delete any
  row whose `display_name` is not `E2E Test User`.
