# TABLE REBUILD SPEC — PokerStars / GGPoker standard

Status: APPROVED DIRECTION (user confirmed: both layouts broken, full rebuild, PS/GG reference).
Rule: this is a REBUILD of the visual layer, not incremental patching.

## 0. Non-negotiables (protected)

- NO edits: `packages/poker-engine/**`, `hand-persister.ts`, `ledger.ts`, migration 027.
- Socket event names/payloads: additive fields only.
- Hand strength: HERO ONLY (server already gates `bestHandName`).
- After every file: `npm -w apps/mini-app run check` (must be 0 errors AND 0 warnings) +
  `npm -w apps/mini-app run build`; server changes: `npm -w apps/server run typecheck`.
- One file at a time. Revert + report + STOP on failure.
- No emoji in code. English UI text.

## 1. Geometry — ONE source of truth for both layouts

Build `apps/mini-app/src/lib/table-geometry.ts`:

- `seatPositions(count, heroIndex)` → ellipse positions, hero ALWAYS bottom-centre.
  Angles start at 90° (bottom) and fan evenly; x = 50 + 46*cos, y = 50 + 40*sin (percent of felt).
- `tableBox(vw, vh, compact)` → `{ w, h }` with `h = w * 1.12`, `w = min(1100, 0.92*vw, (vh - chrome)/1.2)`.
- `chipBreakdown(amount)` → `[{ denom, count }]` largest-first from [1000,500,100,25,5,1,0.5,0.25].
- Both `PokerTableMobile.svelte` and `PokerTable.svelte` consume these. No duplicated layout maths.

## 2. Table surface (both layouts identical in look)

- Rail: thick padded band, 10-14px, dark leather (`#0d1420` → `#060910`), inner highlight 1px
  `rgba(255,255,255,0.08)`, outer gold hairline `rgba(212,175,55,0.55)`, outer soft shadow.
- Felt: radial gradient centre-38% `#2f5586` → `#1b3355` 55% → `#0b1424` 100%.
- Felt texture: subtle repeating pattern at 4-6% opacity + inner shadow `inset 0 0 90px rgba(0,0,0,0.75)`.
- Centre watermark: logo, 46px, opacity 0.07.
- NO thin-ring-only table. NO transparent felt.

## 3. Seats

- Reuse ONE seat component for both layouts (`poker/PlayerSeat.svelte`), size props driven by
  `seatScale(count)`: avatar 60→32px, name 11→8px, stack 11→8px as count 2→9.
- Panel: dark translucent (`rgba(6,10,20,0.82)`), 1px gold hairline, 8px radius, name on top,
  stack below, hero hand strength under the name (2-line clamp, 8-9px, gold).
- Active seat: gold ring + timer ring around avatar, sweep from 12 o'clock.
- Folded: 45% opacity, no ring. All-in: red badge, avatar ring pulses.
- Winner: gold ring + 1.04 scale + soft gold glow; losers dim to 55%.

## 4. Cards

- Board: centred on the felt at 50%/46%, gap 6px (mobile 4px).
- Hero cards: directly above the hero seat (y ≈ 76%), larger than board by one step.
- Opponent cards: attached to their seat, above or below depending on seat y.
- Sizes (mobile): board 60px 2-4p / 44px 5+; hero +1 step. Desktop: board `SZ.boardCardSize`.
- Every card: 1px dark border, 2px radius, drop shadow, inner top highlight.
- Winner's cards: z-index ABOVE the result pill; gold pulse ring; never covered.

## 5. Money & chips

- ALL amounts: `Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})` → `$1,020.00`.
  Apply to stack, bet, pot, payouts, raise slider, action bar. One helper `fmtMoney()`.
- Stack font +15% vs current; `font-variant-numeric: tabular-nums`.
- Pot: gold gradient text, count-up over 300ms, 22px mobile / 28px desktop.
- Bets and pot show REAL chip stacks via `chipBreakdown()` + `PokerChip.svelte`
  (sprite `/chips-set-hq.webp`), 3px vertical offset per chip, max 5 chips + "+n".

## 6. Action bar & panels

- Same component/behaviour on both layouts; FOLD / CHECK-CALL / RAISE with amounts on buttons.
- Pre-action panel only when not acting; Provably Fair footer always visible above it.
- Z-order (bottom → top): felt < seats < board < cards < bet chips < result pill < action bar < modals.

