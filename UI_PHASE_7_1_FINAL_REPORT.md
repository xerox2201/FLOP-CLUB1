# UI_PHASE_7_1_FINAL_REPORT.md — Attaching Phase 7 classes to table markup

Date: 2026-10-01
Scope: `class="..."` attributes only, plus CSS-only additions in `app.css`.
Status: Batch 1, 2 and 4 applied. Batch 5 not executed (no approval given).
Every step verified with `npm -w apps/mini-app run check` **and** `npm -w apps/mini-app run build`.

---

## 1. Files changed (5)

```
 M apps/mini-app/src/app.css
 M apps/mini-app/src/components/PokerTable.svelte
 M apps/mini-app/src/components/TimerRing.svelte
 M apps/mini-app/src/components/poker/PlayerSeat.svelte
 M apps/mini-app/src/components/poker/PokerTableMobile.svelte
```

## 2. All classes added

### Batch 1 — `PokerTable.svelte` (6 additions)

| Line | Element                    | Class added                                                              |
| ---- | -------------------------- | ------------------------------------------------------------------------ |
| 320  | Desktop pot pill           | `pot-display`                                                            |
| 331  | Desktop pot amount         | `pot-display`                                                            |
| 391  | Opponent avatar wrapper    | `seat-active-gold` (conditional: `{isTurn ? 'seat-active-gold' : ''}`)   |
| 410  | Opponent TimerRing wrapper | `seat-active-gold` (element already inside `{#if isTurn}`)               |
| 593  | Hero avatar wrapper        | `seat-active-gold` (conditional: `{isMyTurn ? 'seat-active-gold' : ''}`) |
| 595  | Hero TimerRing wrapper     | `seat-active-gold` (element already inside `{#if isMyTurn}`)             |

### Batch 1 — `PlayerSeat.svelte` (1 addition)

| Line | Element                         | Class added                                                |
| ---- | ------------------------------- | ---------------------------------------------------------- |
| 78   | TimerRing wrapper (mobile seat) | `seat-active-gold` (element already inside `{#if isTurn}`) |

### Batch 2 — `app.css` (1 rule extended, 1 rule added)

```css
/* extended */
.seat-active-gold {
  border-radius: 9999px; /* <-- added: wrappers have no radius of their own */
  box-shadow:
    0 0 0 2px rgba(212, 175, 55, 0.85),
    0 0 18px rgba(212, 175, 55, 0.55),
    0 0 34px rgba(212, 175, 55, 0.25);
}

/* added, exactly the approved values */
.timer-ring-gradient-soft {
  background: conic-gradient(
    from 180deg,
    rgba(196, 30, 58, 0.2) 0%,
    rgba(230, 57, 70, 0.2) 35%,
    rgba(212, 175, 55, 0.2) 75%,
    rgba(232, 196, 90, 0.2) 100%
  );
  border-radius: 9999px;
}
```

### Batch 2 — `TimerRing.svelte` (1 addition)

| Line | Element                                    | Class added                |
| ---- | ------------------------------------------ | -------------------------- |
| 66   | Outer wrapper `<div class="timer-ring …">` | `timer-ring-gradient-soft` |

Note: the requested FIND string was single-line, but the file on disk is prettier-formatted
across three lines (`class="timer-ring"` / `class:pulsing={isPulsing}` / `style="…"`).
The patch was applied to the actual formatting with the same intent. **The SVG circles
(lines 76–99) were not touched** — `stroke="rgba(0,0,0,0.35)"` and `stroke={timerColor}`
are byte-identical to before.

### Batch 4 — `PokerTableMobile.svelte` (1 addition)

| Line | Element                                                                | Class added   |
| ---- | ---------------------------------------------------------------------- | ------------- |
| 522  | Mobile pot amount `<span class="font-black text-gold tabular-nums …">` | `pot-display` |

Nothing else in that file was touched.

## 3. Inline styles modified

**None.** No `style="..."` value was changed anywhere in this phase. In particular the
chip-pill background swap (Batch 5) was **not** executed, because no approval was given
for it in this round. The approved inline-style permission (background / box-shadow /
border-color / filter) therefore remains unused.

## 4. Inline styles deliberately left untouched

