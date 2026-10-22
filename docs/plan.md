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
  one click plays a card's obvious move — up to its foundation, else onto the first column that takes it
  (`click-to-play`; this replaced double-click-to-send-up). Ctrl/Cmd+Z undoes.
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
    playCard: (cardId: string) => void; // intent, resolved against the current game
    undo: () => void;
    newGame: (opts: { drawMode: DrawMode }) => void;
    undoToUnstuck: () => void;                 // (stuck-polish) the game-over panel's Undo: back to the last unstuck position
    startAutoComplete: () => void;
    reportGameOver: (isGameOver: boolean) => void; // (stuck-polish) the hint provider stops the clock on a stuck game
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
shake); a double-click plays once (its second click is ignored, so the old double-click-to-send-up still works) · Hint highlights one move (source card + target pile, ~2s), pressing again
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

### Story `easy-drops` — sloppy drops still land ✅
- Owns: `src/app/drag/`
- Depends on: draw-animation
- Parallel: serial
- Cases:
  - a tableau column's drop area reaches the bottom of the window (the table itself ends below its longest column), so a drop well below its last card lands there
  - each pile's drop area is padded sideways, so a drop slightly off a pile's edge still lands
  - among overlapped piles the legal one wins even when an illegal pile overlaps more
  - among several legal piles the one with the most overlap wins
  - no legal overlapped pile → snap back (unchanged); dropping on the source pile is still a no-op
  - padded areas never make a pile the dragged card does not touch win over one it does (review: a pile must catch ≥ a quarter of the card)
  - review: a drop dead centre on an illegal pile snaps back even when a legal neighbour's padding grazes it
  - review: an exact tie between the source and a neighbour snaps back, whatever the page order

