# Flop Club — Project Handoff

Telegram Mini App Poker Platform.

## Project Info

| Field    | Value                                                                              |
| -------- | ---------------------------------------------------------------------------------- |
| Path     | C:\projects\poker-platform                                                         |
| Branch   | ai-table-fix                                                                       |
| Stack    | Svelte 5 + Vite + Tailwind 3 + Fastify + PostgreSQL 16 + Redis 7 + Socket.IO + TON |
| Dev mode | localhost:4000 (server), localhost:5173 (frontend)                                 |

## Confirmed Decisions

1. **Rakeback = Instant flat 25% for ALL tiers** (IMPLEMENTED: `INSTANT_RAKEBACK_PCT = 0.25`;
   was 60% welcome → 30% diamond).
   Tier STRUCTURE is preserved for VIP cosmetics, vouchers, seeds, shop discounts.
   Only the `rakebackPct` field changed to 0.25 for all 6 tiers.

2. **XP rate = 100 XP per $1 rake** (currently 250). `XP_PER_RAKE_USD = 100`.

3. **Referral = 12% direct / 3% indirect / 8% group** for 12 months.

4. **Duo Bonus** = 5% each side monthly (cap $2.50/duo/month).

5. **Freeroll cap** = `min(15% daily net, $300)`.

6. **Overlay cap** = `min(guaranteed, 5 × totalBuyIn)`.

7. **Bad Beat Jackpot** (planned): **2% of rake** (= $2 per $100 rake; the base is rake, NOT pot).
   0.5% of pot was rejected — rake is 3% of pot, so 0.5% of pot = $16.67 per $100 rake (8x the budget).
   Four+ loss 50%, Straight Flush 100%, split 50/25/25.

8. **Daily Missions** (planned): 5 missions.

9. **Weekly Rake Race** (planned): Bronze/Silver/Gold brackets.

## Current Checkpoint — Verified Working

- Auth via Telegram (dev fallback with `hash=dev`)
- Wallet = projection of ledger (migration 027)
- Telegram bot `@FlopClubOfficialBot` via long polling (Cloudflare Worker proxy)
- Referral end-to-end verified (DM `/start ref_XXX` → pending_ref → attribution → +5000 chips)
- Community channel `-1004498738051` + group `-1003995324740` registered
- Auto-post "Tournament Starting" verified
- Frontend pages: /referral, /my-money, /referral-team, /referral-milestones,
  /referral-leaderboard, /referral-history, /referral-affiliate, /books, /community
- `npm -w apps/mini-app run check` passes with 0 errors
- Phase 1 financial fixes live: flat 25% rakeback, 100 XP per $1 rake, freeroll cap, overlay cap
- Bad Beat Jackpot + Daily Missions live (migration 033, services, routes, Home UI, daily cron)
- Weekly Rake Race live (migration 034, service, routes, Leaderboard tab, full page, weekly cron)
- 10 frontend pages redesigned to the Home/Profile/Leaderboard style
- `npx tsx apps/server/src/test-e2e.ts` → 56/56 pass, repeatable across consecutive runs
- `npx tsx apps/server/src/test-autopost.ts` → 8/8 pass
- Two critical money bugs fixed in Phase 5: rakeback/XP were never paid, and per-hand
  referral earnings were never recorded. See FINAL_REPORT section 5.

## Current Checkpoint — Not Verified

- Telegram delivery of auto-posts: the B2/B3 pipeline is verified (post slot, payload,
  idempotency, cleanup) but the actual send failed here — the Telegram API proxy is
  unreachable from this environment (`ECONNREFUSED 10.10.34.36:443`). Re-run
  `test-autopost.ts` on a host with egress and look for `[tg-bot] announced tournament`.
- Duo bonus monthly job (not exercised)
- No browser/screenshot verification of the redesigned pages (svelte-check + scans only)
- `users.grandfathered` is never read by the rakeback calculation (see FINAL_REPORT 6.2)

## Phases — Status

### Phase 1 — Critical Financial Fixes — DONE

Flat 25% rakeback for all 6 tiers (`INSTANT_RAKEBACK_PCT`), `XP_PER_RAKE_USD = 100`,
freeroll cap `min(15% daily net, $300)`, overlay cap `min(guaranteed, 5 × totalBuyIn)`.

### Phase 2 — Bad Beat Jackpot + Daily Missions — DONE

Migration 033 (`bad_beat_pool`, `bad_beat_payouts`, `missions`, `mission_progress`),
`bad-beat-service.ts`, `mission-service.ts`, `bad-beat-routes.ts`, `mission-routes.ts`,
`BadBeatPool.svelte`, `Missions.svelte`, `routes/Missions.svelte`, daily reset cron.

### Phase 3 — Weekly Rake Race — DONE

Migration 034 (`weekly_race_entries`), `weekly-race-service.ts`,
`weekly-race-routes.ts`, `routes/WeeklyRace.svelte`, Leaderboard tab, weekly close cron.

### Phase 4 — Frontend Redesigns — DONE

Tournaments, Shop, Settings, Achievements, Loyalty, Notifications, MyTournaments, Events,
HelpCenter, RewardsHistory.

