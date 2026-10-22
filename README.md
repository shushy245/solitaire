# Solitaire

Klondike solitaire in the browser — turn-1 or turn-3, auto-complete, undo, score/timer, stats.

## Run

```sh
pnpm install
pnpm dev          # http://localhost:5173
```

## Check

```sh
pnpm test         # unit + component tests (Vitest)
pnpm lint         # ESLint, then Prettier over JSON/SCSS/HTML
pnpm typecheck
pnpm cy:run       # e2e (Cypress) — needs `pnpm dev` running
```