### Story `click-to-play` — one click plays the obvious move ✅
- Owns: `src/app/board/`, `src/engine/` (new `findClickMove` selector)
- Depends on: easy-drops
- Parallel: serial
- Cases:
  - engine: a top card that fits a foundation goes there (2♥ onto A♥); an Ace goes to an empty foundation
  - engine: otherwise a face-up card (with its run) goes to the first legal tableau column, preferring a non-empty column over an empty one
  - engine: a King already heading an otherwise empty column is not moved to another empty column (no pointless move)
  - engine: no legal move → none; face-down cards and the stock never resolve
  - board: a single click on a playable card plays it; on an unplayable card it shakes and nothing changes
  - board: a click that ends a drag is not a click (the browser's click after a drag's release is swallowed)
  - pre-mortem: a double-click fires two clicks — only the first (detail 1) plays, so a card never hops on to a second column
  - pre-mortem: the shake animates `translate`, never `transform` (which places the card)
  - pre-mortem: clicks are ignored mid-deal and during auto-complete
  - review: quick clicks on different cards all play (the browser's click count spans cards)
  - review: a drag's release click is ignored however late it arrives; the next plain click plays
  - review: a card resting on its own run is not shifted to an equal column (no ping-pong)
  - review: a face-down card ignores clicks; a shake ends with its animation or when the game moves on

### Story `hint` — show me a move ✅
- Owns: `src/app/hud/` (button), `src/engine/` (`listHints`), `src/app/board/` (highlight)
- Depends on: click-to-play
- Parallel: serial
- Cases:
  - engine: hints rank foundation moves, then moves that reveal a face-down card, then waste→tableau, then other
    tableau moves; never a move that just shuffles a run between equal positions (King from an empty column to an empty one)
  - engine: the stock (draw or recycle) is always the last hint, the only one when nothing else plays; an Ace counts once, not once per empty foundation; empty stock and waste with no move → no hint
  - Hint button and the H key highlight the source card(s) and target pile; the highlight clears after ~2s
  - pressing Hint again shows the next hint, wrapping round
  - any game change clears the highlight and restarts the cycle at the first hint
  - "No moves" is announced when there is nothing to suggest; no score penalty either way
  - pre-mortem: the clear timer is cancelled on unmount and on a new hint (no stale clear wiping a newer highlight)
  - pre-mortem: H while typing in no field (there are none) — H with a modifier key does nothing
  - review: an undo back to the hinted game does not revive the hint; a press mid-deal is refused, not used up
  - review: a column move that only empties its column ranks below the waste; a King fits empty columns once
  - review: no hints once the game is won; a hint costs no points or moves

### Story `card-design` — softer, more pleasing cards ✅
- Owns: `src/app/board/board.module.scss`, `src/styles/global.scss`, `src/styles/table-metrics.module.scss` (`--radius`, also rounds slots and the hint ring), `src/app/celebration/cascade-canvas.ts`
- Depends on: hint
- Parallel: serial (last)
- Cases:
  - card faces: warm cream, rounder corners, soft layered shadow, large corner rank+suit, centre suit art
  - red and black inks stay ≥ 4.5:1 on the card face (contrast test); the back stays distinct from the felt
  - visual pass at 390/768/1280: indices readable at the smallest size (measured)

### Story `game-over` — tell the player when no progress is possible (requested 2026-10-21) ✅
- Interview decisions: "game over" = **no progress possible**, detected exactly (never a guess). Progress means
  reaching a position with fewer face-down cards, fewer cards in the deck (stock + waste) or more cards home than
  now. `isStuck` explores every position reachable without progress — column shifts, cards down off a foundation,
  draws and recycles (real turn-3 groupings) — and is stuck only when none of them leads to progress (story-start
  decision, 2026-10-21: the single-step rule first planned called a run split that frees a card for its foundation
  "game over"). A safety cap on positions explored answers "not stuck" — a missed announcement, never a false one.
  Not a solver: a deal that is lost but still has progress to make is not flagged. On trigger, a non-blocking
  "No more moves" panel with Undo and New game; the game stays open, so undoing lets the player try another
  line. It is recorded as a loss only by being left unwon (stats already count played-not-won).
- Owns: `src/engine/` (new `isStuck`), `src/app/game-over/` (panel), `src/app/hint/` (its "No moves left" uses
  `isStuck`; the provider works it out once per game), `src/app.tsx` (mounts the panel)
- Depends on: card-design
- Parallel: serial
- Cases:
  - engine: a won game is not stuck; an empty stock and waste with no table move is stuck
  - engine: not stuck while a move turns a card over, sends a card home or plays the waste
  - engine: not stuck when a card further round the deck would play, even if the current waste top cannot
  - engine: turn 3 — a card only ever buried inside a draw of three does not count; one each draw leaves on top does
  - engine: a run split that frees a card for its foundation is not stuck; shifts and foundation moves that lead
    nowhere are stuck
  - property: from random play, a stuck position never has a legal move that turns a card over, sends a card home
    or plays the waste
  - panel: appears when the game becomes stuck, with Undo and New game; Undo closes it and steps back; New game
    deals in the same mode
  - panel: not shown mid-deal, during auto-complete, or for a won game; a game resumed already stuck shows it
  - hint: in a stuck game Hint says "No moves left" instead of pointing at the deck forever
  - pre-mortem: the check runs once per game change, not per clock tick (the deck cycle is up to 24 draws)
  - pre-mortem: turn-3 cycling must use the real draw groupings, or a card the player can never reach counts as
    playable (a false "not stuck") — or one they can reach is missed (a false "game over")
  - pre-mortem: a card taken down off a foundation and put back is not progress (measured against the start, not
    per move), or a stuck game with a foundation card that fits a column is never flagged
  - pre-mortem: positions are told apart by every pile (stock/waste split included), so a reachable position is
    never skipped as "seen"
  - pre-mortem: the panel's buttons are real 44px targets and the panel never covers the foundation row or HUD
  - review: a fresh stuck deal never mounts the panel mid-deal (readiness is reported per deal number)

---

## Epic: Trust and flow (requested 2026-10-22)
Interview decisions: prove Hint and "No more moves" right in a real browser and under property tests, and measure
how often the stuck check's cap misses a real game over · from a survey of other solitaire games (Microsoft
Solitaire Collection, Google, solitaired.com, 247 Solitaire — from memory, not a fresh search), only **auto-move
safe cards** is taken. Considered and not taken: winnable-deals option, restart deal + redo, daily deal, Vegas /
no-score / limited passes, streaks and per-mode stats, card back / felt / left-handed options. BF-3..BF-6 stay in
the `game-over` triage, not in this epic. Keyboard play stays Deferred.
Order: `hint-game-over-checks` → `auto-move` (serial: auto-move changes what "progress" a hint or stuck check sees).

