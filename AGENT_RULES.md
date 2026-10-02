# Rules for AI Agent — Flop Club Project

## Identity

You are continuing an existing project, NOT starting fresh.
Treat `PROJECT_HANDOFF.md` as the source of truth.
Treat the actual code on disk as the implementation truth.
If they conflict, ask before assuming.

## Before Any Change

1. Read the relevant file completely (not just the changed lines).
2. Grep for usages of the function/variable you're about to change.
3. If it affects money (rakeback, XP, payouts, chips), STOP and ask.
4. Confirm the exact FIND/REPLACE with the user.

## Patch Style

- Use FIND/REPLACE, never full-file paste.
- Include 3-5 lines of context around FIND and REPLACE.
- No placeholders like "..." in FIND or REPLACE.
- One logical change per patch.
- After each patch, run the typecheck.

## After Every Patch

Run BOTH:
npm -w apps/server run typecheck
npm -w apps/mini-app run check

If either fails:

1. STOP.
2. Show the error.
3. Fix the error.
4. Re-run check.
5. Only then continue.

## Batch Size

- Max 4-5 files per batch.
- Confirm with user before moving to the next batch.

## What NOT to Touch

These are working and must not be modified without explicit approval:

- `apps/server/src/hand-persister.ts`
- `apps/server/src/ledger.ts`
- Migration `027_wallets_from_ledger.sql`
- Telegram bot polling logic in `telegram-bot.ts`

## Rules

- Never invent files, endpoints, or test results.
- Never claim something works unless verified.
- Persian in UI is FORBIDDEN. Only English.
- Emoji in code is FORBIDDEN. (Allowed in user-facing Telegram strings.)
- Every change must be verifiable with a specific command.
- If something breaks, debug. Do not use placeholders.
- When ambiguous, ASK. Do not guess.

## Accounting Rule

Before any change to money flow:

- Write down the per-$100-rake cost.
- Verify total rewards ≤ 52%.
- Verify house margin ≥ 25%.
- If margin drops below 25%, STOP.

## Communication

- Answer in Persian when the user speaks Persian.
- Use clear, non-technical language for explanations.
- Show command outputs verbatim.
- When unsure, ask, don't guess.

## Git

- Before each batch: remind user to commit.
- If a pre-commit hook fails (lint, typecheck): fix first, do not bypass.

## Current Priority

Phase 1 — Critical Financial Fixes (see PROJECT_HANDOFF.md).

Do not jump to Phase 2 or 3 until Phase 1 is confirmed working.
