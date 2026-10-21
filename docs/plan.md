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
  `{ game, history, elapsedMs, phase, dealNumber, progress, stats }` (`progress` = this deal's place in the
  record: unstarted → started → won, forward only) — moves, undo, new
  game, tick, auto-complete step. The clock is real milliseconds: the provider reads a monotonic `now()`
  on a 1s interval and right before every game-changing action, so play time starts and stops at the
  exact move. Stats are updated *inside* the transition that produces the win (never in an effect) so a
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
    session: SessionModel;                     // game, history, elapsedMs, phase (Playing | AutoCompleting), dealNumber, progress, stats
    dispatchMove: (move: Move) => void;        // illegal/stale moves are ignored, never thrown
    sendToFoundation: (cardId: string) => void; // intent, resolved against the current game
    undo: () => void;
    newGame: (opts: { drawMode: DrawMode }) => void;
    startAutoComplete: () => void;
};
// <GameProvider createInitialSession={() => SessionModel} seedSource={() => number} now={() => number}
//               saveSession={(session) => void}>
// — main.tsx (composition root) loads the first session via the session store (?seed= deal, else the saved
// game, else a fresh deal, always with the saved record) and passes store.save as saveSession, which the
// provider calls on every session change; `now` is monotonic ms (performance.now in the app, the fake clock
// in tests).
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

### Story `hud` — new game, mode, undo, score/timer/moves, auto-complete ✅
- Owns: `src/app/hud/`
- Depends on: board
- Parallel: with-care with persistence (both read `useGame`; neither edits the provider)
- Cases:
  - shows score, moves and elapsed time; the timer starts at the first move and stops at the win
  - undo button and Ctrl/Cmd+Z undo; disabled with no history
  - new game with no moves deals immediately; with moves, asks first (inline confirm), cancel keeps the game
  - switching turn mode with no moves redeals in the new mode; with moves, asks first
  - auto-complete button appears only when eligible; clicking it sweeps the cards one by one and undo is locked while it runs (New game and the mode switch stay available — see the next case)
  - concurrency: double-clicking auto-complete starts one sweep; starting a new game mid-sweep stops it
  - pre-mortem: the clock counts real elapsed time, not interval ticks — a throttled background tab must not undercount
  - pre-mortem: Ctrl+Z and Cmd+Z both undo; the key listener is removed on unmount and never fires twice per press
  - pre-mortem: an open confirmation closes when the game it was about is replaced (no confirming against a stale game)
  - pre-mortem: Escape or "Keep playing" closes the confirmation without changing the game
  - pre-mortem: the turn-1/turn-3 control always shows the current game's mode — cancelling a switch leaves it unchanged

### Story `persistence` — resume after reload, stats ✅
- Owns: `src/app/persistence/`
- Depends on: board
- Parallel: with-care with hud
- Cases:
  - a saved game (incl. history, elapsed time, draw mode) restores on load
  - corrupt, partial or old-version saved data is discarded (logged) and a fresh game is dealt
  - stats: played increments on the first move of a deal; won/best time/best score update on a win, exactly once
  - stats panel shows played, won, win %, best time, best score
  - Cypress: make a move, reload, the board is the same; win, reload, stats show the win
  - pre-mortem: undoing back to the deal and playing again counts it once; undoing a win and winning again counts it once
  - pre-mortem: the best time runs to the winning card, not the last clock tick
  - pre-mortem: storage that refuses calls (blocked, quota) never stops the game
  - pre-mortem: a valid-JSON save that no game could produce (51 cards, mixed foundations) is discarded
  - found by Cypress: a game resumed mid-play is shown where it was left, not re-dealt

### Story `celebration` — win cascade ✅
- Owns: `src/app/celebration/`
- Depends on: board
- Parallel: safe with drag, hud, persistence
- Cases:
  - physics step: a card falls under gravity, bounces off the floor with damping, and is done once it leaves the screen sideways
  - the win overlay appears when the game is won, with time, score and a "New game" button that deals
  - reduced motion: no cascade, the overlay appears directly
  - concurrency: starting a new game mid-cascade stops the animation loop (no leaked rAF)
  - Cypress: auto-complete a near-won game to the win overlay
  - pre-mortem: unmount, undo of the win, or a new game stops the frame loop (no frame requested afterwards)
  - pre-mortem: a long gap between frames (background tab) is clamped, so no card tunnels through the floor
  - pre-mortem: a game already won when the page loads shows the overlay without replaying the cascade
  - pre-mortem: the overlay's New game takes focus when it appears and deals in the won game's mode
  - review: a resize mid-cascade re-fits the canvas; the cascade really paints, and never above the foundation row (Cypress)