### Story `hint-game-over-checks` — Hint and "No more moves" proven right ✅
- Owns: `cypress/e2e/` (new `hint.cy.ts`, `game-over.cy.ts`), `src/engine/` (property tests, a test-only uncapped
  `isStuck` run), `src/testkit/`
- Depends on: game-over
- Parallel: serial (first)
- Cases:
  - Cypress: Hint (button and H) rings a card and its target pile in a real browser; the ring goes out after ~2s;
    a second press shows the next hint
  - Cypress: `?seed=22&draw=3` shows "No more moves" once the deal settles; New game deals in turn 3 and the panel goes
  - Cypress: a game that becomes stuck after a move shows the panel with Undo enabled; Undo closes it and steps back
    (needs a seed that gets stuck a move or two in — find one and record it beside `?seed=22&draw=3`)
  - Cypress: in a stuck game Hint says "No moves left"
  - property: following the first hint over and over from random deals reaches progress (a card turned over, a card
    home, fewer cards in the deck), a win or a stuck game within a bounded number of steps — never a loop of moves
    that only shift cards back and forth
  - property: the first hint is never a pointless move, and never the deck while a table move would make progress
  - measurement: over many seeds × random play, run `isStuck` with and without the 1,000-position cap; record the
    rate of missed notices (cap said "not stuck", uncapped said stuck) and the worst uncapped search size here.
    It never reports a false "stuck". A miss rate above ~1% of stuck positions is raised with the user before
    any change to the cap
  - any defect these checks find: reproduce as a failing test, fix, record in the triage

### Story `auto-move` — safe cards go home by themselves ✅
- Owns: `src/engine/` (new `nextSafeMove`), `src/app/session/` (auto-move step), `src/app/game-provider.tsx` (cadence)
- Depends on: hint-game-over-checks
- Parallel: serial
- Decided at story-start (autonomous run, question unanswered): **on, no toggle** — flagged to the user; a toggle
  is a small follow-up if wanted
- Cases:
  - engine: an Ace or a 2 whose Ace is home is safe; any other card is safe only when both opposite-colour cards one
    rank lower are already home (nothing left on the table could need it as a base)
  - engine: only top cards of the waste or a column are moved; never a card from a foundation
  - after each player move (and after a draw), safe cards fly home one at a time at the auto-complete cadence, each
    a normal scored move (+10)
  - undo steps back over the player's move and the auto-moves it caused together, in one press
  - a move that leaves no safe card moves nothing; auto-move never runs mid-deal, mid-drag or once the game is won
  - auto-moving the last card wins the game exactly once (stats, win sound, cascade)
  - Hint and the stuck check see the position after auto-moves, never the one in between
  - pre-mortem: a new game, undo or drag started mid-sequence stops it (no move lands on the wrong game)
  - pre-mortem: a restored game on load runs no auto-moves until the player moves (no surprise moves on reload)

### Story `polish-review` — fixes from the epic-level review of Play polish + Trust and flow (2026-10-22) ✅
- Owns: `src/engine/` (hints, safe-move), `src/app/session/`, `src/app/board/`, `src/app/drag/`, `src/app/hud/`,
  `src/app/hint/`