## 7. Milestones (each ends with check+build+report, then user screenshot)

M1 Geometry module + rail/felt rebuild (both layouts).
M2 Seats unified + positions + winner/fold/active states.
M3 Cards: sizes, per-seat placement, winner z-order.
M4 Money formatting + chip stacks + pot count-up.
M5 Action bar / panels / Provably Fair footer unification.
M6 Polish: typography scale, shadows, animations, mobile 393x852 + desktop 1920x1080 review.

## 8. STATUS (round 13) — done and verified

All rounds ran with `svelte-check` 0 errors / 0 warnings + `vite build` OK; server `tsc --noEmit` OK.
Protected files (poker-engine, hand-persister.ts, ledger.ts, migration 027) untouched.

M1 DONE - `/table-top-desktop.webp` (1400x876) was shipped but UNUSED; the desktop drew two CSS
divs instead (thin ring + gradient), and its box was 1/1.12 tall vs the art's 0.626.
Now both layouts render `poker/TableSurface.svelte`; desktop box is 1400/876.
M2 DONE - `src/lib/table-geometry.ts` is the single geometry source (`seatPositions`,
`tableBox`, `fitSurface`, `chipBreakdown`, `fmtMoney`, `fmtAmount`). The desktop's
5-row angle table and the mobile's 9-row hand-tuned table were both deleted.
Verified numerically that the generic formula reproduces the old desktop angles.
M3 DONE - Board centred at 46% in both layouts; mobile hero cards 78%; winner pill z-70 -> z-50;
winning cards z-60 so they paint above the pill; gold pulse ring on winner cards in
BOTH layouts (union across all winners, split pots included).
M4 DONE - All money through `fmtAmount` ($1,228.71 with separators). FIXED: `potY` was a dead
           hardcoded 41 (S.potTop was never read) which kept the pot on top of the board.
           Pot 22px mobile / 28px desktop with a gold gradient fill (@supports-guarded).
           Stack font +15%, panel width +10%. Real chip stacks (removed a Math.min(pot,100) cap
           that made every big pot render as a single $100 chip). Pot count-up 300ms both layouts.
M5 DONE - Action bar and pre-action panel are already one shared instance for both layouts;
fixed the Provably Fair footer being hidden under the action bar; bottom slot is now
`min(720px, 92vw)` in both.
M6 DONE - Dead code: SEAT_LAYOUTS (68 lines) + 56 dead Sizes field lines + 24 dead CSS rule
blocks (4181 chars). Polish: every card now has a dark hairline + drop shadow + top
highlight; desktop seat panels converted from light `bg-soft-white` to the same dark
translucent gradient the shared PlayerSeat uses (white name / gold stack / gold hero
hand name); desktop seat panels now dim with the avatar when folded; action bar and
pre-action panel share one responsive bottom slot; Provably Fair footer moved to the
bottom-left so it can never sit under the hero panel; hero seat block re-anchored to
the bottom edge (it overflowed the shorter table box and collided with the action bar).
Also verified already correct, no change needed: timer ring sweeps from 12 o'clock
(`rotate(-90deg)`), and PokerChip already renders a gold `xN` overflow badge when a
denomination exceeds `maxStack`.

## 9. REMAINING — needs a screenshot of the running table

R1 Desktop seat markup still has its own inline panels instead of the shared
`poker/PlayerSeat.svelte`. This is the largest remaining change and purely visual.
R2 Fine-tuning that is currently only calculated, never seen: seat radii
(desktop rx40/ry35, mobile rx40/ry41), `holeTop`, chip sizes, seat spacing.
R3 DONE - every dead `felt-*` rule block removed from `app.css` source; all live classes
(pot-display, surface-fallback, winning-card-glow, hand-strength-hero, pf-footer,
table-shell) confirmed still shipped in the built CSS.
R4 DONE - 24 dead rule blocks (4181 chars) removed from app.css: panel-glass, btn-danger/ghost/
success (+hover variants), text-gold-gradient, t-h1..t-h4, t-body, t-caption,
chip-navy/red, avatar-frame-gold, table-rail-gold/navy, gold-texture, animate-deal/
flip/gold-pulse/float-up/spin-slow. Braces balanced, @layer blocks intact, re-audit
reports zero dead rules. Live classes verified still shipped.
