import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { aGameState } from '~/testkit/builders/index.ts';

import { dealGame } from './deal.ts';
import { applyMove } from './apply.ts';
import { listLegalMoves } from './rules.ts';
import { isMovableRun, isWon } from './selectors.ts';
import { isAutoCompletable, nextAutoMove } from './auto-complete.ts';
import { DrawMode, GameStateModel, Move, MoveKind, Rank } from './model.ts';

// Plays a random game: at each step one of the currently legal moves, chosen by the next pick.
const playRandomly = ({ start, picks }: { start: GameStateModel; picks: readonly number[] }) =>
    picks.reduce<{ states: GameStateModel[]; moves: Move[] }>(
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

// Key-order-independent identity for a move (JSON.stringify alone depends on property order).
const moveKey = (move: Move) => JSON.stringify(move, Object.keys(move).sort());

const allCards = (state: GameStateModel) => [
    ...state.stock,
    ...state.waste,
    ...state.foundations.flat(),
    ...state.tableau.flat(),
];

const expectInvariants = (state: GameStateModel) => {
    const cards = allCards(state);
    expect(cards).toHaveLength(52);
    expect(new Set(cards.map((c) => c.id)).size).toBe(52);

    expect(state.stock.every((c) => !c.faceUp)).toBe(true);
    expect(state.waste.every((c) => c.faceUp)).toBe(true);

    state.tableau.forEach((column) => {
        const firstUp = column.findIndex((c) => c.faceUp);
        const faceUpPart = firstUp === -1 ? [] : column.slice(firstUp);

        // face-down cards form a prefix; a non-empty column always shows its top card
        expect(faceUpPart.every((c) => c.faceUp)).toBe(true);
        expect(column.length === 0 || faceUpPart.length > 0).toBe(true);
        expect(isMovableRun(faceUpPart)).toBe(true);
    });

    state.foundations.forEach((pile) => {
        expect(pile.every((c, i) => c.rank === Rank.Ace + i && c.suit === pile[0]?.suit && c.faceUp)).toBe(true);
    });

    expect(state.score).toBeGreaterThanOrEqual(0);
    expect(state.wasteFan).toBeLessThanOrEqual(Math.min(state.drawMode === DrawMode.One ? 1 : 3, state.waste.length));
    expect(state.wasteFan).toBeGreaterThanOrEqual(Math.min(1, state.waste.length));
};

const gameArb = fc.record({
    seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
    drawMode: fc.constantFrom(DrawMode.One, DrawMode.Three),
    picks: fc.array(fc.nat(), { minLength: 1, maxLength: 250 }),
});

describe('engine invariants over random games', () => {
    it('every reachable state keeps 52 unique cards, hidden cards under shown ones, valid runs and foundations', () => {
        fc.assert(
            fc.property(gameArb, ({ seed, drawMode, picks }) => {
                playRandomly({ start: dealGame({ seed, drawMode }), picks }).states.forEach(expectInvariants);
            }),
            { numRuns: 300 },
        );
    });

    it('every listed legal move is accepted and counted; the move count grows by exactly one', () => {
        fc.assert(
            fc.property(gameArb, ({ seed, drawMode, picks }) => {
                const { states } = playRandomly({ start: dealGame({ seed, drawMode }), picks });

                states.slice(1).forEach((state, i) => {
                    const before = states[i];

                    expect(before).toBeDefined();
                    expect(state).not.toBe(before);
                    expect(state.moves).toBe((before?.moves ?? 0) + 1);
                });
            }),
            { numRuns: 200 },
        );
    });

    it('a move not in the legal list never changes the state', () => {
        const strayMoveArb = fc.oneof(
            fc.constant<Move>({ kind: MoveKind.Draw }),
            fc.constant<Move>({ kind: MoveKind.Recycle }),
            fc.record({
                kind: fc.constant(MoveKind.TableauToTableau),
                from: fc.nat(8),
                to: fc.nat(8),
                cardId: fc.constantFrom('hearts-1', 'spades-13', 'clubs-7'),
            }),
            fc.record({
                kind: fc.constant(MoveKind.WasteToFoundation),
                to: fc.nat(5),
                cardId: fc.constantFrom('hearts-1', 'diamonds-2'),
            }),
            fc.record({
                kind: fc.constant(MoveKind.FoundationToTableau),
                from: fc.nat(5),
                to: fc.nat(8),
                cardId: fc.constantFrom('hearts-1', 'clubs-2'),
            }),
        );

        fc.assert(
            fc.property(gameArb, strayMoveArb, ({ seed, drawMode, picks }, stray) => {
                const { states } = playRandomly({ start: dealGame({ seed, drawMode }), picks });
                const state = states[states.length - 1] ?? dealGame({ seed, drawMode });
                const isListed = listLegalMoves(state).some((m) => moveKey(m) === moveKey(stray));

                expect(isListed || applyMove({ state, move: stray }) === state).toBe(true);
            }),
            { numRuns: 300 },
        );
    });

    it('applyMove never mutates the state it is given', () => {
        fc.assert(
            fc.property(gameArb, ({ seed, drawMode, picks }) => {
                const { states, moves } = playRandomly({ start: dealGame({ seed, drawMode }), picks });
                const snapshots = states.map((s) => structuredClone(s));

                moves.forEach((move, i) => {
                    const state = states[i];

                    if (state !== undefined) applyMove({ state, move });
                });

                expect(states).toEqual(snapshots);
            }),
            { numRuns: 100 },
        );
    });

    it('from any auto-completable state, repeating nextAutoMove wins', () => {
        const won = Array.from({ length: 52 }).reduce<GameStateModel>((current) => {
            const move = nextAutoMove(current);

            return move === undefined ? current : applyMove({ state: current, move });
        }, aGameState().asReadyToAutoComplete().build());

        // un-play: random foundation→tableau and tableau→tableau moves keep every card face-up
        const isUnplayMove = (m: Move) =>
            m.kind === MoveKind.FoundationToTableau || m.kind === MoveKind.TableauToTableau;

        fc.assert(
            fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 120 }), (picks) => {
                const scrambled = picks.reduce<GameStateModel>((current, pick) => {
                    const options = listLegalMoves(current).filter(isUnplayMove);
                    const move = options[pick % Math.max(options.length, 1)];

                    return move === undefined ? current : applyMove({ state: current, move });
                }, won);

                const finished = Array.from({ length: 52 }).reduce<GameStateModel>((current) => {
                    const move = nextAutoMove(current);

                    return move === undefined ? current : applyMove({ state: current, move });
                }, scrambled);

                expect(isWon(scrambled) || isAutoCompletable(scrambled)).toBe(true);
                expect(isWon(finished)).toBe(true);
            }),
            { numRuns: 300 },
        );
    });
});
