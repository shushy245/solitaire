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
- **Table sizes live in `src/styles/table-metrics.module.scss`** (`.metrics` on the column inside the `container-type` `main`); `board.module.scss` only consumes the vars. Spacing ratios are mirrored in `layout.utils.ts`.

## What's done
Full history: `docs/changelog.md`; commit-level record: `git log`.
- `board` — a playable, fully animated table (glide, flip, staggered deal, lift-in-flight), click the deck / double-click to send home. `src/app/board/` (layout slots → CSS classes → one transform), session reducer `src/app/session/`, `GameProvider`/`useGame` contract in `docs/plan.md`.
- `engine` — every Klondike rule as pure, seed-deterministic logic, proven against hundreds of random games; a double-fired click can never move the wrong card. `src/engine/` (barrel `index.ts`), property tests in `invariants.test.ts`.
- `scaffold` — new contributors get the house rules enforced automatically: lint, typecheck (app, configs, e2e), unit + browser tests and a commit gate all run on an empty app that boots.

## What's next
Story `drag` (`docs/plan.md`).
