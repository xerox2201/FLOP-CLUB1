# FINAL REPORT — Flop Club

Date: 2026-10-01
Branch: `ai-table-fix`
Session commits: `15f9c65` (Phase 2), `e8aa25a` (Phase 3), `99b6dc1` (Phase 4), plus the
Phase 5/6 commit that carries this report.

---

## 1. Executive summary

Phases 1–6 are complete. Typecheck and svelte-check are clean, and a 56-check
end-to-end suite passes repeatably.

Two **critical, pre-existing money bugs** were found and fixed in Phase 5. Both were
invisible to static checks and both meant that money which the product promised players
was never actually paid:

1. **Rakeback and XP were never paid.** A `SELECT ... RETURNING` (invalid SQL) inside the
   per-hand transaction threw on every hand, rolling the whole transaction back. The
   database held **1** `rakeback_log` row for **1,414** finished hands.
2. **Per-hand referral commissions were never recorded.** An `ON CONFLICT` target that no
   longer matched any unique index (changed by migration 031) raised `42P10` on every
   call.

A third finding worth flagging: the repo could not be committed at all — three
pre-existing `no-empty` lint errors failed the husky pre-commit hook for every commit.
Those are fixed too.

## 2. What was implemented, phase by phase

### Phase 1 — Financial fixes (verified)

- Flat instant rakeback: `INSTANT_RAKEBACK_PCT = 0.25` used by all 6 tiers.
- XP rate: `XP_PER_RAKE_USD = 100` (was 250).
- Freeroll cap `min(15% daily net, $300)`; tournament overlay cap `min(guaranteed, 5 × totalBuyIn)`.
- Corrected financial model in the handoff (see §4).

### Phase 2 — Bad beat jackpot + daily missions (commit `15f9c65`)

- Migration 033: `bad_beat_pool`, `bad_beat_payouts`, `missions`, `mission_progress`, plus
  the `HOUSE_BAD_BEAT` ledger account. 5 missions seeded.
- `bad-beat-service.ts`: pool funded by **2% of rake** (= $2 per $100 rake), trigger
  detection for quads-or-better and straight flush, ledger payouts with idempotency key
  `bad_beat_hand_{handId}`.
- `mission-service.ts`: daily progress, transactional claims, UTC daily reset.
- Routes: `/api/missions/daily`, `/api/missions/:code/claim`, `/api/bad-beat/pool`,
  `/api/bad-beat/recent`. Cron: mission reset at 00:00 UTC.
- Frontend: `BadBeatPool.svelte`, `Missions.svelte`, `routes/Missions.svelte`, wired into
  `Home.svelte` and `App.svelte`.

### Phase 3 — Weekly rake race (commit `e8aa25a`)

- Migration 034: `weekly_race_entries` (one row per user per week; bracket promotes in place).
- `weekly-race-service.ts`: accrual, live leaderboard, `closeWeek` with ledger payouts and
  per-(week, bracket) idempotency. Pools: Bronze $100/top 20, Silver $500/top 30,
  Gold $2000/top 50.
- Routes `/api/weekly-race/{current,me,history}`; weekly cron Monday 00:00 UTC.
- Frontend: `routes/WeeklyRace.svelte` plus a Season / Weekly Race tab in `Leaderboard.svelte`.

### Phase 4 — Frontend redesigns (commit `99b6dc1`)

- 10 pages redesigned to the Home/Profile/Leaderboard language: Tournaments, Shop,
  Settings, Achievements, Loyalty, Notifications, MyTournaments, Events, HelpCenter,
  RewardsHistory. All props and endpoints preserved; 0 emoji and 0 Persian verified by scan.

### Phase 5 — Testing

- `src/test-e2e.ts` — 56 checks, self-cleaning and repeatable.
- `src/test-autopost.ts` — 8 checks for B2/B3.
- The two critical bug fixes described in §1.

### Phase 6 — Polish

- Removed 3 dead exports, 1 duplicate comment; hid an empty UI paragraph.
- Fixed the 3 lint errors that blocked commits.
- Produced `CHANGELOG.md`, `PHASE_2..6_REPORT.md`, this report, and an updated handoff.

## 3. Test results (verbatim)

```
> @poker/server@0.1.0 typecheck
> tsc --noEmit
[server typecheck exit: 0]

svelte-check found 0 errors and 0 warnings
[mini-app check exit: 0]

RESULT: 56 passed, 0 failed        (npx tsx apps/server/src/test-e2e.ts, run twice)
RESULT: 8 passed, 0 failed         (npx tsx apps/server/src/test-autopost.ts)
```

Migrations 033 and 034 were applied and re-applied to prove idempotency
(`missions=5, pool_rows=1`, no duplicate rows).

## 4. Accounting verification (AGENT_RULES rule 7)

Per $100 gross rake, as approved and as implemented:

| Line                       | USD               |
| -------------------------- | ----------------- |
| Instant Rakeback 25%       | 25.00             |
| Bad Beat Pool (2% of rake) | 2.00              |
| Liquidity Mining           | 4.00              |
| Referral + Group           | 4.50              |
| Daily Missions             | 3.00              |
| Weekly Race                | 3.00              |
| Freeroll                   | 1.50              |
| Seeds/misc                 | 1.50              |
| **Total rewards**          | **44.50 (44.5%)** |
| Ops                        | 22.50             |
| **House net**              | **33.00 (33%)**   |

