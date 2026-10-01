# CHANGELOG — Flop Club

All times UTC, from the working session of 2026-10-01.
Commits: `15f9c65` (Phase 2), `e8aa25a` (Phase 3), `99b6dc1` (Phase 4).

---

## Phase 1 — Financial fixes (verified, completed earlier in the session)

| Time  | Change                                                                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11:57 | `loyalty/definitions.ts` — flat instant rakeback. Added `INSTANT_RAKEBACK_PCT = 0.25` and referenced it from all 6 tiers (was 0.60/0.50/0.45/0.40/0.35/0.30).                                                  |
| 12:06 | `loyalty/definitions.ts` — `XP_PER_RAKE_USD = 100` (was 250 via `XP_POOL_PCT × XP_PER_DOLLAR`).                                                                                                                |
| 12:06 | `loyalty/service.ts` — XP now `rakeShare × XP_PER_RAKE_USD`.                                                                                                                                                   |
| 12:10 | `freeroll-service.ts` — prize cap `Math.min(net × 0.15, 300)`.                                                                                                                                                 |
| 12:12 | `tournament-manager.ts` — overlay cap `Math.min(guaranteed, totalBuyIn × 5)`; removed the duplicate `const prizePool` declaration.                                                                             |
| 12:15 | `PROJECT_HANDOFF.md.txt` — corrected financial model (flat 25% rakeback, Weekly Vault / Monthly Cashback removed, total rewards $44.50 = 44.5%, house net $33.00 = 33%); bad beat basis changed to 2% of rake. |

## Phase 2 — Bad beat jackpot + daily missions — commit `15f9c65` (12:28)

| Time  | Change                                                                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12:16 | **NEW** `migrations/033_bad_beat_missions.sql` — `bad_beat_pool` (singleton), `bad_beat_payouts`, `missions`, `mission_progress`; seeds 5 missions; adds the `HOUSE_BAD_BEAT` ledger account.                     |
| 12:16 | **NEW** `migrations/run-033.ts` — applies 033 and prints tables/missions/pool. Applied twice to prove idempotency.                                                                                                |
| 12:17 | **NEW** `bad-beat-service.ts` — `recordPotContribution` (2% of rake), `checkTrigger`, `payoutBadBeat` (ledger kind `BONUS`, idempotency key `bad_beat_hand_{handId}`), `getStats`, `getPool`, `getRecentPayouts`. |
| 12:18 | `game-manager.ts` — funds the pool and checks/pays the jackpot in `handleShowdown()`, after `loyalty.payHand`.                                                                                                    |
| 12:19 | **NEW** `mission-service.ts` — `getDailyMissions`, `trackProgress`, `claim` (transactional, `FOR UPDATE`), `resetDaily`.                                                                                          |
| 12:20 | `game-manager.ts` — mission tracking: `hands_played`, `omaha_hands_played`, `hands_won`, `showdowns_won`.                                                                                                         |
| 12:20 | `tournament-manager.ts` — `tournaments_played` for every participant in `finishTournament()`.                                                                                                                     |
| 12:21 | **NEW** `mission-routes.ts` (`GET /api/missions/daily`, `POST /api/missions/:code/claim`).                                                                                                                        |
| 12:22 | **NEW** `bad-beat-routes.ts` (`GET /api/bad-beat/pool`, `GET /api/bad-beat/recent`).                                                                                                                              |
| 12:23 | `index.ts` — registered both route groups; hourly timer calling `resetDaily()` at 00:00 UTC; timer cleared on SIGINT.                                                                                             |
| 12:24 | **NEW** `components/BadBeatPool.svelte`, `components/Missions.svelte`, `routes/Missions.svelte`.                                                                                                                  |
| 12:25 | `Home.svelte` — added BadBeatPool + Missions below TopWinnersToday; **fixed pre-existing typo** `/>s` (a stray `s` rendered after UserProgress).                                                                  |
| 12:25 | `App.svelte` — registered the `missions` route.                                                                                                                                                                   |
| 12:26 | **NEW** `src/test-e2e.ts` — 27 checks (missions + bad beat), self-cleaning.                                                                                                                                       |
| 12:28 | `PROJECT_HANDOFF.md.txt` — Phase 2 marked done, migration 033 listed.                                                                                                                                             |

## Phase 3 — Weekly rake race — commit `e8aa25a` (12:32)

