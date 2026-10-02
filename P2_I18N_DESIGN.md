# P2 — Internationalization (i18n) Design

Status: approved — implementation starts with Wave A.
Scope: `apps/mini-app` (UI) + `apps/server` (locale persistence + Telegram messages).

## 0. Confirmed Decisions

| #   | Decision                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Rule change: "no Persian in UI" becomes "no hardcoded Persian strings in UI" (see AGENT_RULES).                                                                                                                    |
| 2   | Library: **in-house core** (option A). Public API is fixed: `t`, `lang`, `setLang`, `LANGUAGES`, `formatNumber`, `formatDate`, `formatCurrency`, `dir`. A later Paraglide migration must touch only `src/i18n/**`. |
| 3   | Digits: locale digits for money/statistics, `latn` for machine values (rank, hand ID, blind, seed, hash, TON address, tx hash, currency code). Machine values render `dir="ltr"` + `font-mono`.                    |
| 4   | `Admin.svelte` and `TournamentFieldsDebug.svelte` stay English-only.                                                                                                                                               |
| 5   | LTR islands (felt, player seats, chips, cards, `ProvablyFairFooter`) are never mirrored.                                                                                                                           |
| 6   | Font: `@fontsource/vazirmatn` for RTL.                                                                                                                                                                             |
| 7   | `Icon.mirror` prop for direction-aware icons.                                                                                                                                                                      |
| 8   | Wave order A → I, one commit per wave.                                                                                                                                                                             |
| 9   | String-leak ratchet test prevents regressions.                                                                                                                                                                     |
| 10  | Server-side i18n covers Telegram messages only; API errors stay machine codes mapped on the client.                                                                                                                |
| 11  | `tError(code)` maps server error codes to user-facing text.                                                                                                                                                        |
| 12  | Migration 037 adds `users.language_explicit`.                                                                                                                                                                      |
| 13  | `missions` / `achievements` are translated by `code`; DB text is the fallback.                                                                                                                                     |
| 14  | `broadcasts` and `tournaments.name` stay authored; `title_i18n jsonb` is deferred to P3.                                                                                                                           |

## 1. Current State Audit

| Item                    | Value                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte files            | 76 (`apps/mini-app/src`, 25,835 lines)                                                                                                    |
| Extractable strings     | ~936 (813 text nodes + 123 attributes)                                                                                                    |
| Current i18n adoption   | 17 `$t(` calls in 5 files                                                                                                                 |
| Locales                 | `en`, `fa`, `ar`, `tr`, `ru`, `zh` in `apps/mini-app/src/i18n/*.ts`                                                                       |
| `en` catalog size       | 145 leaf strings                                                                                                                          |
| Catalog gaps            | `fa` misses 47 keys, `ar`/`tr`/`ru`/`zh` miss 50 each (all in `tournaments`/`tournament`)                                                 |
| `t()` limitations       | no interpolation, no plural, no fallback merge, no missing-key report, eager 6-locale import                                              |
| Known bug               | `tournaments.inMinutes` / `inHours` placeholders are printed raw                                                                          |
| RTL today               | only `document.documentElement.dir` from a store subscription; no `dir=` anywhere                                                         |
| Rule violation          | emoji flags in `LANGUAGES[].flag` (`i18n/index.ts`), emoji in `tournament.toastUnregistered`                                              |
| Persian leaks in UI     | `AdminPrompt.svelte:32`, `InfoSheet.svelte:71`, `TournamentFieldsDebug.svelte`                                                            |
| Fonts                   | Sora only — no Persian/Arabic glyphs                                                                                                      |
| Tailwind                | 3.4.4 — logical utilities and `rtl:`/`ltr:` variants available                                                                            |
| Physical utilities      | `left-` 74, `right-` 41, `rounded-l-` 126, `text-left` 46, `text-right` 35, `border-r` 34, `translate-x` 56, `ml-` 20, `pl-` 16, `pr-` 12 |
| Tiny text               | `text-[9px]` 348, `text-[10px]` 305, `text-[11px]` 221                                                                                    |
| Directional icons       | `arrow-left` 25, `arrow-right` 18                                                                                                         |
| Inline positioning      | 22 `left:` + 5 `right:` (mostly `components/poker/*`)                                                                                     |
| Locale-sensitive format | 61 `toLocale*` calls, 7 `Intl.` uses, 11 hardcoded `$`                                                                                    |
| Server locale           | `users.language text default 'en'` exists but auth never writes it                                                                        |
| Server errors           | 282 machine codes (`notoken`, `forbidden`, `claim_failed`) shown raw in the UI                                                            |
| DB content              | `missions`/`achievements` carry stable `code`; `tournaments.name` and broadcasts are authored                                             |
| Pre-existing test state | `npm -w apps/mini-app test` is red (`document is not defined` — vitest config lacks jsdom)                                                |

## 2. Library Decision

