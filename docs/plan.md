# Klondike Solitaire — Plan

Authoritative plan. Approved 2026-10-20.

## Context
A polished Klondike game in the browser: turn-1 / turn-3 selectable, auto-complete, smooth
animations everywhere, a celebratory win, random reproducible deals, very well tested.

**Interview decisions:** frontend-only (no server/DB) · auto-solve = *auto-complete* (stock and
waste empty, every tableau card face-up → sweep to foundations) · pure random deals (some are
unwinnable, like real cards) · v1 extras: unlimited undo, score + timer + moves, persisted stats +
resume-after-reload.

**Defaults (chosen, open to change):**
- Switching turn-1/turn-3 applies to the next deal; switching mid-game asks (inline, never a browser
  dialog) whether to start a new game. New game mid-game asks the same way.
- Unlimited stock passes. Windows standard scoring: waste→tableau +5, any→foundation +10, tableau
  card turned face-up +5, foundation→tableau −15, recycling the waste −100 (turn-1, every recycle) /
  −20 (turn-3, from the 3rd recycle on — the first three passes are free), score floored at 0.
- Tableau cards turn face-up automatically when uncovered.
- Input: drag-and-drop (Pointer Events — touch works for free) + click stock to draw/recycle +
  double-click a top card to send it to a foundation. Ctrl/Cmd+Z undoes.
- Win celebration: the classic bouncing-card cascade on a `<canvas>` overlay + "New game" CTA.
  `prefers-reduced-motion` → no cascade, no transitions.

## Architecture
- **Stack:** Vite + React 18 + TS strict, `.module.scss`, layout primitives, Vitest + RTL, Cypress,
  `eslint-config-shalev`. No animation or state library. Zod for the localStorage boundary.
- **Functional core — `src/engine/`** (zero React/DOM imports): `model.ts` (Suit/Rank/DrawMode
  enums, `CardModel`, `GameStateModel`, `Move` discriminated union), `selectors.ts`, `prng.ts`
  (mulberry32), `shuffle.ts` (Fisher–Yates), `deal.ts`, `rules.ts` (`canApplyMove`,
  `listLegalMoves`), `apply.ts` (`applyMove`), `scoring.ts` (`scoreDeltaMap`),
  `auto-complete.ts` (`isAutoCompletable`, `nextAutoMove`).
- **Session (`src/app/session/`)**: pure `reduceSession(session, action)` over
  `{ game, history, stats, elapsedSeconds, phase }` — moves, undo, new game, tick, auto-complete
  step. Stats are updated *inside* the transition that produces the win (never in an effect) so a
  win is recorded exactly once. `GameProvider` + `useGame()` is the thin shell (useReducer, timer,
  auto-complete cadence, persistence).
- **Animation model:** all 52 cards render in one absolutely-positioned layer keyed by card id.
  Pure `layoutCards(state)` returns abstract slots (`pile`, `col`, `downCount`, `upCount`, `fan`,
  `z`, `faceUp`); CSS turns them into pixels with `calc()` over responsive custom properties, so the
  layout is CSS-only responsive and a `transform` transition animates every state change — moves,
  deal, undo, auto-complete — with a 3D flip for face changes. Drag writes a pointer offset; drop
  either dispatches a move or clears the offset (the snap-back animates).
- **Seed:** `crypto.getRandomValues` at the composition root (`main.tsx`) → engine stays pure and
  deterministic per seed.

## Contracts fixed where slices meet
```ts
// useGame() — finalised in story `board` (src/app/game-provider.utils.ts), consumed unchanged by drag/hud/persistence/celebration
type GameContextValue = {
    session: SessionModel;                     // game, history, elapsedSeconds, phase (Playing | AutoCompleting)
    dispatchMove: (move: Move) => void;        // illegal/stale moves are ignored, never thrown
    sendToFoundation: (cardId: string) => void; // intent, resolved against the current game
    undo: () => void;
    newGame: (opts: { drawMode: DrawMode }) => void;
    startAutoComplete: () => void;
};
// <GameProvider createInitialSession={() => SessionModel} seedSource={() => number}> — persistence plugs
// a restored session into createInitialSession; main.tsx is the composition root.
```

---

## Epic: Klondike v1

### Story `scaffold` — repo, tooling, empty app boots ✅
- Owns: repo root config, `src/main.tsx`, `src/app.tsx`, `src/ui/`, `src/testkit/`, `cypress/`
- Depends on: —
- Parallel: serial first (everything builds on it)
- Task: git, pnpm, Vite + React + TS, `eslint-config-shalev` stub, Vitest + RTL + jsdom, Cypress,
  layout primitives, project CLAUDE.md, husky pre-commit.
