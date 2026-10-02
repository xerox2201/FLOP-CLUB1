# Phase Plan — Flop Club

## Phase 1 — Critical Financial Fixes

**Time: 2h. Priority: HIGHEST.**

### 1.1 Flat Instant Rakeback 25%

File: `apps/server/src/loyalty/definitions.ts`

Current TIERS array (approximate):
welcome: 0.60
bronze: 0.50
silver: 0.45
gold: 0.40
platinum: 0.35
diamond: 0.30

Target: All 6 = `0.25`. Add constant:

```ts
export const INSTANT_RAKEBACK_PCT = 0.25;
Then reference it in all 6 tiers. Tier structure is preserved (for VIP labels, vouchers, seeds, shop discounts).
Verify after:
grep -n "rakebackPct" apps/server/src/loyalty/definitions.ts
All 6 lines should show 0.25
```
