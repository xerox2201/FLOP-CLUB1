# PHASE 4 REPORT — Frontend Redesigns

Status: COMPLETE. `svelte-check` reports 0 errors / 0 warnings.

## Scope

Ten pages were redesigned to match the Home / Profile / Leaderboard visual language:
Tournaments, Shop, Settings, Achievements, Loyalty, Notifications, MyTournaments,
Events, HelpCenter, RewardsHistory.

For each page: hero section (icon tile + gradient title + one-line subtitle), a
stats/summary grid where the data supports it, the main content area, and proper loading
skeletons plus empty states. Palette stays gold (#d4af37 / #f4c95d / #f4e5a8) on navy
(#05080f / #070e1b / #0b1324 / #0f1f3a) with the existing accent colours.

## Independent verification (run by me, not just reported)

Emoji/Persian scan across all ten files:

```
Tournaments.svelte    emoji=0 persian=0      Shop.svelte          emoji=0 persian=0
Settings.svelte       emoji=0 persian=0      Achievements.svelte  emoji=0 persian=0
Loyalty.svelte        emoji=0 persian=0      Notifications.svelte emoji=0 persian=0
MyTournaments.svelte  emoji=0 persian=0      Events.svelte        emoji=0 persian=0
HelpCenter.svelte     emoji=0 persian=0      RewardsHistory.svelte emoji=0 persian=0
```

The only non-ASCII characters left are typographic: `—` (U+2014), `·` (U+00B7),
`…` (U+2026), `→` (U+2192, inside pre-existing FAQ answer text) and `─` (U+2500, in
section comments).

Props and endpoints were re-checked after the redesign:

| Page           | Prop                       | Endpoint(s)                                                         |
| -------------- | -------------------------- | ------------------------------------------------------------------- |
| Tournaments    | `onOpenTournament`         | `api.listTournaments({status})`                                     |
| Shop           | `onBack`                   | `GET /api/shop/packs`, `POST /api/shop/purchase`                    |
| Settings       | `onBack`                   | none (store-driven)                                                 |
| Achievements   | `onBack`                   | `GET /api/me/achievements`, `POST /api/me/achievements/:code/claim` |
| Loyalty        | `onBack`                   | none (store-driven)                                                 |
| Notifications  | `onBack`                   | via `lib/broadcasts` only                                           |
| MyTournaments  | `onBack`                   | `api.getMyTournaments(filter, 100)`                                 |
| Events         | none (App renders it bare) | `GET /api/events`                                                   |
| HelpCenter     | `onBack`                   | none                                                                |
| RewardsHistory | `onBack`                   | `GET /api/xp/history`, `GET /api/shop/purchases`                    |

## Behavioural fixes made along the way (all display-only, no endpoint or prop changed)

- **Settings.svelte** — two icon names that do not exist in `Icon.svelte` (`eye`,
  `spade`) silently rendered fallback circles; now `unlock` / `gem`. The card-theme
  subtitle no longer renders `nameFa`, and the language picker no longer renders flag
  emoji (2-letter code tile + English name instead) — required by the no-emoji rule.
- **Achievements.svelte** — the `✅` / `❌` toast strings became a `{message, kind}`
  pair rendered with `<Icon name="success"|"error">`; inline SVG glyphs replaced with
  the Icon component. Badge artwork stays `<img src={a.icon}>` because the server
  supplies `/badges/*.png` URLs, not icon names.
- **Loyalty.svelte** — the API's emoji `tierIcon` is mapped to an Icon glyph per tier.
  Also fixed a pre-existing double-dollar bug: the local `fmt()` already returns
  `"$x.xx"` and the markup prefixed another `$`, printing `$$12.00`.
- **Shop.svelte** — the two Persian strings (info bar, dev footnote) are now English
  and the emoji success glyph is an `<Icon>`.
- **Events.svelte** — pre-existing data-shape mismatch fixed defensively: `/api/events`
  returns raw rows (`starts_at`, `prize_pool_usd`) while the page read
  `ev.startsAt` / `ev.prize`, so every date and prize rendered blank. The reads are now
  tolerant (`startsAt ?? starts_at`, `prize ?? prize_pool_usd`) with a safe fallback
  label. **Still open:** the API returns no `description` field, so the modal's
  description line renders empty. That needs either a server field or dropping the line.

## Known limitation / follow-up

`Events.svelte` now renders `<TopBar />`, but `App.svelte` mounts `<Events />` with no
props, so TopBar's wallet/settings buttons use its default no-op callbacks. Wiring them
would require passing `navigate` into `Events` — left as-is to avoid changing the
component's public surface during a visual-only phase.

No dev server or screenshots were used for these ten pages; verification is
`svelte-check`, the character scans above, and re-checking props/endpoints by grep.
