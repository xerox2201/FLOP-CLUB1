# PHASE 5 REPORT — Testing & Verification

Status: COMPLETE. `test-e2e.ts` = **56 passed / 0 failed**, repeatable across
consecutive runs. `test-autopost.ts` = 8 passed / 0 failed, with one environment
limitation documented below.

## The two critical bugs this phase found

Both were pre-existing and both broke real money flow. Neither was visible from
typecheck or svelte-check — only from actually executing the money paths.

### 1. Rakeback and XP were never paid (`loyalty/service.ts`)

```sql
SELECT id, amount FROM vouchers WHERE ... RETURNING id, amount   -- invalid SQL
```

`RETURNING` is only valid on `INSERT` / `UPDATE` / `DELETE`. This query ran inside
the per-hand transaction at step 6, so it threw on **every hand**, the `catch`
rolled the transaction back, and **no rakeback, XP, tier update or voucher progress
was ever committed**. Evidence: the database contained 1 `rakeback_log` row against
1,414 finished hands.

Fix: removed `RETURNING` (a `SELECT` already returns rows).

### 2. Per-hand referral commissions were never recorded (`referral-service.ts`)

```sql
ON CONFLICT (hand_id, referrer_id, level) DO NOTHING
```

Migration 031 replaced the unique index with
`(hand_id, referrer_id, referee_id, level) WHERE hand_id IS NOT NULL`, so the
`ON CONFLICT` target matched nothing and every call raised `42P10`.
The ledger payment happens _before_ this insert, so referrers were paid while
`referral_earnings` and `total_earned_for_referrer` were never written — which also
made the `lifetime_earned` milestones permanently unreachable.

Fix: `ON CONFLICT (hand_id, referrer_id, referee_id, level) WHERE hand_id IS NOT NULL DO NOTHING`.

## `apps/server/src/test-e2e.ts` — 56 checks

Run: `npx tsx apps/server/src/test-e2e.ts`

| Section                              | Examples of what is asserted                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily missions                       | 5 missions returned; `trackProgress` matches by metric; progress 10/10 claimable; claim grants exactly 500 chips + 50 XP; double claim → `already_claimed`; claim without progress → `not_complete`; `free_chips`, `user_xp`, `xp_transactions`, `play_money_log` rows written; `resetDaily` drops stale days and keeps today.                        |
| Bad beat                             | $100 rake → exactly $2.00 contribution; $3 rake → $0.06; quads loss → `quad_plus`; straight flush loss → `straight_flush`; ordinary loss and fold-out → no trigger; quad_plus pays 75%/12.5% of a $2.00 pool; pool drained by exactly the paid amount; payout log rows sum to the paid total; repeat payout → `duplicate`; pool restored to baseline. |
| Weekly race                          | `weekStartUtc` lands on a Monday; bracket thresholds ($10 bronze / $100 silver / $1000 gold); `computePrizes` sums to exactly the pool and is non-increasing; live accrual + bracket promotion; settling a synthetic past week assigns ranks and pays $66.67 / $33.33 from the $100 pool; `closeWeek` is idempotent via the ledger; rows settled.     |
| Rakeback / XP / referral / milestone | rakeback is exactly 25% of a $10 rake share ($2.50); XP is exactly 1000 for $10 of rake; `attributeReferral` creates a level-1 edge; direct commission is 12% ($1.20); repeat `payForHand` does not double-pay; `first_ref` becomes claimable after one active referral; claim grants 5000 chips; double claim rejected.                              |

**Repeatability:** the test creates its own synthetic `hands` row, deletes the ledger
idempotency keys it created (`bad_beat_hand_{id}`, `rakeback_hand_{id}_user_{n}`,
`referral_hand_{id}_referrer_{n}_lvl_1`, `weekly_race_{week}_bronze`), reverses every
ledger movement it made, and only deletes users whose `display_name` is one it set.
Verified by running the suite twice back to back: 56/56 both times, with the bad beat
pool returned to its exact baseline.

## Auto-post verification — `apps/server/src/test-autopost.ts` (8 checks)

Run: `npx tsx apps/server/src/test-autopost.ts`

```
PASS  primary channel configured - chatId=-1004498738051
PASS  TELEGRAM_BOT_TOKEN present after loading .env - set
PASS  B3 hour guard is understood - would SKIP right now
PASS  B3 aggregation query runs against real hands
PASS  B3 empty winner list posts nothing - slots=0
PASS  B2 claimed exactly one post slot - tournamentId=67 slots=1
PASS  B2 second call does not post again - slots=1
PASS  cleanup: test tournament + log row removed - tournamentId=67
```

- **B2** is exercised for real against a synthetic finished tournament. The claim
  path, the payload, the single-post idempotency (`community_posts_log`) and the
  cleanup all work.
- **B3** only fires at 20:00 UTC, so the hour guard, the 24h aggregation query, the
  slot state and the empty-winner-list no-op were verified instead of forcing a post.

### Limitation (not a code defect)

The actual Telegram delivery could **not** be verified from this environment:

```
[tg-bot] sendMessage attempt 1/3 failed (fetch failed (connect ECONNREFUSED 10.10.34.36:443)) — retrying
[tg-bot] sendMessage attempt 2/3 failed (fetch failed (connect ECONNREFUSED 10.10.34.36:443)) — retrying
[tg-bot] announceTournamentFinished failed: tg_sendMessage_failed after 3 attempts
```

The configured Telegram API proxy is unreachable from here (network egress blocked).
The retry/backoff path behaved correctly and the failure was contained. **No channel
post was visually confirmed.** To complete this verification, run
`npx tsx apps/server/src/test-autopost.ts` on a host that can reach the proxy and
watch for `[tg-bot] 📢 announced tournament #N finished`.

## Commands run

```
npm -w apps/server run typecheck     -> exit 0
npm -w apps/mini-app run check       -> 0 errors, 0 warnings
npx tsx apps/server/src/test-e2e.ts  -> RESULT: 56 passed, 0 failed
npx tsx apps/server/src/test-autopost.ts -> RESULT: 8 passed, 0 failed
```