| Time  | Change                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12:29 | **NEW** `migrations/034_weekly_race.sql` — `weekly_race_entries` with `UNIQUE (user_id, week_start, bracket)`, bracket CHECK, 2 indexes.                                                                                        |
| 12:29 | **NEW** `migrations/run-034.ts`.                                                                                                                                                                                                |
| 12:30 | **NEW** `weekly-race-service.ts` — `recordRake`, `getCurrentBracket`, `getLeaderboard`, `getMyEntry`, `getHistory`, `closeWeek`; `computePrizes` linear curve; brackets Bronze $100/top20, Silver $500/top30, Gold $2000/top50. |
| 12:30 | `loyalty/service.ts` — calls `recordRake` after each player's hand transaction commits.                                                                                                                                         |
| 12:31 | **NEW** `weekly-race-routes.ts` — `/current`, `/me`, `/history`.                                                                                                                                                                |
| 12:31 | `index.ts` — registered routes; hourly timer closing the week on Monday 00:00 UTC; timer cleared on SIGINT.                                                                                                                     |
| 12:31 | **NEW** `routes/WeeklyRace.svelte` — full page.                                                                                                                                                                                 |
| 12:31 | `Leaderboard.svelte` — Season / Weekly Race tabs, 3-bracket selector, pool + countdown, pinned my-rank, standings, link to the full page; new `onNavigate` prop.                                                                |
| 12:31 | `App.svelte` — registered the `weekly-race` route and passes `navigate` to Leaderboard.                                                                                                                                         |
| 12:31 | `test-e2e.ts` — 17 more checks (week key, brackets, prize curve, accrual, settle, idempotency, cleanup).                                                                                                                        |

## Phase 4 — Frontend redesigns — commit `99b6dc1` (12:33)

| Time  | Change                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12:33 | Redesigned 10 pages to the Home/Profile/Leaderboard style: `Tournaments`, `Shop`, `Settings`, `Achievements`, `Loyalty`, `Notifications`, `MyTournaments`, `Events`, `HelpCenter`, `RewardsHistory`. |
| 12:33 | `Settings.svelte` — replaced two **non-existent icon names** (`eye`, `spade`, which rendered fallback circles) with `unlock`/`gem`; dropped the Persian theme name and flag emoji.                   |
| 12:33 | `Achievements.svelte` — removed `✅`/`❌` emoji toasts and inline SVGs in favour of the Icon component.                                                                                              |
| 12:33 | `Loyalty.svelte` — emoji `tierIcon` mapped to Icon glyphs; fixed a **pre-existing double-dollar** render bug (`$$12.00`).                                                                            |
| 12:33 | `Shop.svelte` — the two Persian strings replaced with English.                                                                                                                                       |
| 12:33 | `Events.svelte` — tolerant reads for the pre-existing API shape mismatch (`starts_at` / `prize_pool_usd`), safe date fallback.                                                                       |

## Phase 5 — Testing — critical bug fixes

| Time  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12:38 | **CRITICAL FIX** `referral-service.ts` — `INSERT INTO referral_earnings ... ON CONFLICT (hand_id, referrer_id, level)` did not match the partial unique index created by migration 031, so every per-hand referral commission threw `42P10`. Fixed to `ON CONFLICT (hand_id, referrer_id, referee_id, level) WHERE hand_id IS NOT NULL`. Before this, referral earnings were **never recorded** (`referral_earnings` empty, `total_earned_for_referrer` never updated, `lifetime_earned` milestones unreachable). |
| 12:41 | **CRITICAL FIX** `loyalty/service.ts` — the voucher auto-unlock query was written as `SELECT id, amount FROM vouchers ... RETURNING id, amount`, which is invalid SQL (`RETURNING` only belongs on INSERT/UPDATE/DELETE). It threw on every hand, rolling back the whole `payHand` transaction, so **rakeback and XP were never paid** — the database held 1 `rakeback_log` row for 1,414 hands. Fixed by removing `RETURNING`.                                                                                   |
| 12:44 | `test-e2e.ts` — added the referral/rakeback/XP/milestone section (24 more checks); the test now creates its own synthetic `hands` row and deletes the ledger idempotency keys it used, so runs are repeatable.                                                                                                                                                                                                                                                                                                    |
| 12:47 | **NEW** `src/test-autopost.ts` — B2/B3 verification (8 checks).                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Phase 6 — Polish

| Time  | Change                                                                                                                                                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12:50 | `loyalty/definitions.ts` — removed the dead exports `XP_POOL_PCT`, `XP_PER_DOLLAR`, `XP_PER_USD_RAKE_SHARE` (referenced nowhere) and documented the 100 XP/$1 rate.                                                                                             |
| 12:50 | `freeroll-service.ts` — removed a duplicated comment line.                                                                                                                                                                                                      |
| 12:50 | `Events.svelte` — the event modal no longer renders an empty description paragraph.                                                                                                                                                                             |
| 12:52 | **FIX (pre-commit hook)** — three pre-existing `no-empty` ESLint errors that blocked every commit: empty `catch {}` blocks in `WorldClock.svelte`, `Leaderboard.svelte`, `Wallet.svelte`. Fixed with explanatory comments (per AGENT_RULES: fix, never bypass). |
| 12:55 | Added `CHANGELOG.md`, `PHASE_5_REPORT.md`, `PHASE_6_REPORT.md`, `FINAL_REPORT.md`; updated `PROJECT_HANDOFF.md.txt`.                                                                                                                                            |