- Depends on: auto-move
- Parallel: serial
- Cases (one per finding, red first):
  - E1 Hint suggests taking a card down off a foundation when that lets a table card turn over or the waste play onto
    it, so a game that is not stuck never hears "No moves left"
  - E2 a card the player took down off a foundation is never auto-moved back by a later move in the same game
  - E3 each card's accessible name says where it lies (column, waste, foundation, stock), so the id-sorted DOM order
    still reads sensibly
  - E4 the second click of a double-click never plays the card the first click uncovered
  - E5 "No moves left" appears without moving the table (no layout shift)
  - E6 a drop whose source pile overlaps more than any legal pile snaps back, whatever overlaps most
  - E7 the stuck search runs only while hints are on (not mid-deal or mid-sweep)
  - E8 a click on a card already home does nothing (no shake, no snap-back sound)

### Story `stuck-polish` — BF-3..BF-6 from the `game-over` review (2026-10-22, autonomous run)
- Owns: `src/app/game-over/`, `src/app/session/` (undo-to-unstuck, stuck clock), `src/app/hud/` (leave confirmation),
  `src/app/game-provider.tsx` (stuck flag into the clock)
- Depends on: polish-review
- Parallel: serial
- Decisions (user, 2026-10-22): panel Undo only leaps; no confirmation for New game only; the panel can be closed.
- Cases:
  - BF-3: the panel's Undo goes back to the last position that was not stuck, however many draws were made after
    the game got stuck; the HUD's Undo and Ctrl+Z still take back one move
  - BF-3: with no earlier unstuck position (stuck from the deal), the panel's Undo stays disabled
  - BF-4: New game on a stuck game deals at once, no "leave this game?"; the turn-1/turn-3 switch still asks
  - BF-5: the panel has a close button; closed, it stays away while the game stays stuck (draws included) and comes
    back once the game has been un-stuck and gets stuck again; Hint still says "No moves left"
  - BF-6: the clock stops while the game is stuck and runs again after an Undo out of it
  - pre-mortem: the stuck search must not run per clock tick (the clock needs a flag worked out once per game)
  - pre-mortem: closing the panel returns focus somewhere sensible (the table stays playable by pointer)
  - pre-mortem: undo-to-unstuck runs the stuck search per history entry — bounded by the draws made after getting
    stuck; an auto-move or New game mid-way never leaves a half-undone state

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

### `easy-drops` (code-review medium, 9 findings; no visual pass — no rendering file changed)
- Fixed (6): padding overlaps neighbours so a dead-centre drop on an illegal pile jumped to a grazed legal one,
  and 1px grazes landed → `MIN_DROP_SHARE` (precondition recorded on `DROP_PADDING_RATIO`); ties fell to page
  order → source first; the floor rule lived untested in the hook → `widenDropAreas` (pure, tested); inline
  `area > 0` → `hasOverlap`; rules checked for every touched pile → one `find`.
- Accepted (1): the foundation row's and the tableau's padded areas overlap vertically — with `MIN_DROP_SHARE`
  a slightly-low drop needs a quarter of the card on the column to fall to it, which is a real drop there.
- Not changed (1): the floor needs a browser to test end to end — checked by hand in Chrome (a drop near the
  window foot lands on the column above).
- RF (1): `isTableauPile` (drag) repeats `isTableauSlot` (layout) over a different shape.

### `click-to-play` (code-review high, 10 findings; visual pass A+B)
- Fixed (8): `detail ≥ 2` dropped quick clicks on other cards → only a repeat on the card just played is
  ignored; the drag-click guard expired on a timer (late touch clicks slipped past, and it leaked between tests
  under fake timers) → `isDragClick` flag reset per press; a card on its own run ping-ponged → moves off a
  face-up card are pointless; face-down clicks shook → ignored; shake state never cleared and its re-keying
  could cut a flip → cleared on animationend / game change, no re-key; inline shake logic → `isShakingCard`;
  stale double-click docs.
