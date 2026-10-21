import { applyMove, GameStateModel, listLegalMoves, Move } from '~/engine/index.ts';

// Every position reached, the start first, and the moves between them.
export type RandomGameModel = { states: GameStateModel[]; moves: Move[] };

// Plays a random game: at each step one of the currently legal moves, chosen by the next pick.
export const playRandomly = ({ start, picks }: { start: GameStateModel; picks: readonly number[] }): RandomGameModel =>
    picks.reduce<RandomGameModel>(
        (acc, pick) => {
            const current = acc.states[acc.states.length - 1] ?? start;
            const legal = listLegalMoves(current);
            const move = legal[pick % Math.max(legal.length, 1)];

            return move === undefined
                ? acc
                : { states: [...acc.states, applyMove({ state: current, move })], moves: [...acc.moves, move] };
        },
        { states: [start], moves: [] },
    );
