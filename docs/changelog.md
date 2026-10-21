# Changelog

## draw-animation — 2026-10-21
- **Pain:** drawing from the deck made the card pop onto the pile with no movement (every draw after the first), so the game felt broken next to the smooth moves elsewhere.
- **Fix:** the cards keep one fixed place in the page, so the browser no longer cancels a card's flight when it changes piles.
- **Trade-off:** none recorded — the order cards sit in the page never mattered for what you see, since stacking is set separately.
- **Result:** draws (turn 1 and turn 3) and undoing a draw now fly in a real browser (sampled mid-flight); 299 tests pass (`vitest`, 1 more); review found nothing; visual pass clean on phone, tablet and laptop widths, accessibility 100.

## epic-review — 2026-10-21
- **Pain:** a review of the whole game found a few ways it could break that no single story's review could see — a damaged save that would crash the page on every visit, sound that never came back after a phone was locked, and a replay link that could not ask for turn-3.
- **Fix:** saved games are now checked against every rule of where cards can lie, sound restarts at the next tap, `?seed=N&draw=3` replays a turn-3 deal, and the deck ignores clicks while cards are still being dealt.
- **Trade-off:** two rarer problems were written down rather than fixed — two open tabs overwriting each other's saved game, and a very long game no longer saving once storage fills up.
- **Result:** 298 tests pass (`vitest`) plus 8 browser tests; 20 review findings across two reviews, 18 fixed, 2 recorded for later; visual pass clean on phone, tablet and laptop widths, accessibility 100.

## felt-and-sound — 2026-10-21
- **Pain:** the table looked dark and flat, and the game made no sound at all, so moves felt weightless.
- **Fix:** a brighter green felt with every text, outline and focus ring re-tuned to stay readable, and a short synthesized sound for each card action (deal, draw, flip, place, rejected drop, recycle, card home, win) with a Sound on/off button that is remembered.
- **Trade-off:** no sound plays until the player first taps, clicks or presses a key, because browsers forbid it — so the opening deal of a visit is always silent.
- **Result:** 290 tests pass (`vitest`, 35 more than before this story) plus 2 new browser tests (silent before the first interaction, silent once muted and still muted after a reload); readability is measured by a test against the colours themselves; the review raised 10 issues, all fixed (including phones that would never have played sound); visual passes clean on phone, tablet and laptop widths, accessibility 100. Still to do by a person: listen in Chrome and Safari.

## celebration — 2026-10-20
- **Pain:** winning a game simply stopped — no payoff, and no obvious way on to the next deal.
- **Fix:** the classic bouncing-card cascade pours off the foundations, and a panel shows the time and score with a ready New game button.
- **Trade-off:** the panel is not a blocking dialog — the table stays live behind it, so undoing the last move (or dragging a card off a foundation) quietly ends the celebration.
- **Result:** 255 tests pass (`vitest`, 20 more than before this story) plus a real-browser test that wins a game and checks the cascade actually paints; the review raised 10 issues — 9 fixed (including the last King launching from the wrong place) and 1 cleanup queued; the visual pass found trails covering the scoreboard (fixed) and a see-through panel (fixed); clean on phone, tablet and laptop widths, accessibility 100; players who prefer reduced motion get the panel without the cascade.

## persistence — 2026-10-20
- **Pain:** closing or reloading the tab threw the game away, and nothing remembered how often the player had played or won.
- **Fix:** the game in progress (with its full undo history and time) saves itself after every change and comes back on reload, and a Stats button shows games played, won, win rate, best time and best score.
- **Trade-off:** a saved game that fails any check is set aside (logged) and a fresh deal starts, so a damaged save costs that one game but never the record, which is kept separately.
- **Result:** 235 tests pass (`vitest`, 43 more than before this story) plus 3 new browser tests (reload resumes, a replayed deal resumes, a win survives a reload); the browser test caught a crash when resuming a long game, and the review raised 10 issues — 8 fixed (including a second tab erasing a win), 1 deferred with a measured cost, 1 kept with reasons; two visual passes clean on phone, tablet and laptop widths, accessibility 100.

## hud — 2026-10-20
- **Pain:** the table played, but there was no way to start over, choose turn-1 or turn-3, take a move back, see the score or time, or let a finished game play itself out.
- **Fix:** a control bar with turn-1/turn-3, Undo (also Ctrl/Cmd+Z), a New game that asks before throwing away a game in progress, live score, moves and time, and an Auto-complete button once the game can finish itself.
- **Trade-off:** while auto-complete runs only Undo locks; New game and the mode switch stay live and stop the sweep, so a player is never trapped watching it.
- **Result:** 187 tests pass (`vitest`, 42 more than before this story) plus 2 browser specs; two reviews raised 20 issues — 15 fixed (including Ctrl+Z moving cards out from under a drag and a "leave this game?" question that could reappear one keypress from losing the game), 5 small cleanups queued; visual passes clean on phone, tablet and laptop widths, accessibility score 100.

## drag — 2026-10-20
- **Pain:** cards could only move by double-clicking them home; building columns, the heart of the game, was impossible.
- **Fix:** pick up any face-up card (with everything on top of it) and drop it where it belongs; an illegal or abandoned drop glides back.
- **Trade-off:** a drop mostly back over its own column always counts as a change of mind, even if it grazes a legal neighbour.
- **Result:** 145 tests plus a real-browser drag test pass; that test and the review together caught 6 real bugs (fixed), including drops that missed and a replayed deal that dealt the wrong game.

## board — 2026-10-20
- **Pain:** the rules existed only as logic — there was nothing to see or play.
- **Fix:** a card table where every card glides to its new place, turns over in 3D, deals out from the deck one by one, and plays by clicking the deck or double-clicking a card to send it home.
- **Trade-off:** cards ignore clicks for the ~1.5s deal, so the opening animation can never be interrupted into a wrong move.
- **Result:** 118 tests pass (`vitest`); the review raised 10 issues (9 fixed — including a double-click during the deal that could send an Ace up unasked) and two visual passes measured the table clean on phone, tablet and laptop widths.

## engine — 2026-10-20
- **Pain:** a solitaire game is only as trustworthy as its rules, and rule bugs (a wrong move allowed, a card lost, a score miscounted) are exactly what players notice.
- **Fix:** wrote every Klondike rule — dealing, drawing one or three, recycling, building, scoring, winning, auto-finishing — as plain logic that never touches the screen, and tested it against hundreds of random games.
- **Trade-off:** moves name the exact card they move, so the screen must always say which card; the payoff is that a double-click can never move the wrong card.
- **Result:** 72 engine tests (`vitest`, incl. 5 property suites over random games); the review raised 10 issues — 8 fixed, including a double-click that drew twice.

## scaffold — 2026-10-20
- **Pain:** there was no project, and every later story needed tooling that enforces the house rules without anyone remembering them.
- **Fix:** set up an empty app with automatic style checks, type checks, fast tests, real-browser tests and a gate that refuses bad commits.
- **Result:** the empty app boots; 2 tests (1 unit, 1 browser) pass; the review raised 10 issues, 7 fixed in-story.