- Cases:
  - given the dev server, when the app loads, then the title "Solitaire" is visible (Cypress boot)
  - given the vitest suite, when it runs, then the setup file loads jest-dom matchers

### Story `engine` — the rules of Klondike as pure functions ✅
- Owns: `src/engine/`
- Depends on: scaffold
- Parallel: serial (every later story consumes it)
- Cases:
  - prng: the same seed yields the same sequence; different seeds diverge
  - shuffle: deterministic per seed; a permutation of the input (no loss/duplication); doesn't mutate its input; first-position distribution is roughly uniform over many seeds
  - deal: 7 columns of 1..7 cards, only the top card of each face-up; 24 cards face-down in stock; empty waste and foundations; score 0, moves 0
  - draw (turn-1): moves one card stock→waste face-up
  - draw (turn-3): moves three cards, the last drawn on top; with fewer than 3 left draws what remains; fan shows the drawn count
  - turn-3 fan: playing the top waste card shrinks the visible fan by one, never below one while waste has cards
  - draw from an empty stock is illegal
  - recycle: only when stock is empty and waste is not; waste returns face-down in original order; −100 every recycle in turn-1; turn-3 is free for the first two recycles, −20 from the third
  - tableau: a King (or King-led run) may move to an empty column; nothing else may
  - tableau: a card goes onto the opposite colour, one rank higher; same colour or wrong rank is illegal
  - tableau→tableau: moving a face-up run carries every card above it; moving from a face-down index is illegal
  - foundation: an Ace starts an empty foundation; then same suit ascending only; only the top card of a pile may go there
  - foundation→tableau is legal per tableau rules and scores −15
  - uncovering a face-down tableau card turns it face-up and scores +5
  - scoring: waste→tableau +5, waste→foundation +10, tableau→foundation +10; score never drops below 0
  - every legal move increments the move count; an illegal move returns the state unchanged
  - win: detected exactly when all four foundations hold 13 cards
  - auto-complete: eligible only when stock and waste are empty and every tableau card is face-up
  - auto-complete: from any eligible state, repeatedly applying `nextAutoMove` wins
  - property: across random seeds × random legal-move sequences — always 52 unique cards; no face-down card above a face-up one; foundations ascend in one suit; tableau face-up runs alternate colour and descend
  - property: every move from `listLegalMoves` is accepted by `applyMove`; no illegal move ever changes state
  - property: `applyMove` never mutates its input state
  - pre-mortem: a move naming a card no longer where it says (double-fired click) is rejected
  - review: a double-fired draw draws once; only the column a move uncovered is revealed and scored

### Story `board` — the table renders, cards animate, click/double-click play
- Owns: `src/app/board/`, `src/app/session/`, `src/app/game-provider.tsx`
- Depends on: engine
- Parallel: serial (fixes the `useGame` contract)
- Cases:
  - layout: every card gets exactly one slot; tableau slots count face-down and face-up cards below separately; turn-3 waste fans the visible cards only; z order matches pile order
  - session: a move pushes the previous game onto history; undo restores it exactly (score/moves included); undo with empty history is a no-op
  - session: new game resets history and elapsed time and uses the given draw mode
  - board: renders 52 cards; clicking the stock draws; clicking the empty stock recycles
  - board: double-clicking a playable top card sends it to its foundation; double-clicking a non-playable card does nothing
  - board: a face-down card is rendered without its rank/suit text visible to assistive tech
  - deal animation: cards start stacked on the stock and fly to their slots with a stagger
  - concurrency: a double-click that also fires two single clicks on the stock draws twice at most as intended (click handlers are idempotent per event)
  - pre-mortem: double-click sends a "send this card up" intent; the reducer resolves the foundation against the *current* game (no stale closure)
  - pre-mortem: cards that just moved are lifted above every other card until their transition ends (no flying under the tableau)
  - pre-mortem: starting a new game mid-deal cancels the old deal's timers (no flicker, no stuck stagger)
  - pre-mortem: the deal starts with every card stacked on the stock, then moves to the dealt layout
  - pre-mortem: the seed comes from an injected source (composition root), so tests deal deterministic games

