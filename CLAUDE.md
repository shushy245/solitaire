# Solitaire — Project Instructions

## HARD RULES — read before every response that involves code
**Never begin implementing a story unless explicitly asked in this session.**
**Read `docs/plan.md` in full before touching any code — it is the authoritative plan.**
**`src/engine/` stays pure — no React, DOM, `window`, `crypto` or time imports.** Randomness enters as a seed.

## Recipes
(added as patterns recur)

## Project overview
Single-package Vite + React 18 + TS app. Klondike solitaire, frontend-only, no backend.
- `src/engine/` — the rules of Klondike as pure functions (functional core)
- `src/app/` — React shell: session reducer, provider, board, drag, HUD, persistence, celebration
- `src/ui/` — layout primitives (`Box`, `Row`, `Column`, `Full*`)
- `cypress/` — e2e for the real-browser-only flows (drag, reload, win)

## Architecture
- Functional core / imperative shell: engine + `reduceSession` are pure; `GameProvider` is the shell.
- Cards render in one absolutely-positioned layer keyed by card id; `layoutCards` emits abstract
  slots and CSS `calc()` maps them to pixels, so one `transform` transition animates every change.
- localStorage is an external boundary — parsed with Zod, discarded explicitly when invalid.

## Key conventions (project-specific)
- Commands: `pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm cy:run` (needs `pnpm dev` running).

## Landmines — read before touching the named areas
- **Fake timers + user-event hang:** RTL's async wrapper awaits a real `setTimeout` that Vitest's fake clock never runs. Board tests fire events with `fireEvent` (see `board.driver.tsx`).
- **Commit gate runs before the command:** a fix and its `git commit` in one Bash call commits the *old* state's test result — run the fix, then commit in a separate call.
- **Synthetic pointer events must carry `buttons: 1` while pressed** — a move with `buttons === 0` ends a drag (lost-release guard).
- **Never draw a seed inside a React initialiser** — StrictMode runs it twice; `main.tsx` decides the first seed.
- **Node 25 shadows jsdom's `localStorage`** with its own empty global — tests use `src/testkit/fakes/memory-storage.ts`, never `window.localStorage`.
- **`?seed=N` (add `&draw=3` for turn 3) is consumed on load** (stripped from the address), so a reload resumes; Cypress specs that need a deal visit `?seed=` each time.
- **jsdom cannot draw on a canvas** — `src/testkit/setup.ts` makes `getContext` return nothing; drawing is checked by `cypress/e2e/celebration.cy.ts` reading the canvas.
- **Sound needs a gesture:** nothing plays until a press/release/key (`unlocking-player.ts`); Cypress fakes `AudioContext` in-page (`cypress/support/fake-audio-context.ts`).
- **jsdom has no `AnimationEvent`** — `src/testkit/setup.ts` stands one in, or React would listen for `webkitAnimationEnd` and `onAnimationEnd` never fires in tests.
- **Vitest blanks stylesheet imports** except `global.scss` (`css.include` in `vitest.config.ts`) — the contrast test reads it with `?raw`.
- **Table sizes live in `src/styles/table-metrics.module.scss`** (`.metrics` on the column inside the `container-type` `main`); `board.module.scss` only consumes the vars. Spacing ratios are mirrored in `layout.utils.ts`.

## What's done
Full history: `docs/changelog.md`; commit-level record: `git log`.
- `two-tabs` — only the visible tab saves (`makeVisibleTabSave` + `isPageVisible`, wired in `main.tsx`); a hidden
  tab's clock ticks write nothing. Last tab looked at wins.
- `stuck-polish` — the game-over panel's Undo leaps to the last unstuck position (`UndoToUnstuck`,
  `canUndoToUnstuck`; stuck answers remembered per game state); New game on a stuck game skips "leave this game?"
  (`asksBeforeLeaving`, mode switch still asks); the panel closes and stays closed while stuck; the clock stops while
  stuck (`reportGameOver` from the hint provider → `Tick.isGameOver`). Open: BF-7 (take-downs in a stuck game).

## What's next
Autonomous run (user, 2026-10-22: "do everything left, order does not matter"): `polish-review` ✅ → `stuck-polish` ✅
→ BF-1 ✅ (`two-tabs`) → BF-2 (needs the user: tell the player, or trim history) → BF-7 → RF-backlog. The manual Chrome/Safari listen needs the user.