Rewards are below the 52% ceiling and margin is above the 25% floor. Bad beat payouts can
only ever spend the pool, which is funded by the $2.00 line, and weekly race pays fixed
house-funded pools — so neither can push rewards past budget. Mission rewards are
non-cashable chips plus at most 475 XP/user/day (= $0.475 of eventual XP-cashout liability
at the 1000 XP = $1 rate), covered by the $3.00 Daily Missions line.

## 5. Bugs found and fixed

| #   | Severity     | Where                                 | Symptom                                                                                                                                                    | Fix                                              |
| --- | ------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | **Critical** | `loyalty/service.ts`                  | `SELECT ... RETURNING` is invalid SQL → every `payHand` transaction rolled back → **rakeback and XP never paid** (1 log row for 1,414 hands)               | Removed `RETURNING`                              |
| 2   | **Critical** | `referral-service.ts`                 | `ON CONFLICT` target did not match the index from migration 031 → `42P10` → **referral earnings never recorded**, `lifetime_earned` milestones unreachable | Added `referee_id` + the partial-index predicate |
| 3   | High         | `Home.svelte`                         | A stray `s` rendered after UserProgress (`/>s`)                                                                                                            | Removed the character                            |
| 4   | Medium       | `Settings.svelte`                     | Icon names `eye` / `spade` do not exist → silent fallback circles                                                                                          | `unlock` / `gem`                                 |
| 5   | Medium       | `Loyalty.svelte`                      | Double-dollar render (`$$12.00`)                                                                                                                           | Removed the extra `$`                            |
| 6   | Medium       | `Events.svelte`                       | API returns `starts_at` / `prize_pool_usd` but the page read `startsAt` / `prize` → blank dates and prizes                                                 | Tolerant reads + safe fallback                   |
| 7   | Medium       | `WorldClock`, `Leaderboard`, `Wallet` | Empty `catch {}` blocks failed the pre-commit hook, so **no commit could succeed**                                                                         | Added explanatory comments                       |
| 8   | Low          | `tournament-manager.ts`               | Duplicate `const prizePool` declaration (the old formula left behind next to the new overlay cap)                                                          | Removed the stale declaration                    |
| 9   | Low          | `freeroll-service.ts`                 | Duplicated comment line                                                                                                                                    | Removed                                          |

## 6. Known limitations

1. **Telegram delivery unverified.** The auto-post pipeline (claim slot, payload,
   idempotency, cleanup) is verified, but the actual send failed from this environment
   because the Telegram API proxy is unreachable (`ECONNREFUSED 10.10.34.36:443`). The
   retry/backoff path worked and the failure was contained. Re-run
   `npx tsx apps/server/src/test-autopost.ts` on a host with egress to confirm delivery.
2. **`users.grandfathered` is never read.** Migration 019 promises early users "generous
   rakeback forever", but the payout path never checks the flag — and with flat 25% that
   promise is unenforceable. Needs a product decision.
3. **Two money splits were under-specified and are implemented as documented assumptions,
   each isolated in one constant/function for a one-line change:**
   - bad beat split (the approved sentences are mutually inconsistent):
     `quad_plus` = 75% loser / 12.5% winner / 12.5% table; `straight_flush` = 100% loser.
   - weekly race prize curve within a bracket: linear-decreasing weights, remainder to
     rank 1 (verified: 2 players split $100 as $66.67 / $33.33).
4. **`/api/events` has no `description` field**, so the event modal body is empty (the UI
   now hides it rather than rendering a blank line).
5. **Mission farming on free tables** — see Phase 6 report, item 4.
6. **No browser/visual verification.** The ten redesigned pages were verified with
   `svelte-check`, character scans and prop/endpoint greps; no screenshots were taken and
   no dev server was started.
7. **`prettier --check` still flags `loyalty/definitions.ts`** (17 lines over the 100-char
   print width, up from 16 before Phase 1). Pre-existing; `eslint` passes. Running
   `prettier --write` would reflow the large TIERS/SHOP_PACKS/SEED_DEFS blocks.

## 7. Next steps for production

1. **Run the full money-path suite against staging before launch**:
   `npx tsx apps/server/src/test-e2e.ts` and `npx tsx apps/server/src/test-autopost.ts`.
2. **Fix the Telegram egress** (Cloudflare Worker proxy is the documented dependency) and
   confirm B1/B2/B3 posts appear in the channel.
3. **Decide on `users.grandfathered`** — implement it in the rakeback calculation or
   retire the migration-019 promise.
4. **Confirm the two money assumptions** (bad beat split, weekly race curve) with the
   product owner; both are one-line changes.
5. **Watch the first real money week**: after Phase 1's fix, rakeback, XP and referral
   commissions are being paid for the first time. Monitor `rakeback_log`,
   `referral_earnings`, `bad_beat_pool` and `/api/books` for the first days of traffic to
   confirm the real reward ratio matches the 44.5% model.
6. **Add regression tests to CI** — wire `test-e2e.ts` into the pipeline so these two
   critical bugs cannot silently return.
7. **Restrict mission tracking to real-money hands** if free-table farming appears.
8. **Consider a dedicated index/constraint review** — bug #2 happened because a migration
   changed a unique index while the application's `ON CONFLICT` target was not updated.
   Adding a smoke test that exercises each `ON CONFLICT` would catch this class of error.
