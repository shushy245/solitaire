# Changelog

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