- Not changed (2): `findClickMove` lists every legal move and runs twice per click — at most a few hundred
  candidates per click, no measured cost; `isPointlessMove` exported ahead of `hint`, which uses it next.
- Visual A+B (`?seed=7`; settled, mid-shake, after a click-move; 390/768/1280): no overflow, cards ≥ 46×65,
  Lighthouse a11y 100. Noted: cards are not keyboard-reachable (already Deferred: keyboard play); the stuck
  `data-shaking` it saw is the review's shake-state finding, fixed after the pass.
- Found while testing: jsdom has no `AnimationEvent`, so React listened for `webkitAnimationEnd` →
  `src/testkit/jsdom-animation-event.ts` (landmine in CLAUDE.md).

### `hint` (code-review high, 10 findings; visual pass A+B)
- Fixed (9): undo restored the hinted game object and revived the hint → the provider drops the hint on any game
  change; a mid-deal press used up the best hint unseen → the board reports the table dealt and requests wait;
  ranking put column-emptying moves above waste plays → reveal 1, waste 2, empty 3; a King got one hint per empty
  column → one per card; hints after a win said "No moves left" → off once won; the staleness rule lived twice
  and `listHints` ran twice per press → one `isCurrentHint`, the hint keeps its move; `isStock` inferred from a
  missing target → from the move kind; three comments displaced by inserted code.
- Kept (1): a stuck game keeps hinting at the deck instead of "No moves left" — the deck can still bring a
  playable card, and "no moves" is only certain with stock and waste empty (plan decision).
- Visual A+B (`?seed=7`; settled, after one press, after four; 390/768/1280): no overflow, taps ≥44, Lighthouse
  a11y 100. Found: at 768/1280 a face-up Jack painted as its back after the ring went out — the ring was a
  box-shadow on `.front` inside the preserve-3d layer → moved to `.card.hinted::after`; not reproduced since.
  Not seen by the pass: the "No moves left" line with text (its deal always had a move) — covered by HUD tests.

### `card-design` (code-review medium, 9 findings; visual pass A+B)
- Fixed (8): indices shrank and sat lower (tight at the 13px floor) → restored; fanned-card edges faded → firmer
  edge and contact shadow; the back's centre near the felt's lightness → measured, darker; court letters untested
  on their frame → tokens + test (red ink darkened to pass); back dots in fixed px → scale with the card; Owns
  list incomplete.
- RF (1): `--radius` and the cascade's `CORNER_RATIO` hold one value in two places.
- Visual A+B (`?seed=7`; settled, three draws, a covered card; 390/768/1280): no overflow, Lighthouse a11y 100,
  covered-card rank ink fully visible at 390 (before the index fixes added more room).

### `game-over` (code-review high, 10 findings; visual pass A+B)
- Found at story-start (user decision): the planned single-step rule called a run split that frees a card for its
  foundation "game over" → bounded search for progress. Measured over 6,400 random-play positions: p99.9 searches
  128 table positions, two outliers reached 4–5k (~400ms) → cap 1,000 (worst ~80ms), answering "not stuck".
- Fixed (3): a fresh stuck deal mounted the panel for one commit mid-deal and took focus (the table counted as ready
  until the board said otherwise; also on New game) → readiness reported per deal number, `isTableReadyFor`; a
  three-dot `session.game.drawMode` chain; `countFaceDown` repeated `isFaceDown`.
- Kept (1): `isStuck` runs in render, memoised per game — measured a few ms typically, ~80ms at the cap; precondition
  recorded on `MAX_POSITIONS`.
- Dismissed (1): no test for "not during auto-complete" — an auto-completable game always has a card to send home,
  so it is never stuck; `canHint` also excludes it.