### Phase 5 — Testing — DONE (one environment limitation)

`test-e2e.ts` (56 checks) and `test-autopost.ts` (8 checks). Telegram delivery could not be
verified from this environment.

### Phase 6 — Polish + Docs — DONE

Dead exports removed, duplicate comment removed, empty UI paragraph hidden, the three
pre-existing lint errors that blocked commits fixed, `CHANGELOG.md`, `PHASE_2..6_REPORT.md`
and `FINAL_REPORT.md` written.

## Financial Model Target

Per $100 gross rake:

- Instant Rakeback 25% = $25
- Bad Beat Pool (2% of rake) = $2
- Liquidity Mining = $4
- Referral + Group = $4.50
- Daily Missions = $3
- Weekly Race = $3
- Freeroll = $1.50
- Seeds/misc = $1.50
- **Total Rewards = $44.50**
- Ops = $22.50
- **House Net = $33.00**

Target margin: 25% floor. Actual margin: 33%. Effective return to players: 44.5%.

Note: the earlier Triple-Layer model (Instant Rakeback 15% + Weekly Vault 10% +
Monthly Cashback 10%) was never implemented and is dropped. Weekly Vault and
Monthly Cashback are removed from the model; rakeback is a single flat 25%.

## Known Issues (Accepted)

- `ECONNRESET` intermittent from Cloudflare Worker (auto-recovers)
- `deleteWebhook` fails on cold start (non-blocking, harmless)
- `APP_URL=http://localhost:5173` — Mini App button skipped (needs HTTPS)

## Debug History (chroot points)

| #   | Problem                                     | Root Cause                            | Fix                           |
| --- | ------------------------------------------- | ------------------------------------- | ----------------------------- |
| 1   | `Cannot find module './referral-routes.js'` | File not created                      | Created                       |
| 2   | JWT missing `uid`                           | Old `upsertUser` return shape         | Patched auth                  |
| 3   | `/api/books` ambiguous `amount`             | Missing table alias                   | `SUM(e.amount)`               |
| 4   | `ngrok` blocked in Iran                     | ngrok policy                          | Switched to Cloudflare Worker |
| 5   | `Only HTTPS links allowed`                  | Telegram `web_app` button needs HTTPS | Skip button in dev            |
| 6   | Duplicate route `/api/debug/cron/starting`  | Double declaration                    | Removed                       |
| 7   | `/start  ref_XXX` (double space) fails      | `split(' ')` broken                   | `split(/\s+/)`                |
| 8   | `EADDRINUSE` on restart                     | Previous node alive                   | `Get-Process node \| Stop`    |
| 9   | `tg_sendMessage_failed: timeout`            | Cloudflare cold start                 | Timeout 25s + retry 3×        |
| 10  | `deleteWebhook failed` on startup           | ECONNRESET                            | Non-blocking `.then()`        |

## Environment Variables (names only — no values)

NODE_ENV, PORT, PG_POOL_MAX, DATABASE_URL, REDIS_URL, JWT_SECRET, ADMIN_SECRET,
CORS_ORIGINS, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET,
TELEGRAM_API_BASE, PUBLIC_URL, APP_URL, TON_NETWORK, TON_API_KEY,
TON_HOT_WALLET_MNEMONIC, TON_DEPOSIT_ADDRESS, TON_MIN_DEPOSIT,
TON_MIN_WITHDRAW, TON_WITHDRAW_FEE

## Migrations Applied

- 027_wallets_from_ledger
- 028_telegram_community
- 029_referral
- 030_referral_polish
- 031_referral_earnings_unique_fix
- 032_community_posts
- 033_bad_beat_missions
- 034_weekly_race

## New Services

- `telegram-bot.ts` — bot, long polling, auto-posts
- `telegram-routes.ts` — webhook, community endpoints
- `referral-service.ts` — attribution, earnings, milestones, affiliates
- `referral-routes.ts` — 11 referral endpoints
- `my-money-routes.ts` — user financial transparency
- `books-routes.ts` — public books
- `community-cron.ts` — auto-post scheduler (B1/B2/B3)
- `bad-beat-service.ts` — jackpot pool, trigger detection, ledger payouts
- `mission-service.ts` — daily missions: progress, claims, UTC reset
- `weekly-race-service.ts` — weekly brackets, accrual, settlement
- `test-e2e.ts` — 56-check end-to-end money-path suite
- `test-autopost.ts` — B2/B3 auto-post verification

## Design Tokens

- Font: Sora (400/500/600/700/800)
- Background: `#05080f` + `bg-pattern.webp`
- Navy: `#05080f`, `#070e1b`, `#0b1324`, `#0f1f3a`
- Gold: `#d4af37`, `#e8c45a`, `#b8861b`, `#f4e5a8`
- Accents: royal `#1e3a8a`, cyan `#22d3ee`, violet `#8b5cf6`, success `#10b981`, error `#ef4444`

## Rules

- No Persian in UI
- No emoji in code (allowed in user-facing Telegram strings)
- Always check accounting: platform must never lose money
- Use FIND/REPLACE patches, never full-file paste unless necessary