| Option                      | Pros                                                                                    | Costs                                                    |
| --------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **A. in-house core + Intl** | no new dependency, works with the current store, lazy load, typed keys from `typeof en` | we implement a small ICU subset (params, plural, select) |
| B. `svelte-i18n`            | ready-made, ICU via `intl-messageformat`                                                | +2 deps, untyped keys, Svelte 5 compatibility risk       |
| C. `typesafe-i18n`          | generated types                                                                         | extra generator/watch in the build, custom file format   |
| D. Paraglide (inlang)       | compile-time, tree-shaken per message, built-in plurals                                 | new toolchain, rewrite of the 6 existing catalogs        |

Chosen: **A**. The architecture rule is that every consumer imports only from `src/i18n`
(`index.ts`), so a future swap to D stays contained inside that folder.

Library choice must be final before Wave D: extraction is the expensive part and must not
be repeated.

## 3. File Structure

```
apps/mini-app/src/i18n/
  index.ts            public API (t, lang, setLang, LANGUAGES, dir, initI18n)
  types.ts            Lang, DeepKeys, MessageKey, TranslateFn
  format.ts           Intl wrappers (number, currency, percent, date, time, relative, compact, plural)
  loaders.ts          dynamic import per locale + cache + preload
  catalog/
    en.ts             source of truth
    fa.ts  ar.ts  tr.ts  ru.ts  zh.ts
  __tests__/
    i18n.test.ts          params, plural, fallback, dir, ZWNJ, emoji, placeholders
    parity-baseline.json  keys currently missing per locale (must only shrink)
```

Existing `src/i18n/*.ts` locale files move to `catalog/` with `git mv`.

## 4. Core API

- Typed keys: `MessageKey = DeepKeys<typeof en>`; a wrong key fails `svelte-check`.
- Interpolation: `t('tournaments.inMinutes', { n: 5 })`; missing params warn in dev, never print `{n}`.
- Plural: `Intl.PluralRules` with `_one` / `_other` suffixes when `params.n` is a number.
- Fallback: deep merge with `en` at load time instead of returning the key.
- `t` never formats numbers: callers pass `formatNumber(n)` for localizable quantities, so
  machine values (seeds, hashes, IDs) can never be localized by accident.
- Dev-only missing-key reporter (once per key).
- `format.ts`:
  - `formatNumber(n)` local digits; `formatNumber(n, { latin: true })` for machine values.
  - `formatCurrency(usd)` with `currencyDisplay: 'narrowSymbol'` (keeps `$`, local separators).
  - `formatDate`, `formatTime`, `formatRelative`, `formatCompact` replace the 61 scattered `toLocale*` calls.
  - `plural(n)` via `Intl.PluralRules`.
- Never localize (always `dir="ltr"` + `font-mono`): card ranks, suits, variant codes, hand IDs,
  blinds, server/client seeds, hashes, hex, TON addresses, tx hashes, currency codes.
- ZWNJ (`U+200C`) must survive in `fa` catalogs; enforced by a test.

## 5. RTL

1. `dir` store derived from `lang`; sets `document.documentElement.dir`, `.lang` and a `--dir` custom property.
2. Font: `@fontsource/vazirmatn` (Arabic subset); `html[dir='rtl'] body { font-family: Vazirmatn, Sora, system-ui }`.
3. RTL CSS layer in `app.css` for anything without a utility (e.g. the `margin-left: 240px` sidebar offset in `App.svelte`).
4. Mechanical codemod to logical utilities (Wave C, LTR-equivalent):

| Current                            | Replacement                                          | Count           |
| ---------------------------------- | ---------------------------------------------------- | --------------- |
| `ml-*` / `mr-*`                    | `ms-*` / `me-*`                                      | 20 / 1          |
| `pl-*` / `pr-*`                    | `ps-*` / `pe-*`                                      | 16 / 12         |
| `left-*` / `right-*`               | `start-*` / `end-*`                                  | 74 / 41         |
| `text-left` / `text-right`         | `text-start` / `text-end`                            | 46 / 35         |
| `border-l` / `border-r`            | `border-s` / `border-e`                              | 11 / 34         |
| `rounded-l-*`                      | `rounded-s-*`                                        | 126             |
| `space-x-*`                        | `gap-*`                                              | 1               |
| `translate-x-*`                    | keep, `rtl:` flip only for direction-aware animation | 56              |
| inline `left:` / `right:`          | `inset-inline-start/end` outside islands             | 22 / 5          |
| `text-[9px]` / `[10px]` / `[11px]` | tokens `text-micro` / `text-mini` / `text-tiny`      | 348 / 305 / 221 |

