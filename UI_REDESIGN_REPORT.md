# UI_REDESIGN_REPORT.md — Phase 7 (Visual Enhancement Only)

Date: 2026-10-01
Scope: CSS only. No logic, state, HTML structure, socket handling or API changes.

---

## 1. Files changed

| File                        | Type of change                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/mini-app/src/app.css` | **The only file modified.** CSS custom properties, gradients, radii, background rules, component-layer classes, keyframes. |

```
$ git status --short apps/mini-app/src
 M apps/mini-app/src/app.css

$ git status --short apps/server/src
(empty)
```

## 2. Confirmations requested

- **No `.ts` file was modified.** `git status --short apps/server/src` is empty; no
  server file of any kind was touched.
- **No component logic was modified.** No `.svelte` file was edited at all — not
  `Table.svelte`, not `PokerTable.svelte`, not `PlayerSeat.svelte`, not `PlayingCard.svelte`.
  Nothing was changed for state, props, functions, socket handlers, API calls or markup.
- **No HTML structure was modified.** The diff is confined to `app.css`.
- **Verification after the change:**
  - `npm -w apps/mini-app run check` → `svelte-check found 0 errors and 0 warnings`
  - `npm -w apps/mini-app run build` → `✓ built in 2.69s` (Tailwind/PostCSS compiled the new
    CSS; this is the check that actually validates CSS, since `svelte-check` does not).

## 3. What was changed in `app.css`

### Task 1 — Palette

Added the requested token block verbatim:

```css
--color-bg-body: #0a0e1a --color-bg-panel: #0f1a2e --color-bg-card: #1a2d4a
  --color-bg-hover: #2a4a7a --color-navy-darkest: #0a0e1a --color-navy-dark: #0f1a2e
  --color-navy: #1a2d4a --color-navy-light: #2a4a7a --color-red-dark: #8b1a1a --color-red: #c41e3a
  --color-red-light: #e63946 --color-gold: #d4af37 --color-gold-light: #e8c45a
  --color-gold-dark: #b8861b --color-text-primary: #e8e8e8 --color-text-secondary: #a0a0a0
  --color-text-muted: #6b7280;
```

**Deviation (deliberate, see §4.2):** the pre-existing token _names_ were not deleted —
they were re-pointed at the new palette, e.g. `--navy: var(--color-navy)`,
`--gold: var(--color-gold)`. `app.css` itself depends on those names (`.panel`, `.card`,
`.btn-gold`, `.btn-blue`, `.btn-danger`, `.btn-success`, `.btn-ghost`, `.text-gold`,
`.gold-texture`, all radii and shadows) and `Settings.svelte` uses `var(--shadow-card)`
six times. Deleting the names would have broken them; re-pointing shifts every value to
the new palette with no component change.

Also updated: `--grad-navy` and `--grad-danger` to the new navy/red values; `--r-md`
10→12px and `--r-lg` 14→16px (the "increase border-radius slightly" request).

### Task 2 — Table / cards

- Felt deepened to the new navy with a radial depth gradient and an inner vignette
  (`.felt-navy`).
- Added `.felt-trim-gold`, `.pot-display` (larger, gold, glowing), `.chip-navy`,
  `.chip-red` (navy/red chips with a 3D bevel), `.seat-active-gold` (gold glow ring),
  `.timer-ring-gradient` (red→gold conic sweep) and `.avatar-frame-gold`.
- `.panel`, `.panel-glass` and `.card` re-based onto the new navy values, with a slightly
  stronger gold border on `.card`.
- **Discovered and fixed a dead-class bug:** `PokerTable.svelte` applies `felt-cash`,
  `felt-tournament`, `felt-rim` and `felt-rim-final`, but **no CSS anywhere defined them**.
  They are now defined (navy felt + gold trim ring; a stronger ring for the final table).

### Task 3 — Effects

Added exactly as specified:

```css
.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 24px rgba(212, 175, 55, 0.3);
  transition: all 0.2s ease;
}
.card.winner {
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.6);
  animation: winner-pulse 0.6s ease-in-out;
}
@keyframes winner-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
```

### Task 4 — Background

`body` now uses the requested
`linear-gradient(135deg, #0a0e1a 0%, #0f1a2e 50%, #1a2d4a 100%)` with
`background-attachment: fixed`, layered over the existing `/bg-pattern.webp` overlay
(which exists — verified). The `body::before` vignette was re-tinted to the new navy.

## 4. Honest findings and deliberate deviations

### 4.1 There was never a green felt

The brief asked to "replace green felt with dark navy felt" and to update "old green
colors". The codebase was **already navy + gold**: `.felt-navy`, `.table-rail-gold` and
`.table-rail-navy` already existed with navy values, and the body background was already
`#05080f`. No green felt existed to replace. The felt was deepened toward the new,
slightly lighter navy scale rather than converted.

### 4.2 The semantic green was kept on purpose (the one instruction not followed literally)

`--success: #10b981` (emerald) is the only "green" in the stylesheet, and it is used in
**~247 places** as a _meaning_ colour — winning/paid amounts (`text-emerald-400`), "LIVE"
pulse dots, check marks, success toasts, `.btn-success`, `--grad-success`.

Remapping green → red would have (a) rendered `.btn-success` in the danger colour and
(b) shown players' **winnings and rakeback in red**, inverting the meaning of the most
money-sensitive text in the product. I therefore kept `--success` and introduced the red
accents as new tokens (`--color-red*`), which now drive `--error` and `--grad-danger`.
This is a colour-semantics decision, not a structural one; if you want the literal
green→red swap, it is a one-line change to `--success`.

### 4.3 `.card.winner` is inert

No template applies a `winner` class anywhere (grep for `'winner'` in markup: 0 matches).
The rule and keyframes were added exactly as requested, but they cannot trigger without a
markup change, which this phase forbids. Winner highlighting already exists through the
pre-existing `.winner-glow` (PlayerSeat) and `.winner-glow-card` (PokerTableMobile) rules.

### 4.4 The table's felt/seats/pot/chips are inline-styled, so they are out of scope

`Table.svelte`, `PokerTable.svelte` and `PlayerSeat.svelte` paint the felt, seat rings,
timer, avatar frames, chips and pot with **inline `style="..."` attributes**, not classes.
Changing those means editing inline style values, which the phase rules exclude ("ONLY
change CSS variables and Tailwind classes"). The new classes listed in §3 (Task 2) are
ready to be applied to those elements in a follow-up markup-only pass; they are currently
available but not attached to anything, so they change nothing by themselves.

Likewise, the playing-card border radius is computed in JS
(`PlayingCard.svelte`: `radius = Math.max(3, s.w * 0.09)`) and was left untouched, since
changing it would be a logic change. The requested "8px → 10px" radius increase was
applied to the CSS radius tokens instead.

### 4.5 Verification limitation

`svelte-check` does not analyse CSS, so it cannot catch a bad selector or an invalid
declaration. The `vite build` was run in addition specifically to compile the stylesheet
through Tailwind/PostCSS, and it succeeded. **No browser or screenshot verification was
performed** — the visual result has not been seen rendered.

## 5. How to see it

```
npm -w apps/mini-app run dev      # http://localhost:5173/?uid=111&name=Ali
```

The palette, background gradient, panel/card colours and the card hover lift apply
globally. The felt trim classes apply only where already present in markup
(`felt-rim`, `felt-rim-final`); the remaining new classes need to be attached to the
table elements to have any effect.
