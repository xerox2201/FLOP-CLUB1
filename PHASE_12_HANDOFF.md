# PHASE 12 HANDOFF — continue in a FRESH session (cheap path)

Goal: finish the Flop Club backlog with minimal tokens. Work in a new session and
paste this file. Do NOT re-read the whole repo: every path below is exact.

## Environment facts (do not rediscover)

- Repo: `C:\projects\poker-platform` (Windows, pwsh). Frontend 5173, backend 4000, both running.
- Verify loop after every file: `npm -w apps/mini-app run check` (must be 0 errors AND 0 warnings)
  - `npm -w apps/mini-app run build`; server changes: `npm -w apps/server run typecheck`.
- NEVER touch: `packages/poker-engine/**`, `apps/server/src/hand-persister.ts`,
  `apps/server/src/ledger.ts`, migration 027.
- Screenshot harness (mine, dev-only): `node e2e/shoot.mjs` -> PNGs in `%TEMP%\flopclub-shots`.
  It opens table #16 (8-max) and captures home/tables/tournaments/wallet/profile desktop+mobile,
  and prints browser console errors.
- Bot driver: `node e2e/bot-table.mjs <hands> <seconds> <tableId>` (background job).
  Reads `.env`, signs HS256 tokens with node crypto (jsonwebtoken is NOT resolvable from root),
  connects 8 seeded bots (run `npm -w apps/server run seed:bots` first), `table:join` -> `table:action`.
- Test table: id **16** "Test 8-Max", 8 seats, free, turbo, blinds 5/10 (created by `e2e/make-8max.mjs`).
- Socket protocol: `io(url,{auth:{token}})`; `table:join {tableId}`; `table:action {action,amount,commandId}`.
  State has NO `currentBet`: compute `maxBet = max(seats[].betThisStreet)` (engine game.ts:356).

## Remaining work (ordered, each verified)

1. CLEANUP `apps/mini-app/src/components/poker/PokerTableMobile.svelte`: remove the now-redundant
   early-return block in `getSizes` that special-cases `total >= 6` (all branches are already
   `cardSize: 'xs'`; the block duplicates potFont 17/15).
2. CLEANUP `apps/mini-app/src/routes/Shop.svelte`: 3 remaining raw `toFixed(2)` money strings ->
   `fmtAmount(...)` (import already present).
3. DRIVER `e2e/bot-table.mjs`: ignore `hand_not_active` (a post-hand race; the engine guard is correct).
4. FAST TEST (optional): in `apps/server/src/game-manager.ts` reduce the inter-street / hand-end
   delays for speed `turbo`/`hyper` only, so 100 hands finish in ~1 min (currently 72 hands / 600 s).
5. TYPOGRAPHY (optional, 13 screens): unify the scale 9/10/11/12/14/15/17/26 to one ramp, headers via
   `.sec-head`/`.sec-title`, numbers >= 14px. Shared classes already exist in `apps/mini-app/src/app.css`.
6. FINAL: re-shoot, review `Wallet` + `Tables`, then commit (16+ files changed; last commit 33fab82).

## State of the work (already done, verified, do not redo)

- Phase 10: all 13 screens modernised (palette, headers, numbers, shared classes).
- Phase 11: emojis 84 -> 0 in svelte (28 functional kept: avatar glyphs + language flags);
  icons verified 64 defined / 0 undefined-used (fixed `shield_alert` -> `shield`);
  violet 240+ values -> electric blue (0 left app-wide); money via shared `fmtAmount` in 15 files.
- Table: one uniform board card size (xs 32px) at every seat count; hero = one step up;
  5 community cards centred inside the ring (row width 84%, `justify-center`); extra gold/blue
  rings I had added are removed (fallback ring + `scale(1.05)`); centre logo 58px/0.22 +
  "FLOP CLUB" wordmark; hero cards at `heroCardsY = 72`; mobile felt height clamped to the viewport;
  desktop shell widened (`--page-max` 520 -> 1120px) with a 2-column table grid; hero hand label
  clamps to 3 lines; header no longer prints the occupied count as "N Max" (now "N players").
- Bots: 72 hands / 8 players ran with ZERO app errors (2 driver-side `hand_not_active` races).
