# Changelog

## auto-move — 2026-10-22
- **Pain:** every Ace and low card had to be sent home by hand, even when nothing on the table could ever need it — busywork most solitaire games do for you.
- **Fix:** after each move, cards that nothing left on the table could need (Aces, Twos, and cards whose two opposite-colour cards one rank lower are already home) fly to their foundations by themselves, one at a time.
- **Trade-off:** it is always on — no setting to turn it off (the plan left that choice open and it went unanswered), and it holds back any card a column might still want, so some cards still go home by hand.
- **Result:** one Undo takes back a move together with the cards it sent home; touching a card stops the flight; a card the player pulls down is left alone; a reload never moves anything; 406 tests pass (`vitest`, 22 more) plus all 13 browser tests; the review raised 9 issues — 5 fixed, 4 tidy-ups queued; visual pass clean on phone, tablet and laptop widths, accessibility 100.

## hint-game-over-checks — 2026-10-22
- **Pain:** Hint and the "No more moves" notice had only been checked inside a simulated page, and nobody knew how often the game-over check's safety limit hid a real game over.
- **Fix:** real-browser tests now press Hint and play into a stuck game, automated checks follow the first hint from thousands of random positions, and the safety limit was measured against an unlimited search.
- **Trade-off:** the limit stays — at 0.12% of game overs it misses a handful rather than risk a slow move on rare tables (an unlimited search took up to 1.4s).
- **Result:** the checks found Hint offering nothing in a game that still had a way forward (splitting a run to free a card for home) — now hinted, and playable by clicking; 384 tests pass (`vitest`, 7 more) plus 13 browser tests (5 new); the review raised 10 issues — 6 fixed, 3 dismissed, 2 tidy-ups queued (one from the visual pass); visual pass clean on phone, tablet and laptop widths, accessibility 100.

## game-over — 2026-10-21
- **Pain:** a player whose game had run out of moves got no word of it — the deck could still be drawn round forever, and Hint kept pointing at it.
- **Fix:** the game now checks after every move whether any progress is still possible, and if not shows a "No more moves" notice at the foot of the window with Undo and New game, while Hint says "No moves left" *(instead of: a one-step check that would have called a game over when splitting a run could still free a card for its foundation)*.
- **Trade-off:** it looks ahead through every rearrangement that changes nothing, so the check is exact, but on rare tables with long runs it gives up after 1,000 positions and says nothing rather than risk a wrong "game over".
- **Result:** the check takes a few milliseconds on real positions and at most ~80ms in the worst of 6,400 positions sampled from random play (measured); 377 tests pass (`vitest`, 20 more) plus all 8 browser tests; the review raised 10 issues — 3 fixed (including the notice flashing for an instant during the deal), 1 kept, 1 dismissed, 4 queued as bugs to fix, 1 tidy-up queued; visual pass clean on phone, tablet and laptop widths, accessibility 100.

## card-design — 2026-10-21
- **Pain:** the cards looked sharp and old-fashioned — a high-contrast serif and a dark oxblood back — when the user wanted something softer and more pleasing.
- **Fix:** warm cream faces with a gentle sheen, rounder corners, soft layered shadows, rounded sans corner indices, tinted frames behind the court letters, and a navy dotted back.
- **Trade-off:** the cards' colours and lettering are drawn in code rather than taken from an illustrated online deck, so there are no picture-card portraits, but nothing to license or download and they stay sharp at every size.
- **Result:** ink, court letters and the back are held to measured contrast (the back stays apart from the felt for red–green colour-blind players); 357 tests pass plus all 8 browser tests; the review raised 9 issues — 8 fixed, 1 queued; visual pass clean on phone, tablet and laptop widths, accessibility 100.

## hint — 2026-10-21
- **Pain:** a stuck player had no way to ask "what can I do here?", which most solitaire games offer.
- **Fix:** a Hint button (or the H key) rings the cards that could move and where they would land for two seconds; pressing again shows the next idea, best first, and the deck last; when nothing at all is left it says "No moves left".
- **Trade-off:** hints never suggest pointless shuffles or taking cards back off the foundations, and in a game that is stuck they keep pointing at the deck rather than declaring it lost, since the deck can still turn up a playable card.
- **Result:** hints cost no points; they go out the moment a move is made and never come back on an undo; 354 tests pass (`vitest`, 31 more); the review raised 10 issues — 9 fixed (including an undo bringing a hint back and a press during the deal wasting the best hint), 1 kept by design; the visual pass found a card left showing its back after a hint in Chrome (fixed by drawing the ring outside the card's flip), otherwise clean on phone, tablet and laptop widths, accessibility 100.

## click-to-play — 2026-10-21
- **Pain:** the only quick way to play a card was a double-click that could only send it up to a foundation; every other move needed a drag, unlike most solitaire games.
- **Fix:** one click plays a card's obvious move — up to its foundation if it fits, otherwise onto the first column that takes it — and a card with no move gives a short shake and the "rejected" sound.
- **Trade-off:** a click never makes a move that changes nothing (sliding a card to an equal spot, a King between empty columns, a card back off a foundation) — those still need a drag.
- **Result:** in a real browser a click plays, a double-click plays once, and a drag's release never also plays the card; 323 tests pass (`vitest`, 18 more); the review raised 10 issues — 8 fixed (including fast clicks being dropped and a card hopping between two columns), 2 judged not worth changing; visual pass clean on phone, tablet and laptop widths, accessibility 100.

## easy-drops — 2026-10-21
- **Pain:** a card had to be dropped almost exactly on a pile to count, so near-misses — just below a column, a little off to the side, or over an illegal pile next to the right one — snapped back.
- **Fix:** every pile catches drops a little past its edges, each column catches anything dropped below it down to the bottom of the window, and the drop goes to the most-covered pile that accepts the card.
- **Trade-off:** a pile must still catch a quarter of the card, so a drop squarely on the wrong pile snaps back rather than jumping to a neighbour it barely touched.
- **Result:** in a real browser a card released near the bottom of the window lands on the column above it; 305 tests pass (`vitest`, 6 more) plus the browser drag test; the review raised 9 issues — 6 fixed (neighbour stealing, grazes, tie order, untested floor rule, two small cleanups), 1 queued, 2 judged not worth changing.

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
