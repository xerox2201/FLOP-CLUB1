# PHASE 3 REPORT — Weekly Rake Race

Status: COMPLETE. Both checks pass, 44/44 end-to-end checks pass.

## What was built

### 3.1 Migration 034 — `apps/server/migrations/034_weekly_race.sql`

`weekly_race_entries` with `id, user_id, week_start DATE, bracket TEXT, total_rake
NUMERIC(18,2), rank INT, prize_usd NUMERIC(18,2), paid BOOL` plus `created_at` /
`updated_at`, `UNIQUE (user_id, week_start, bracket)`, a bracket CHECK
(`bronze|silver|gold`) and two indexes (bracket leaderboard scan, per-user history).
Runner `run-034.ts` applied and verified the column list and indexes.

Design note: a user keeps **one row per week**. `recordRake()` recomputes the bracket
from the running weekly total and updates the row in place, so crossing a threshold
promotes the existing entry instead of creating a second one. The bracket column stays
in the unique key as a safety net.

### 3.2 `weekly-race-service.ts`

- `recordRake(userId, rakeAmount)` — adds to this week's entry, promotes the bracket
  (`bronze $0-50`, `silver $50-500`, `gold $500+`).
- `getCurrentBracket`, `getLeaderboard(bracket)`, `getMyEntry` (live rank computed when
  the week has not settled yet), `getHistory`.
- `closeWeek(weekStart = previous Monday)` — ranks every participant, then pays the top
  N from `HOUSE_RAKE` (`kind: BONUS`, idempotency key `weekly_race_{week}_{bracket}`),
  writes `rank` / `prize_usd` / `paid`, and marks non-winners settled with no prize.

Bracket pools are exactly as approved: **Bronze $100 / top 20**, **Silver $500 / top 30**,
**Gold $2000 / top 50**.

**ASSUMPTION FLAGGED FOR CONFIRMATION (money):** the prize _curve within_ a bracket was
not specified. The implementation uses a documented linear-decreasing weight
(rank 1 gets `places` shares, rank 2 gets `places - 1`, ...), with the rounding remainder
added to rank 1 so the amounts always sum to exactly the pool. Verified in the e2e run:
2 bronze players split $100 as $66.67 / $33.33. It lives in one exported function
(`computePrizes`), so changing the curve is a single-function edit.

Wiring: `loyalty/service.ts` calls `recordRake(c.userId, rakeShare)` right after each
player's per-hand transaction commits, so every raked hand feeds the race.
Cron: `index.ts` hourly timer that runs `closeWeek()` when it is Monday 00:00 UTC
(idempotent per week+bracket), cleared on SIGINT.

### 3.3 `weekly-race-routes.ts` (registered in `index.ts`)

- `GET /api/weekly-race/current?bracket=bronze|silver|gold` — bracket list, pool size,
  paid places, standings.
- `GET /api/weekly-race/me` — my bracket, weekly rake, live rank, estimated prize.
- `GET /api/weekly-race/history` — my past weeks.

### 3.4 Frontend

- `routes/WeeklyRace.svelte` — full page: hero, pool card with countdown to Monday
  00:00 UTC, 3-bracket selector, pinned "my position" card, standings list,
  loading skeletons and an empty state.
- `Leaderboard.svelte` — new **Season | Weekly Race** tab switcher wrapping the existing
  season view (the season markup and the sticky "my rank" bar now render only in the
  season tab). The race tab has the 3-bracket selector, pool + countdown, pinned my-rank
  card, per-bracket standings and a link to the full page. Added an `onNavigate` prop
  (default no-op) so the page link works; `App.svelte` passes `navigate`.
- `App.svelte` — registered the `weekly-race` route.

## Verification (verbatim)

```
> @poker/server@0.1.0 typecheck
> tsc --noEmit
[server typecheck exit: 0]

svelte-check found 0 errors and 0 warnings
[mini-app check exit: 0]

RESULT: 44 passed, 0 failed
[e2e exit: 0]
```

Weekly-race checks added to `test-e2e.ts`: Monday week key, bracket thresholds,
prize-curve sum/monotonicity, live accrual + bracket promotion, settling a synthetic
past week (2020-01-06) with rank/prize/paid assertions, exactly-$100 distribution,
`closeWeek` idempotency via the ledger, and full cleanup (ledger reversed, rows deleted).
The test also re-asserts that the bad beat pool returns to its baseline.

## Accounting (AGENT_RULES rule 7)

Weekly race is house-funded from `HOUSE_RAKE`, and the fixed pools ($100 + $500 + $2000
per week) are the approved "Weekly Race = $3.00 per $100 rake" budget line. Worst case
per week is $2600 across all three brackets, which is only paid when players actually
contest the brackets; margin therefore stays at the approved 33%.