| File:line                              | Element                                                        | Reason                                                                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PokerChip.svelte:70–83`               | Chip disc                                                      | Per your decision: sprite-based (`background-image: url('/chips-set-hq.webp')`); `chip-navy`/`chip-red` cannot show without deleting the sprite. Read-only.                                                                               |
| `TimerRing.svelte:76–99`               | SVG progress circle                                            | Per your decision: do not touch the stroke. The halo was added to the wrapper instead.                                                                                                                                                    |
| `PokerTable.svelte:269–275`            | Felt inner shadow / highlight overlays                         | Not in the approved list; `felt-navy` would be redundant (the felt surface already carries `felt-cash` / `felt-tournament`, which are defined later in `app.css` and therefore win).                                                      |
| `PokerTable.svelte:290–292`            | Side-pot pills                                                 | Not in the approved list.                                                                                                                                                                                                                 |
| `PokerTable.svelte:427–435`            | Opponent avatar `border` + `box-shadow`                        | **Forbidden by your rule**: values are conditional on `isWin` / `isShowdownLose` / `isTurn`. Handled by putting `seat-active-gold` on the parent wrapper instead.                                                                         |
| `PokerTable.svelte:613–621`            | Hero avatar `border` + `box-shadow`                            | Same: conditional on `isWin` / `isMyTurn`.                                                                                                                                                                                                |
| `PokerTable.svelte:438, 624`           | Avatar frame (`bg-gradient-to-br from-amber-700 to-amber-900`) | Per your decision: do not modify; the existing gold gradient is already good.                                                                                                                                                             |
| `PokerTable.svelte:537–540`, `692–694` | Desktop chip / bet pills                                       | Batch 5 not approved.                                                                                                                                                                                                                     |
| `PokerTable.svelte:506–508, 667–669`   | WIN / LOSE pills                                               | Conditional on showdown state; not in the approved list.                                                                                                                                                                                  |
| `PlayerSeat.svelte:93–100`             | `avatar-ring` background gradient                              | Per your decision: winner=gold / turn=cyan / normal=navy logic is already correct, and the value is conditional.                                                                                                                          |
| `PokerTableMobile.svelte:392`          | Mobile felt container                                          | Per your decision: SKIP. Note: I did **not** complete a full read of this file (I read the pot region 505–544 and grep'd for felt/pot/chip/timer); the `<img>`-rendered-felt conclusion is yours, not something I independently verified. |
| `PokerTableMobile.svelte:517–518`      | Mobile pot pill                                                | Per your decision: SKIP, the inline style already achieves it.                                                                                                                                                                            |
| `Table.svelte` (all)                   | Route container & controls                                     | Owns no felt / pot / chip / seat markup; it only mounts `PokerTable` / `PokerTableMobile`.                                                                                                                                                |

## 5. Confirmations

- **No `.ts` file was modified.** `git status --short apps/server/src` is empty; nothing
  outside the five files listed in §1 changed.
- **No component logic was modified.** No function body, `let`/`export let`, reactive
  statement, event handler, socket subscription, API call, or store read was edited.
- **No HTML tag structure was modified.** Every component change is confined to a
  `class="..."` attribute value; no element was added, removed, moved or renamed.
- **No inline `style="..."` was modified** (see §3).
- Verification per step: `check` → 0 errors / 0 warnings every time; `build` → `✓ built in
3.04s` (app.css), `✓ built in 3.84s` (TimerRing), `✓ built in 3.95s` (PokerTableMobile),
  and 2.79s / 2.69s for the two Batch 1 files.

## 6. Honest caveats

1. **`.pot-display` weight is overridden.** The rule sets `font-weight: 800`, but both pot
   elements carry Tailwind `font-black` (900), and Tailwind utilities are emitted after
   `@layer components`, so 900 wins. The visible effect of `pot-display` on those spans is
   the **gold-light colour plus the soft text-shadow glow**, not a weight change.
2. **The desktop pot pill's "POT" label stays white.** It uses `text-white/70` (a Tailwind
   utility), which beats the components-layer `colour` from `pot-display`. Only the amount
   span (which uses the components-layer `.text-gold`) shifts to gold-light. This is
   consistent with the intent (make the amount prominent) but is a narrower effect than
   "the whole pill turns gold".
3. **No browser or screenshot verification was performed.** The geometry fix in
   `seat-active-gold` (border-radius) and the halo were reasoned from the CSS; the rendered
   result has not been seen.
4. `timer-ring-gradient-soft` is attached to the shared TimerRing wrapper, so **every**
   timer ring in the app (desktop opponents, desktop hero, mobile seats) now carries the
   halo, not just one place.

## 7. Suggested next phase — visual effects (proposals only, nothing applied)

1. **Playing-card hover lift.** Phase 7's `.card:hover` targets the panel `.card` class, not
   playing cards (which use `.card-outer` / `.card-face` in `PlayingCard.svelte`'s own
   `<style>` block). Adding a `.card-outer:hover { transform: translateY(-6px); box-shadow: … }`
   rule there would deliver the requested card lift. Visual-only, no logic.
2. **Winner celebration.** The `.card.winner` + `winner-pulse` keyframes from Phase 7 are
   currently inert (no markup applies a `winner` class). A class-only fix: apply
   `{isWin ? 'winner-pulse' : ''}` to the winner seat wrapper in `PokerTable.svelte` /
   `PlayerSeat.svelte` using the already-computed `isWin` / `isWinner` flags.
3. **Batch 5 (still pending).** Change only `background` in the desktop bet/chip pills
   (`PokerTable.svelte:537`, `692`) to `var(--color-bg-card)`.
4. **Reduced-motion support.** Wrap `winner-pulse`, `chip-pulse`, `allin-shake`,
   `allin-pulse` and `timer-pulse` in `@media (prefers-reduced-motion: reduce)` — an
   accessibility win and pure CSS.
5. **Contrast pass on the red accents.** Verify gold/red legibility over the new navy in
   the areas that now use `--color-red*` (danger buttons, error toasts).
6. **Retire the now-dead `timer-ring-gradient`.** Only the `-soft` variant is used; the
   opaque one can be removed to avoid future misuse.
