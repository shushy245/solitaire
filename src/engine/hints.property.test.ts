import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { playRandomly } from '~/testkit/play-randomly.ts';

import { dealGame } from './deal.ts';
import { isStuck } from './stuck.ts';
import { applyMove } from './apply.ts';
import { listHints } from './hints.ts';
import { isFaceDown, isWon } from './selectors.ts';
import { DrawMode, GameStateModel } from './model.ts';

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

const afterFirstHint = (state: GameStateModel) => {
    const [hint] = listHints(state);

    return hint === undefined ? undefined : applyMove({ state, move: hint });
};

// The positions met following the first hint from `start`, up to an ending, a position with no hint or the limit.
const walkFirstHints = (start: GameStateModel): GameStateModel[] =>
    Array.from({ length: MAX_HINT_STEPS }).reduce<GameStateModel[]>(
        (walk) => {
            const last = walk[walk.length - 1] ?? start;
            const next = endingAt({ start, state: last }) === undefined ? afterFirstHint(last) : undefined;

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
});