### Story `felt-and-sound` — a brighter table and sounds for card actions (requested 2026-10-20) ✅ (manual listen pending)
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
  - pre-mortem: StrictMode's double effect plays a change's sound once
  - pre-mortem: the winning move plays the win sound only, not a foundation sound on top
  - pre-mortem: a restored game on load plays nothing; an undo plays the place sound
  - pre-mortem: a rejected AudioContext resume() never surfaces as an unhandled rejection
  - review: a touch press does not unlock audio, its release does — every gesture retries until audio runs
  - review: empty-pile outlines (drop targets) hold 3:1; hovered button text holds 4.5:1 (measured by test)
  - review: no pick-up while auto-complete runs; a mute applies even to a play handle taken earlier

### Story `epic-review` — fixes from the epic-level review (2026-10-21) ✅
- Owns: `src/app/persistence/`, `src/app/sound/unlocking-player.ts`, `src/app/board/board.tsx`, `src/utils/seed-source.utils.ts`
- Depends on: felt-and-sound (runs after the epic's stories)
- Parallel: serial
- Cases:
  - a saved game whose tableau no game could produce (face-down cards above face-up ones, more hidden cards than the
    column was dealt, a face-up stack that is not a descending alternating run) is discarded, not rendered
  - property: every state reached by random legal play passes the save check (it never rejects a real game)
  - audio suspended later (a locked phone) starts again at the next interaction, without stacking listeners
  - `?seed=N&draw=3` replays a turn-3 deal; a missing or unknown `draw` means turn 1
  - the stock ignores clicks while the deal is still flying out
  - saving logs under the save's own name, not the load's
- Deferred (BF, recorded): BF-1 two open tabs overwrite each other's saved game on every tick (last writer wins) —
  fix: save only from the visible tab and flush on hide. BF-2 a refused game write (quota) leaves the last good
  save, so a reload resumes an older position without a word — measured ~0.49MB per 500 undo steps against a ~5MB
  quota, so it needs thousands of moves; fix: tell the player, or trim history.
- Kept: a card dragged off a foundation after a win un-wins it — the win panel is deliberately non-modal
  (`celebration` triage).

---

## Epic: Play polish (requested 2026-10-21)
Interview decisions: one click plays a card (foundation first, else the first legal column; no move → a
shake), double-click unchanged · Hint highlights one move (source card + target pile, ~2s), pressing again
cycles to the next, suggests the stock when nothing else plays, no score penalty · drop targets: tableau
columns reach the table's bottom with side padding, and among overlapped piles the best *legal* one wins ·
cards restyled in CSS (no art assets): rounder, warm, soft shadow, large indices, gentler colours.
Order: `draw-animation` → `easy-drops` → `click-to-play` → `hint` → `card-design` (serial — one session;
2–4 share `board.tsx`, 5 touches every card's look).

### Story `draw-animation` — a drawn card flies from the stock to the waste ✅
- Owns: `src/app/board/`
- Depends on: —
- Parallel: serial (first)
- Cases:
  - repro (real browser): drawing a card shows it travelling from the stock to the waste, not appearing in place
  - a drawn card is lifted above the waste while it flies, then settles at its waste slot
  - turn-3: the three drawn cards fly out together and fan
  - undoing a draw flies the card back to the stock

### Story `easy-drops` — sloppy drops still land
- Owns: `src/app/drag/`
- Depends on: draw-animation
- Parallel: serial
- Cases:
  - a tableau column's drop area reaches the bottom of the window (the table itself ends below its longest column), so a drop well below its last card lands there
  - each pile's drop area is padded sideways, so a drop slightly off a pile's edge still lands
  - among overlapped piles the legal one wins even when an illegal pile overlaps more
  - among several legal piles the one with the most overlap wins
  - no legal overlapped pile → snap back (unchanged); dropping on the source pile is still a no-op
  - padded areas never make a pile the dragged card does not touch win over one it does

### Story `click-to-play` — one click plays the obvious move
- Owns: `src/app/board/`, `src/engine/` (new `findClickMove` selector)
- Depends on: easy-drops
- Parallel: serial
- Cases:
  - engine: a top card that fits a foundation goes there (2♥ onto A♥); an Ace goes to an empty foundation
  - engine: otherwise a face-up card (with its run) goes to the first legal tableau column, preferring a non-empty column over an empty one
  - engine: a King already heading an otherwise empty column is not moved to another empty column (no pointless move)
  - engine: no legal move → none; face-down cards and the stock never resolve
  - board: a single click on a playable card plays it; on an unplayable card it shakes and nothing changes
  - board: a click that ends a drag is not a click (the drag threshold still separates them)
  - pre-mortem: a double-click fires two clicks — the second click's card has already moved, so it never plays twice
  - pre-mortem: clicks are ignored mid-deal and during auto-complete

### Story `hint` — show me a move
- Owns: `src/app/hud/` (button), `src/engine/` (`listHints`), `src/app/board/` (highlight)
- Depends on: click-to-play
- Parallel: serial
- Cases:
  - engine: hints rank foundation moves, then moves that reveal a face-down card, then waste→tableau, then other
    tableau moves; never a move that just shuffles a run between equal positions (King from an empty column to an empty one)
  - engine: nothing else playable → the stock (draw or recycle); empty stock and waste with no move → no hint
  - Hint button and the H key highlight the source card(s) and target pile; the highlight clears after ~2s
  - pressing Hint again shows the next hint, wrapping round
  - any game change clears the highlight and restarts the cycle at the first hint
  - "No moves" is announced when there is nothing to suggest; no score penalty either way
  - pre-mortem: the clear timer is cancelled on unmount and on a new hint (no stale clear wiping a newer highlight)
  - pre-mortem: H while typing in no field (there are none) — H with a modifier key does nothing

### Story `card-design` — softer, more pleasing cards
- Owns: `src/app/board/board.module.scss`, `src/styles/global.scss`
- Depends on: hint
- Parallel: serial (last)
- Cases:
  - card faces: warm cream, rounder corners, soft layered shadow, large corner rank+suit, centre suit art
  - red and black inks stay ≥ 4.5:1 on the card face (contrast test); the back stays distinct from the felt
  - visual pass at 390/768/1280: indices readable at the smallest size (measured)

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

### `hud` (code-review high, 10 findings; visual pass A+B)
- Fixed — correctness (4): Ctrl/Cmd+Z mid-drag moved cards under the pointer → a drag ends on any game
  change; the leave question outlived the need to ask (undo to 0 moves, a win) → it lapses with
  `needsConfirmationToLeave`; the clock gained/lost up to 1s at the first and winning move → the
  provider reads the clock before every game action; Ctrl+Z on non-Latin layouts / AltGr → `KeyZ`
  fallback for non-Latin keys, Alt excluded.
- Fixed — accessibility (1): the leave question returns focus to the button that asked; Escape works
  from anywhere on the page. Kept `role="group"` (inline, non-modal — not a dialog).
- Fixed — tests/structure (3): listener-removal asserts passed vacuously at 0/0 → exact handlers, spies
  restored after each test; `isModeChange` boolean prop → pure `leaveQuestion`, props types in
  `hud.utils.ts`; `fixedSeed`/`fakeNow` → `src/testkit/provider-fakes.ts`.
- Decided (1): during auto-complete only undo locks; New game / mode switch stay live and stop the sweep.
  A double-clicked start is absorbed by the reducer (pinned by a session test).
- Docs (1): Architecture/Contracts synced (`elapsedMs`, `dealNumber`, `now`).
- Visual pass A+B (fresh deal; then 1 move + leave question open, incl. mode-switch wording): clean at
  390/768/1280 — no overflow, taps ≥44, text 16px, Lighthouse a11y 100 both states; focus lands on
  "Deal new game", returns to the asker on every answer and on Escape. Not reached: Auto-complete (needs a
  near-won deal; no URL fixture) — rests on the HUD tests.
- Story-close review (code-review high over `story/hud`, 10 findings): fixed 5 — a lapsed leave
  question revived on the next move and grabbed focus (correctness) → cleared when it lapses; a
  self-closing question stole focus → returns focus only if it went with it; the clock interval reset
  dropped measured time on re-run → the reading survives; "game under way"/undo rules duplicated across
  session and HUD → one home in `session.utils.ts`; unnamed request predicate → `isRequestForCurrentDeal`.
  Batched 5 to RF-backlog.
- Visual re-check after the close fixes (1280, DOM reads only, no captures — no style changed): all 7
  focus landings unchanged; undo to 0 moves closes the question and the next draw does not revive it.

### `persistence` (code-review high, 10 findings; visual pass A+B ×2)
- Found by the Cypress spec before review (fixed): resuming a game with more than 28 tableau cards crashed the
  deal animation (missing delay class) → a deal animates only while the deal is unstarted.
- Fixed — correctness (3): a second tab erased the other's win by rewriting its stale record every tick → the
  record is written only when this tab changed it, merged onto the saved one (`mergeStats`); a failed game
  write with a successful stats write let a win be counted twice after reload → stats save only after the
  game saves; a `?seed=` page re-dealt on every reload → the composition root strips the seed once dealt.
- Fixed — robustness (3): refused storage warned every second → once per key until a write succeeds; the save
  check accepted mixed-suit foundations / over-wide waste fans / history from another deal → schema refines;
  the Stats button's `aria-controls` pointed at nothing while closed → panel stays mounted, `hidden`.
- Fixed — style (2): Cypress copied the storage keys → `storage-keys.utils.ts`; the board's fresh-deal rule
  duplicated the session's → `isDealUnstarted` (progress).
- Deferred (1): saving the whole history on every tick — measured ~3.5ms / ~0.49MB per save at 500 undo steps
  (desktop); precondition recorded on the save effect in `game-provider.tsx`.
- Kept (1): `no-restricted-syntax: off` for `src/testkit/fakes/memory-storage.ts` — the shared config's
  documented boundary-file mechanism (Web Storage speaks null); it does not export single selectors, so a
  narrower override would copy the shared config → RF-backlog. Likewise `no-console` for `src/main.tsx`
  mirrors the shared `**/main.ts` composition-root exemption.
- Visual pass A+B (load state) and A+B (Stats panel open): clean at 390/768/1280 — no overflow, taps ≥44,
  panel text 16/18px, Lighthouse a11y 100, focus order Turn 1 → Turn 3 → New game → Stats → stock. Not seen:
  the panel with long values (only zeros rendered), settled 390/768 in the first pass (captured mid-deal).

### `celebration` (code-review high, 10 findings; visual pass A+B)
- Fixed — correctness (1): the winning King launched from mid-glide (measured while its move transition ran) →
  launches start from the fixed foundation slots.
- Fixed — robustness (3): nothing automated drew a card while the jsdom shim claimed browser coverage → the win
  e2e reads the canvas (paint below the foundation row, none above); a resize stretched the canvas and moved the
  floor → re-fit on resize; `role="dialog"` promised a modal it is not → a named region (play stays live behind
  it by design).
- Fixed — style (5): `nextRandom` via the engine barrel; App drilled `prefersReducedMotion` → `MotionProvider`;
  `planLaunches` → discriminated union; `CascadeModel` named; a misplaced doc comment.
- RF-backlog (1): the "panel takes focus when it appears" ref+effect is copied in `LeaveConfirm` and `WinOverlay`
  (only the first returns focus) → a shared hook at the third copy.
- Visual re-check (pass A, win screen, after the fixes): clean at 390/768/1280 — scoreboard never covered,
  paint stops at the foundation row, panel opaque and fully on screen.
- Visual pass A+B (win screen, 390/768/1280): no overflow, taps ≥44, Lighthouse a11y 100, New game focused on
  open. Fixed: cascade trails covered the Stats button and time readout → paint clipped below the foundation row;
  card faces showed through the panel → opaque. Not rendered: the reduced-motion path (source-checked; emulate
  has no reduced-motion option). Noted, kept: two buttons share the name "New game" (HUD and panel) — same action.

### `felt-and-sound` (code-review high, 10 findings; visual pass A+B)
- Fixed — correctness (2): phones could stay silent all visit (a touch press is not a user gesture for audio,
  and the player gave up after one try while playing into a frozen context) → every press, release, touchend and
  key retries until audio runs; nothing plays before. Dragging during auto-complete dropped silently (the
  reducer ignores player moves mid-sweep) → no pick-up while the sweep runs.
- Fixed — robustness (3): empty-pile outlines measured 1.78:1 → `--slot-line` 3.1:1, in the contrast test; the
  muted Sound label fell to 4.09:1 on hover → full text colour, hover fill a tested token; a mute toggled mid-drag
  was ignored by that drop → play reads the mute from a ref.
- Fixed — style (5): the sound preference re-implemented save parsing → reuses `parseSaved` (logs the reason);
  `SoundContextValue` moved to `sound-provider.utils.ts`; `saveMuted({ muted })`; fake outcomes are an enum;
  a card sent home that uncovers another plays the foundation chime (rule order), unused driver assert removed.
- Environment (noted): under heavy machine load (load average 20–40 from outside this session) the commit gate's
  Vitest workers failed to start and the property suite timed out at 5s; retried once load fell, never loosened.
- Visual pass A+B (load, Sound off, Stats open; 390/768/1280): no overflow, taps ≥44, text ≥16px, Lighthouse a11y
  100, focus order Turn 1 → Turn 3 → New game → Sound → Stats → stock, focus ring brass 2px. The page does not
  scroll at any width, so no gradient edge is reachable; none seen.
- Visual re-check (pass A, after the fixes): clean at 390/768/1280 — muted label full colour on hover, slot
  outlines visible.
- Awaiting the human: listen in Chrome and Safari — every action audible, nothing clipped or too loud.

### Epic `klondike-v1` (code-review high over `epic/klondike-v1`, 10 findings) → story `epic-review`
- Fixed (5): a save with an impossible tableau crashed every reload → tableau shape check (property-tested against
  real play); audio suspended later never returned → re-armed; `?seed=` could not replay turn 3 → `&draw=3`; the
  stock was clickable mid-deal → waits for the deal; discarded-save logs named the wrong operation.
- Deferred (2): BF-1 two tabs overwrite each other's game; BF-2 a quota-refused write resumes an older position.
- Kept (1): a drag off a foundation after a win un-wins it (non-modal win panel, `celebration` decision).
- RF-backlog (2): the duplicated run rule / engine constants; `CardProps` in `board.tsx`.
- `epic-review`'s own review (10): all fixed — stock/waste faces in the save check, gesture listeners stay on and
  defer to the voice's running state (no sound lost after a phone unlock), one home for the requested-deal type,
  Zod for `?draw=`, an operation enum for log names, two tests de-flaked/sharpened, a misplaced doc comment.
- Visual pass A+B (`?seed=1&draw=3`, mid-deal click and settled click; 390/768/1280): no overflow, taps ≥44,
  Lighthouse a11y 100; a mid-deal stock click leaves 0 moves and 0:00. Noted → RF: the stock shows no inert cue
  while the deal runs.

### `draw-animation` (code-review low, 0 findings; visual pass A+B)
- Root cause: React moved the drawn card's element from the stock's run of siblings to the waste's; a moved element
  loses its CSS transition. Fixed by a fixed (id) render order.
- Review: no findings. Visual A+B (`?seed=7`, settled + two draws; 390/768/1280): no overflow, no small targets,
  Lighthouse a11y 100, drawn card measured mid-transition. Noted only: cards are not keyboard-reachable (already
  Deferred: keyboard play). The reviewer read the commit message (it disclosed this) — its measurements stand.

## Deferred (not in v1 scope)
- Keyboard play — cards are pointer-only today (the stock button is keyboard-operable). Would need a
  focus model over piles and a pick/place key flow. Raised by the `drag` accessibility pass.

## RF-backlog
- Prettier coverage for JSON/SCSS/HTML (from `scaffold` review).
- (`hud`) `app.driver.tsx` `realNow` duplicates `testkit/provider-fakes.ts` `fakeNow` — one test clock.
- (`hud`) the `ElsewhereInTheApp` useGame probe is copy-pasted in the board and HUD drivers → testkit.
- (`hud`) `GameProvider` `useRef(now())` reads the clock on every render; a lazy initial value would do.
- (`hud`) HUD driver `modifier: 'ctrl' | 'meta'` string union → an enum.
- (`hud`) `hud.utils.ts` reaches into `session.game.moves` / `session.history` — add session selectors.
- (`persistence`) eslint-config-shalev: export the single syntax selectors (so a boundary override can drop
  only the null ban) and widen the composition-root `no-console` glob to `main.{ts,tsx}`.
- (epic review) the "run from this card" rule is written three times (rules.ts, apply.ts, drag.utils.ts) and engine
  counts are copied as local constants (MAX_WASTE_FAN, DECK_SIZE, TABLEAU_CARDS) → one engine selector + exports.
- (epic review) `CardProps` lives in `board.tsx` → `board.utils.ts`.
- (epic review) the stock gives no visual or aria cue that it is inert during the deal.
- (`celebration`) one focus-on-appear hook for `LeaveConfirm` and `WinOverlay` (the latter returns no focus).
