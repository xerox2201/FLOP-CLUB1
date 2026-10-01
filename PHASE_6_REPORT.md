# PHASE 6 REPORT — Polish, Cleanup and Documentation

Status: COMPLETE. Both checks pass.

## Cleanup performed

| Item                                      | Where                                                      | What was done                                                                                                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dead exports removed                      | `loyalty/definitions.ts`                                   | `XP_POOL_PCT`, `XP_PER_DOLLAR`, `XP_PER_USD_RAKE_SHARE` were referenced nowhere (verified by grep across `apps/`). Removed; the live constant `XP_PER_RAKE_USD = 100` is documented in place.                 |
| Duplicate comment                         | `freeroll-service.ts`                                      | The "Determine effective min prize (launch grace vs normal)" comment was repeated on two consecutive lines. Removed the duplicate.                                                                            |
| Empty description in UI                   | `Events.svelte`                                            | `/api/events` returns no `description` field, so the event modal rendered an empty paragraph. It is now rendered only when a description exists.                                                              |
| Pre-existing lint errors blocking commits | `WorldClock.svelte`, `Leaderboard.svelte`, `Wallet.svelte` | Three `no-empty` ESLint errors (empty `catch {}` blocks) failed the husky pre-commit hook for **every** commit in the repo. Fixed with explanatory comments, per AGENT_RULES ("fix the code, do not bypass"). |

## Checks after cleanup

```
> @poker/server@0.1.0 typecheck
> tsc --noEmit
[server typecheck exit: 0]

svelte-check found 0 errors and 0 warnings
[mini-app check exit: 0]

RESULT: 56 passed, 0 failed      (npx tsx apps/server/src/test-e2e.ts)
```

Removing the three exports was safe by construction: had anything imported them,
`tsc --noEmit` would have failed. It did not.

## Documentation produced

- `CHANGELOG.md` — every change this session, timestamped, with the two critical fixes called out.
- `PHASE_2_REPORT.md`, `PHASE_3_REPORT.md`, `PHASE_4_REPORT.md`, `PHASE_5_REPORT.md`, `PHASE_6_REPORT.md`.
- `FINAL_REPORT.md` — full status, features, bugs, limitations and production next steps.
- `PROJECT_HANDOFF.md.txt` — updated to the final state.

## Known issues NOT fixed (need a product decision)

1. **`users.grandfathered` is never read.** Migration 019 states that users who joined
   during the first 3 months "keep their generous rakeback forever", but the payout path
   (`tierForRake()` in `loyalty/service.ts`) never consults the flag. With rakeback now a
   flat 25%, the promise in migration 019 is silently unenforceable. Either implement the
   flag in the rakeback calculation or retire the claim.
2. **`/api/events` returns raw rows with no `description`.** The UI now tolerates the
   missing field, but the event modal has no body text. Needs either a server field or
   removal of the UI affordance.
3. **`Events.svelte` renders `<TopBar />` without navigation callbacks.** `App.svelte`
   mounts `<Events />` with no props, so TopBar's wallet/settings buttons are no-ops.
   Wiring them means adding an `onNavigate` prop to `Events` and passing `navigate`.
4. **Mission farming on free tables.** `hands_played` / `hands_won` count free-table hands
   (the mission copy says "Play 10 hands today" with no mode restriction). If that becomes
   an XP-farming vector, restrict the wiring in `game-manager.ts` to `room.mode === 'real'`
   in one place.