- BF (4): BF-3 draws made after the game got stuck pile up history, so the panel's Undo takes one press per draw
  before "another line" — fix: Undo back to the last position that was not stuck. BF-4 the HUD's New game still
  asks "leave this game?" on a stuck game (two prompts at once) — fix: a stuck game needs no confirmation. BF-5 the
  panel at the window's foot can cover the last cards of a long column (not seen by the pass: its deal is short)
  — fix: let it be dismissed, or lift it clear of the columns. BF-6 the clock keeps running on a stuck game.
- RF (1): the focus-taking panels (win, game over) return no focus when they close — `LeaveConfirm` does.
- BF decisions (user, 2026-10-22): BF-3 — only the panel's Undo leaps back to the last position that was not stuck
  (HUD Undo / Ctrl+Z stay one step); BF-4 — a stuck game skips the confirmation for New game only (the turn-1/turn-3
  switch still asks); BF-5 — the panel can be closed, stays closed while the game stays stuck, and comes back once
  the game has been un-stuck (Hint still says "No moves left").
- Visual A+B (`?seed=22&draw=3`, stuck from the deal; 390/768/1280): no overflow, taps ≥44, text ≥16px, Lighthouse
  a11y 100, focus lands on New game (Undo disabled), traversal clean. Not rendered: the panel with Undo enabled.
  Noted, kept: the note line is ~40 characters (a short notice, under the 45 floor) and wraps one word at 390.
  The deal-readiness fix after the pass changed timing only, no style — checked in Chrome, not re-passed.

### `hint-game-over-checks` (code-review medium, 10 findings; visual pass A+B)
- Found by the story: Hint dropped every move off a face-up card as pointless, so a game whose only progress was a
  run split that frees a card for its foundation had no hint while `isStuck` said "not stuck" → such a split is
  hinted (ranked with moves that turn a card over).
- Measured (cap): 4,000 seeds × random play (50–300 moves), every 5th position — 64,034 positions, 2,523 stuck.
  The 1,000-position cap gave up 3 times, all 3 really stuck: **0.12% of game overs missed** (threshold ~1%) → cap
  kept. Worst uncapped search: under 16,000 positions, ~1.4s. Never a false "stuck" (the cap only answers "not stuck").
- Fixtures: `?seed=148&draw=3` is one move from stuck (click the 8♣ onto the 9♦); `?seed=1` hints J♦→Q♣ then 4♥→5♣.
- Fixed (6): a hinted split could not be played by clicking the hinted card (click still called it pointless) →
  the freeing rule moved into `isPointlessMove`, one definition for Hint and click; the ping-pong property could fail
  on a legitimate draw-then-recycle round trip → it checks table moves only; the New game check could not tell a new
  deal from the old → the cards must lie elsewhere; the ring reader fell back to "no ring" without a window → read
  through `cy.window()`; the walk re-judged ended walks → skips them; `waitForSettledDeal` copied into 5 Cypress
  drivers → `cypress/support/drivers/deal.ts` (with `readTable`).
- Dismissed (3): the panel is checked gone straight after New game, mid-deal — that is the claim ("the panel goes");
  a fresh random deal stuck from the start would rightly show it again. The property test's progress counters copy
  `stuck.ts` — on purpose: an oracle must not share the code it checks. `judgeStuck` exported with no app caller —
  it is the measurement tool this story asked for; precondition: if the cap is ever re-measured or removed, use it.
- RF (2): `isFreeingMove` runs `applyMove` twice per column move (filter and rank) → compute once per move. The two
  disabled Undo buttons (HUD outline, panel filled at 45% opacity) look different (visual pass).
- Visual A+B (`?seed=1` after H; `?seed=22&draw=3`; 390/768/1280): no overflow, taps ≥44, text ≥16px, Lighthouse a11y
  100 on both, traversal clean, focus visible. Not checked: Lighthouse on the lit ring (it lasts 2s), the ring under
  reduced motion. The panel note line is 39–40 characters (known, kept from `game-over`).

