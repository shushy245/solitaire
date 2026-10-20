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

## What's done
Full history: `git log`.
- `scaffold` — tooling, empty app boots.

## What's next
Story `engine` (`docs/plan.md`).
