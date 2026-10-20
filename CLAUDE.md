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
- **`?seed=N` is consumed on load** (stripped from the address), so a reload resumes; Cypress specs that need a deal visit `?seed=` each time.
- **Table sizes live in `src/styles/table-metrics.module.scss`** (`.metrics` on the column inside the `container-type` `main`); `board.module.scss` only consumes the vars. Spacing ratios are mirrored in `layout.utils.ts`.

## What's done
Full history: `docs/changelog.md`; commit-level record: `git log`.
- `persistence` — the game in progress (undo history, time, mode) survives a reload; a Stats panel shows played/won/win rate/bests. `src/app/persistence/` (Zod save format `persistence.utils.ts`, shell `session-store.ts` over the never-throwing `src/utils/browser-key-value-store.ts`); stats rules `src/app/stats/stats.utils.ts`, counted inside `reduceSession` via `progress`; `main.tsx` loads, the provider saves every change; Cypress seeds saves from `cypress/fixtures/`.
- `hud` — new game (asks first mid-game), turn-1/turn-3, Undo + Ctrl/Cmd+Z, live score/moves/time, auto-complete. `src/app/hud/` (pure rules in `hud.utils.ts`; session-level rules `isGameUnderWay`/`canUndo` in `session.utils.ts`); the provider reads the clock before every game action, so time is exact to the move.
- `drag` — drag a card or run onto any legal pile; illegal drops glide back. `src/app/drag/` (pure rules in `drag.utils.ts`, pointer hook `use-card-drag.ts`); `?seed=N` replays a deal.

## What's next
Story `celebration` (`docs/plan.md`).
