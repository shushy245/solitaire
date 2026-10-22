import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { playRandomly } from '~/testkit/play-randomly.ts';

import { dealGame } from './deal.ts';
import { isStuck } from './stuck.ts';
import { applyMove } from './apply.ts';
import { listLegalMoves } from './rules.ts';
import { isFaceDown, isWon } from './selectors.ts';
import { isReturnOfKeptCard, listHints } from './hints.ts';
import { DrawMode, GameStateModel, Move, MoveKind } from './model.ts';

// Long enough to cycle a full deck twice in turn 3 and still play the table moves between.
const MAX_HINT_STEPS = 200;

const countFaceDown = (state: GameStateModel): number =>
    state.tableau.reduce((sum, column) => sum + column.filter(isFaceDown).length, 0);

const countHome = (state: GameStateModel): number => state.foundations.reduce((sum, pile) => sum + pile.length, 0);

const countDeck = (state: GameStateModel): number => state.stock.length + state.waste.length;

const isProgress = ({ from, to }: { from: GameStateModel; to: GameStateModel }): boolean =>
    countFaceDown(to) < countFaceDown(from) || countHome(to) > countHome(from) || countDeck(to) < countDeck(from);

enum Ending {
    Progress = 'progress',
    Won = 'won',
    Stuck = 'stuck',
    NoHint = 'no hint',
    Looped = 'looped',
}

// Where a walk from `start` has ended, if it has: progress, a win or a stuck game.
const endingAt = ({ start, state }: { start: GameStateModel; state: GameStateModel }): Ending | undefined => {
    if (isWon(state)) return Ending.Won;
    if (isProgress({ from: start, to: state })) return Ending.Progress;
    if (isStuck(state)) return Ending.Stuck;

    return undefined;
};

const homeIds = (state: GameStateModel): string[] => state.foundations.flat().map((card) => card.id);

// Cards taken down off a foundation along the way — the app never hints them back up (it reads its undo history).
const keptAlong = (positions: readonly GameStateModel[]): ReadonlySet<string> => {
    const last = positions[positions.length - 1];
    const homeNow = new Set(last === undefined ? [] : homeIds(last));

    return new Set(positions.flatMap(homeIds).filter((cardId) => !homeNow.has(cardId)));
};

// The position after the first hint, as the app shows it: never a card the player took down sent back up.
const afterFirstHint = (positions: readonly GameStateModel[]) => {
    const state = positions[positions.length - 1];

    if (state === undefined) return undefined;

    const keptOnTable = keptAlong(positions);
    const [hint] = listHints(state).filter((move) => !isReturnOfKeptCard({ move, keptOnTable }));

    return hint === undefined ? undefined : applyMove({ state, move: hint });
};

// The positions met following the first hint from `start`, up to an ending, a position with no hint or the limit.
const walkFirstHints = (start: GameStateModel): GameStateModel[] =>
    Array.from({ length: MAX_HINT_STEPS }).reduce<GameStateModel[]>(
        (walk, _, step) => {
            // A walk that stopped earlier stays stopped — no need to judge its last position again.
            if (walk.length <= step) return walk;

            const last = walk[walk.length - 1] ?? start;
            const next = endingAt({ start, state: last }) === undefined ? afterFirstHint(walk) : undefined;

            return next === undefined || walk.length > MAX_HINT_STEPS ? walk : [...walk, next];
        },
        [start],
    );

// Why following the first hint from `start` stopped.
const followFirstHint = (start: GameStateModel): Ending => {
    const walk = walkFirstHints(start);
    const last = walk[walk.length - 1] ?? start;
    const ending = endingAt({ start, state: last });

    if (ending !== undefined) return ending;

    return walk.length > MAX_HINT_STEPS ? Ending.Looped : Ending.NoHint;
};

// Where every card lies, and nothing else (the move count and score always change).
const cardsKey = (state: GameStateModel): string =>
    JSON.stringify([state.stock, state.waste, state.foundations, state.tableau]);

const deckKinds: ReadonlySet<MoveKind> = new Set([MoveKind.Draw, MoveKind.Recycle]);

const isDeckMove = (move: Move): boolean => deckKinds.has(move.kind);

const makesProgress = ({ state, move }: { state: GameStateModel; move: Move }): boolean =>
    !isDeckMove(move) && isProgress({ from: state, to: applyMove({ state, move }) });

const positionArb = fc.record({
    seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
    drawMode: fc.constantFrom(DrawMode.One, DrawMode.Three),
    picks: fc.array(fc.nat(), { maxLength: 150 }),
});

const positionFrom = ({ seed, drawMode, picks }: { seed: number; drawMode: DrawMode; picks: number[] }) => {
    const { states } = playRandomly({ start: dealGame({ seed, drawMode }), picks });

    return states[states.length - 1] ?? dealGame({ seed, drawMode });
};

describe('following the first hint', () => {
    it('reaches progress, a win or a stuck game — never a loop of moves that only shift cards about', () => {
        fc.assert(
            fc.property(positionArb, (position) => {
                const start = positionFrom(position);

                expect([Ending.Progress, Ending.Won, Ending.Stuck]).toContain(followFirstHint(start));
            }),
            { numRuns: 300 },
        );
    });

    // A draw then a recycle can rightly bring a short deck back round; only table moves must never undo each other.
    it('never leads back to where it started with a table move — a hint undone by the next hint is pointless', () => {
        fc.assert(
            fc.property(positionArb, (position) => {
                const start = positionFrom(position);
                const [hint] = listHints(start);

                if (hint === undefined || isDeckMove(hint)) return;

                const next = applyMove({ state: start, move: hint });
                const back = afterFirstHint([start, next]);

                expect(back === undefined ? undefined : cardsKey(back)).not.toBe(cardsKey(start));
            }),
            { numRuns: 300 },
        );
    });

    it('never points at the deck while another move would make progress', () => {
        fc.assert(
            fc.property(positionArb, (position) => {
                const start = positionFrom(position);
                const [hint] = listHints(start);

                if (hint === undefined || !isDeckMove(hint)) return;

                expect(listLegalMoves(start).filter((move) => makesProgress({ state: start, move }))).toEqual([]);
            }),
            { numRuns: 300 },
        );
    });
});