### Story `drag` — drag single cards and runs, snap back on illegal drop
- Owns: `src/app/drag/`
- Depends on: board
- Parallel: safe with hud, persistence, celebration
- Cases:
  - drop resolution: the pile with the greatest overlap with the dragged card wins; no overlap → no target
  - dragging a face-up tableau card carries the run above it
  - dropping on a legal pile dispatches the move; on an illegal pile or empty space the cards snap back
  - face-down cards and the stock cannot be dragged; only the top waste card can
  - a tiny pointer movement (< threshold) is a click, not a drag (double-click still works)
  - concurrency: pointercancel / pointerup outside the window ends the drag and snaps back
  - Cypress: drag a card to a legal column in a real browser and see it land

### Story `hud` — new game, mode, undo, score/timer/moves, auto-complete
- Owns: `src/app/hud/`
- Depends on: board
- Parallel: with-care with persistence (both read `useGame`; neither edits the provider)
- Cases:
  - shows score, moves and elapsed time; the timer starts at the first move and stops at the win
  - undo button and Ctrl/Cmd+Z undo; disabled with no history
  - new game with no moves deals immediately; with moves, asks first (inline confirm), cancel keeps the game
  - switching turn mode with no moves redeals in the new mode; with moves, asks first
  - auto-complete button appears only when eligible; clicking it sweeps the cards one by one and the controls are disabled while it runs
  - concurrency: double-clicking auto-complete starts one sweep; starting a new game mid-sweep stops it

### Story `persistence` — resume after reload, stats
- Owns: `src/app/persistence/`
- Depends on: board
- Parallel: with-care with hud
- Cases:
  - a saved game (incl. history, elapsed time, draw mode) restores on load
  - corrupt, partial or old-version saved data is discarded (logged) and a fresh game is dealt
  - stats: played increments on the first move of a deal; won/best time/best score update on a win, exactly once
  - stats panel shows played, won, win %, best time, best score
  - Cypress: make a move, reload, the board is the same; win, reload, stats show the win

### Story `celebration` — win cascade
- Owns: `src/app/celebration/`
- Depends on: board
- Parallel: safe with drag, hud, persistence
- Cases:
  - physics step: a card falls under gravity, bounces off the floor with damping, and is done once it leaves the screen sideways
  - the win overlay appears when the game is won, with time, score and a "New game" button that deals
  - reduced motion: no cascade, the overlay appears directly
  - concurrency: starting a new game mid-cascade stops the animation loop (no leaked rAF)
  - Cypress: auto-complete a near-won game to the win overlay

---

## Review triage

### `scaffold` (code-review high, 10 findings)
- Fixed (7): cypress/ + config files now typechecked by the gate; Node types split into
  `tsconfig.node.json`; vitest merges `vite.config.ts`; null DOM seam wrapped
  (`src/utils/get-element-by-id.ts`) instead of disabling `no-restricted-syntax` on `main.tsx`;
  primitives lose the `style` prop, move to `.module.scss`, built by one factory; `packageManager`
  + `engines` pinned.
- Dismissed (2): "unused" zod/chance/fast-check and the empty builders barrel — consumed by
  `engine`/`persistence` immediately; precondition: if a dep is still unused at epic close, remove it.
- RF-backlog (1): non-TS files (JSON/SCSS/HTML) are not formatted against `.prettierrc`; add a
  `prettier --check` for them.

### `scaffold` visual review (pass A + B)
- VISUAL PASS FAILED TO RUN — no claim here is backed by a capture: screenshots timed out at 390/768
  (background tab never painted); measurement script ran clean at 390/768/1280 (no overflow).
- Fixed: no `main` landmark (Lighthouse a11y 94) → app root is `<main>`; favicon 404 → `public/favicon.svg`;
  added meta description.
- Carry-forward: from `board` on, the visual reviewer is told to bring its tab to the front before capturing.

### `engine` (code-review high, 10 findings)
- Fixed — correctness (1): a double-fired Draw drew twice → Draw names the stock top (`makeDrawMove`).
- Fixed — robustness (3): reveal/score scoped to the move's source column; purity guard widened
  (`~/`, `../`, navigator/globalThis/timers…); `shuffle` constrained to non-undefined items.
- Fixed — style (4): named predicates (`canRecycle`, `hasStock`, `isAllFaceUp`, `isLowerRank`, `isSamePile`),
  `CARDS_PER_SUIT`, test-only `randomSequence` moved to testkit, `isEmptyPile` reused.
- Dismissed — `listLegalMoves` includes legal no-op moves: precondition recorded on the function —
  a hint / "no moves left" feature must filter them first.
- Dismissed — `at(items, index)` positional: it mirrors `Array.prototype.at`, a universal ordered pair.

## RF-backlog
- Prettier coverage for JSON/SCSS/HTML (from `scaffold` review).