### `auto-move` (code-review high, 9 findings; visual pass A+B)
- Fixed (5): a step landing between a press and the drag threshold ended the press, so the sequence ran on → stop
  on the press (`onPress`); a card the player took down off a foundation flew straight back (−15 then +10) → no
  auto-move after a FoundationToTableau move; a rejected step could stall in AutoMoving → it ends the phase (as the
  auto-complete step does; not reachable today — no test can build the disagreement); Auto-complete was offered
  mid-sequence → not while AutoMoving; the stuck search ran on every position auto-move passes through → skipped.
- RF (4): `nextSafeMove` and `nextAutoMove` both scan tops for a foundation target (and differ on the face-up check)
  → one `listFoundationMoves`; a step works out `nextSafeMove` twice; `nextSafeMove` builds every candidate to keep
  the first; `stepKindMap` lives in `game-provider.tsx` → `game-provider.utils.ts`.
- Visual A+B (`?seed=1`: settled, after J♦, after draws; 390/768/1280): no overflow, taps ≥44, text ≥16px, Lighthouse
  a11y 100, traversal clean; drawn Aces flew home with no press; under reduced motion they jump (no animation).
  Not checked: a press overlapping a live sequence in the browser, turn 3, real touch.

### `polish-review` (code-review low, 0 findings; visual pass A+B)
- Fix-only story, reviewed at low effort (review-cost rule): one pass over the non-test changes, no finding.
- E2 changed meaning mid-story: auto-move was removed at the user's request (2026-10-22), so "never auto-moved
  back" became "Hint never suggests sending back a card the player took down" (`isReturnOfKeptCard`).
- E5 found by measuring in Chrome: the empty "No moves left" line had no height, so the table dropped 19.5px for two
  seconds → the line keeps one line of height. The first e2e draft was blind (it re-checked the table after the
  message cleared) → message and table top read in one retry.
- BF (1) flaky: `hint.cy.ts` "pressing H again shows the next hint" failed once in 7 runs of the spec with no change
  between runs (another run had a second, unnamed failure). Not chased yet.
- Visual A+B (`?seed=1` settled; `?seed=22&draw=3` settled and right after Hint; 390/768/1280): no overflow, taps ≥44,
  text ≥16px, Lighthouse a11y 100 on both, traversal clean, no console errors; board top unchanged by the message at
  all three widths (153.5px at 768/1280, 285px at 390). Kept: the reserved line leaves an empty band above the stock
  when no message shows (the cost of the fix). Kept: the panel's New game shows its focus ring on appear (focus is
  placed there on purpose). Dismissed: the message "line length" 90–101 — the script measures the full-row element,
  the text is 30 characters. Known: panel note 39–40 characters; cards not in the tab order (Deferred: keyboard play).
  Not checked: reduced motion emulated in the browser, the hint state's script numbers at 390 (the message may have
  cleared first; the before/after table position was read while it showed).

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
- (`easy-drops`) `isTableauPile` in drag.utils repeats `isTableauSlot` in layout.utils → one pile-kind predicate.
- (`game-over`) the win panel and the game-over panel return no focus when they close (`LeaveConfirm` does) —
  extend `useFocusOnAppear` to hand focus back when it was lost.
- (`hint-game-over-checks`) `isFreeingMove` runs `applyMove` twice per column move in `listHints` → once.
- (`hint-game-over-checks`) the HUD's and the game-over panel's disabled Undo look different → one disabled style.
- (`auto-move`) `nextSafeMove` and `nextAutoMove` both scan tops for a foundation target → one `listFoundationMoves`.
- (`auto-move`) a step works out `nextSafeMove` twice, and `nextSafeMove` builds every candidate to keep the first.
- (`auto-move`) `stepKindMap` (pure lookup) lives in `game-provider.tsx` → `game-provider.utils.ts`.
- (`card-design`) `--radius` and `CORNER_RATIO` (cascade-canvas.ts) duplicate one value → read the card's computed radius.