Text-size tokens turn the RTL typography floor into a three-line CSS rule instead of
editing 653 call sites. 5. LTR islands (`dir="ltr"`): `components/poker/PlayerSeat.svelte`, `poker/PokerTable.svelte`,
`poker/PokerTableMobile.svelte`, `routes/Table.svelte`, `HandReplayModal.svelte`,
`PokerChip.svelte`, `PlayingCard.svelte`, `ProvablyFairFooter.svelte`.
The felt is a physical representation with absolute coordinates; mirroring it would be a bug.
Only chrome text inside those files is translated. 6. `Icon.mirror`: direction-aware icons (`arrow-left`/`arrow-right` used as back/forward) flip in RTL;
suit and chip icons never flip.

## 6. Switcher

Language resolution priority:

1. `users.language` from the server when `language_explicit = true`
2. `localStorage.lang`
3. `Telegram.WebApp.initDataUnsafe.user.language_code` (first run, no round trip)
4. `navigator.language`
5. `en`

`setLang(code)` writes `localStorage`, flips `dir` immediately (no flash), then fires an
optimistic `POST /api/me/language`.

UI: the existing picker in `routes/Settings.svelte` is reused.

- Drop emoji flags from `LANGUAGES`; add `nativeLabel` (`فارسی`, `العربية`, …) and delete the
  `LANG_LABEL` workaround.
- Show the native name with the English label underneath.
- Link the same picker from `routes/Profile.svelte`.
- Keep `<html lang>` in sync.

## 7. Server-Side

1. Migration 037: `users.language_explicit boolean not null default false`
   (today `language` defaults to `'en'`, so "never chose" is indistinguishable from "chose English").
2. Auth: normalize `initData.user.language_code` (`fa*`, `ar*`, `tr*`, `ru*`, `zh*` → itself, else `en`)
   and write `users.language` only while `language_explicit = false`.
3. Endpoints: `GET /api/me` returns `language` + `language_explicit`;
   `POST /api/me/language { lang }` validates against the 6 codes and sets `language_explicit = true`
   (mirrors `POST /api/me/avatar`).
4. Telegram: only message construction is translated; polling logic is untouched (DO NOT TOUCH).
   A lightweight server catalog (`apps/server/src/i18n/**`) resolves the language from
   `message.from.language_code` for replies and from `users.language` for outbound DMs.
   Keep `parse_mode: 'HTML'`; wrap addresses/hashes in `<code dir="ltr">` and use RLM (`\u200F`)
   where mixed-direction text would break bidi.
5. API errors stay machine codes; the client maps them through `tError(code)` (the existing
   `SEED_ERRORS` map is the pattern). Side benefit: raw codes stop leaking into toasts.
6. DB content: `missions`/`achievements` translate by `code` (`content.mission.<code>.title`) with DB
   text as fallback — no migration. `broadcasts` and `tournaments.name` remain authored.
7. `Accept-Language` is used as a fallback for unauthenticated responses.

## 8. Extraction Order (one commit per wave)

| #   | Commit                                                                         | Content                                                                                             |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A   | `feat(i18n): harden core with typed keys, params, plurals and lazy locales`    | `types.ts`, `format.ts`, `loaders.ts`, rewritten `index.ts`, `catalog/` move, tests, jsdom test env |
| B   | `feat(i18n): add RTL infrastructure, Vazirmatn font and direction-aware icons` | `dir` store, font, RTL CSS layer, LTR islands, `Icon.mirror`                                        |
| C   | `refactor(ui): migrate physical direction utilities to logical properties`     | mechanical codemod + text-size tokens                                                               |
| D   | `feat(i18n): extract shell strings`                                            | nav, login, splash, toasts, modals, `App.svelte`                                                    |
| E   | `feat(i18n): extract wallet and rewards strings`                               | wallet, money, books, shop, rewards, missions, loyalty + `errors.*`                                 |
| F   | `feat(i18n): extract game and table strings`                                   | tables, tournaments, events, table components, poker HUD                                            |
| G   | `feat(i18n): extract referral, social and help strings`                        | referral family, community, notifications, achievements, help, leaderboard                          |
| H   | `feat(i18n): server locale persistence and localized bot messages`             | migration 037, auth, `POST /api/me/language`, server catalog                                        |
| I   | `feat(i18n): add string-leak ratchet test`                                     | scans `.svelte` text nodes against a whitelist and fails on growth                                  |

Waves A → C land first so that D → G only touch text, never layout classes.

## 9. Gates

Per commit:

```
npm -w apps/server run typecheck
npm -w apps/mini-app run check
npm -w apps/mini-app run build
```

Wave A additionally repairs `npm -w apps/mini-app test` (jsdom environment + setup file) and adds
the i18n suite. Waves A and B also run `npm -w apps/server test`.

P2 is done when: `svelte-check` is clean, the ratchet test reports no new leaks, the build is green,
and switching to `fa` makes the whole app RTL in Persian without breaking the felt.

## 10. Out of Scope (P3)

- `title_i18n jsonb` for authored content (broadcasts, tournaments).
- Localized admin panel.
- Locale-aware SEO/OG metadata (single English set stays).
