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

### Story `board` — the table renders, cards animate, click/double-click play ✅
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

### Story `drag` — drag single cards and runs, snap back on illegal drop ✅
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
  - pre-mortem: the dropped card animates from where it was released (not from its old slot) to its target, and a rejected drop animates back
  - pre-mortem: unmount or a new deal mid-drag removes the window listeners and ends the drag
  - pre-mortem: dropping back on the source pile is a no-op snap-back, never a move
  - pre-mortem: the pointer-up handler reads the latest game, and the move names its card, so a stale drop is rejected
  - pre-mortem: cards can't be picked up while the deal is still running

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
  - pre-mortem: the clock counts real elapsed time, not interval ticks — a throttled background tab must not undercount
  - pre-mortem: Ctrl+Z and Cmd+Z both undo; the key listener is removed on unmount and never fires twice per press
  - pre-mortem: an open confirmation closes when the game it was about is replaced (no confirming against a stale game)
  - pre-mortem: Escape or "Keep playing" closes the confirmation without changing the game
  - pre-mortem: the turn-1/turn-3 control always shows the current game's mode — cancelling a switch leaves it unchanged

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

### Story `felt-and-sound` — a brighter table and sounds for card actions (requested 2026-10-20)
- Owns: `src/styles/global.scss` (palette tokens), `src/app/sound/`
- Depends on: celebration (runs last; touches the tokens every earlier story uses)
- Parallel: serial — palette tokens are a shared seam
- Task: brighten the felt so it is more lively yet easy on the eye — keep cards, text and slot
  outlines at their contrast targets (text ≥ 4.5:1, outlines/controls ≥ 3:1), re-checked by
  measurement at 390/768/1280. Add short sounds for card actions, synthesized with the Web Audio
  API (no audio files to ship or license): deal, draw, flip, place, invalid drop / snap-back,
  recycle, send to foundation, win. A visible mute toggle, remembered across reloads; sound is
  never played before the player's first interaction (browser autoplay rules) and never throws
  if audio is unavailable.
- Cases:
  - the felt tokens meet the contrast targets against card faces, text and slot outlines (measured)
  - each card action maps to exactly one sound (data table), and an unchanged/illegal action plays the snap-back sound only for a drop
  - a draw of three plays one draw sound, not three; a deal plays a quick cascade, not 52 overlapping sounds
  - muted: no sound is scheduled; the mute choice survives a reload
  - no audio context is created before the first pointer/key interaction; a blocked or missing AudioContext degrades to silence without errors
  - reduced motion does not mute sound (they are independent preferences)
  - Cypress: actions in a real browser schedule the expected sounds (audio port faked in-page), and mute silences them
  - manual: listen in Chrome and Safari — every action audible, nothing clipped or too loud
  - the background has no visible edge or banding (two visual passes saw a faint shape low on the page — likely the radial gradient's ellipse edge)

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

### `board` (code-review high, 10 findings; visual pass A+B)
- Fixed — correctness (3): mid-deal cards caught stock clicks/double-clicks (could send an Ace up
  unasked) → cards are inert and click-through until the deal settles; dealt cards slid under the
  stock → lifted while dealing; deal keyed on seed (a replayed seed never re-dealt) → `dealNumber`.
- Fixed — robustness (5): table height used max-down + max-up from different columns → `tallestColumn`;
  auto-complete could stall if a step were rejected → falls back to Playing; `100vw` card sizing
  → container units on `main`; a card flipped in place stayed lifted → lift ignores faces; 52 cards
  re-rendered every clock tick → stable actions + memoised `Card`.
- Fixed — style (1): column map duplicated → `STOCK_COLUMN`/`WASTE_COLUMN`/`FOUNDATION_FIRST_COLUMN` in layout.utils.
- Dismissed (1): "announce stacked cards as face-down mid-deal" — the accessible name follows the
  real card (the deal is cosmetic, ~1.5s); face-down cards never expose rank or suit.
- Visual pass A+B: measurements clean at 390/768/1280, Lighthouse a11y 100. Fixed: title not
  aligned with the centred board (→ shared `table-metrics.module.scss`); stacked-stock shadow halo
  (→ `isBuried`). Not reproduced: a faint background artifact (reviewer saw it mid-HMR).
- Observation kept: lots of empty felt below the tableau on phones — expected; the HUD story adds controls.
- Pass A re-run on the fixed code: clean at 390/768/1280. Its note on small phone indices → fixed
  (13px/11px floors, rank beside suit, measured to fit the 16px covered strip at 390).

### `drag` (code-review high, 10 findings; visual pass A+B)
- Found by the Cypress drag spec before review (fixed): the drop box was measured mid-transition at
  release → pick-up box + pointer travel; StrictMode double-ran the session initialiser and lost the
  `?seed=` deal → the composition root decides the first seed once.
- Fixed — correctness (4): a drop mostly over the source pile jumped to a grazed neighbour → best
  overlap first, source means no-op; released cards could stay lifted / lose their lift to a stray
  click → one lift set (`liftUntilLanded`) with replace-on-layout-change; a lost pointerup left cards
  following the mouse → a move with `buttons === 0` ends the drag.
- Fixed — robustness (2): DOM pile attributes and `?seed=` parsed with strict Zod (`Number(null) === 0`,
  hex/exponent/whitespace seeds).
- Fixed — efficiency/structure (4): dragged elements resolved once; `measurePiles` builds one Map;
  second lift mechanism removed; pointer checks named (`isSamePointer`, `isReleaseLost`, `isPrimaryButton`).
- Visual pass A re-run after fixes: measurements clean at 390/768/1280; its captures were mid-deal, so
  settled 390/768 rest on the earlier A+B pass (delta since: one colour token, measured 4.17:1).
- Visual pass A+B: clean at 390/768/1280, Lighthouse a11y 100. Fixed: empty stock outline ~2:1 →
  `--control-line`, measured 4.17:1. Deferred (out of v1 scope, logged below): keyboard play.

### `hud` — review findings PENDING triage (code-review high arrived after the user stopped the run; visual pass not run)
1. Ctrl/Cmd+Z mid-drag undoes under the dragged cards — ignore the shortcut while dragging, or end the drag on undo.
2. Plan contract stale: `elapsedSeconds` → `elapsedMs`, GameProvider now also takes `now` — update Architecture/Contracts.
3. Leave-question stays open once leaving no longer needs confirming (undo to 0 moves, or a win) — also require `needsConfirmationToLeave`.
4. Plan conflict: "controls disabled during auto-complete" vs "new game mid-sweep stops it" — decide; add a HUD test for double-clicking auto-complete.
5. Undo shortcut: non-Latin layouts (`event.code === 'KeyZ'` fallback) and AltGr (`!altKey`).
6. Clock: reset `lastTick` when play starts/ends (±1s on the first and final tick).
7. Leave-question: return focus on close; Escape only works inside it; consider dialog semantics.
8. Driver `undoShortcutListenerRemoved` passes vacuously at 0/0; window spies never restored.
9. Props types / `isModeChange` boolean prop in hud.tsx → hud.utils.ts, derive the variant.
10. `fakeNow`/`fixedSeed` duplicated across drivers → one testkit helper.

## Deferred (not in v1 scope)
- Keyboard play — cards are pointer-only today (the stock button is keyboard-operable). Would need a
  focus model over piles and a pick/place key flow. Raised by the `drag` accessibility pass.

## RF-backlog
- Prettier coverage for JSON/SCSS/HTML (from `scaffold` review).
