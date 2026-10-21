import { z } from 'zod';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { dealGame, DrawMode } from '~/engine/index.ts';
import { playRandomly } from '~/testkit/play-randomly.ts';
import { aGameState, aSession } from '~/testkit/builders/index.ts';

import { emptyStats, recordPlayed, recordWin } from '../stats/stats.utils.ts';
import { DealProgress, makeSession, SessionModel } from '../session/session.utils.ts';
import {
    chooseInitialSession,
    parseSavedGame,
    parseSavedStats,
    SavedKind,
    serializeGame,
    serializeStats,
} from './persistence.utils.ts';

const playedSession = (): SessionModel =>
    aSession()
        .withDeal({ seed: 4242, drawMode: DrawMode.Three })
        .afterDraws(3)
        .withElapsedMs(83_250)
        .withDealNumber(3)
        .build();

const savedGameWith = (change: (saved: Record<string, unknown>) => Record<string, unknown>): string => {
    const saved = z.record(z.string(), z.unknown()).parse(JSON.parse(serializeGame(playedSession())));

    return JSON.stringify(change(saved));
};

const reasonOf = (raw: string): string => {
    const result = parseSavedGame(raw);

    if (result.kind !== SavedKind.Corrupt) throw new Error(`persistence test: expected corrupt, got ${result.kind}`);

    return result.reason;
};

describe('saved game', () => {
    it('restores the game, its undo history, the time played, the draw mode and the deal count', () => {
        const session = playedSession();

        expect(parseSavedGame(serializeGame(session))).toEqual({
            kind: SavedKind.Found,
            value: {
                game: session.game,
                history: session.history,
                elapsedMs: 83_250,
                dealNumber: 3,
                progress: DealProgress.Started,
            },
        });
    });

    it('is missing when nothing was saved', () => {
        expect(parseSavedGame(undefined)).toEqual({ kind: SavedKind.Missing });
    });

    it('is corrupt when it is not JSON', () => {
        expect(reasonOf('{"version":1,')).toMatch(/JSON/);
    });

    it('is corrupt when a field is missing or has the wrong type', () => {
        expect(reasonOf(savedGameWith(({ elapsedMs: _, ...rest }) => rest))).toMatch(/elapsedMs/);
        expect(reasonOf(savedGameWith((saved) => ({ ...saved, dealNumber: 'three' })))).toMatch(/dealNumber/);
    });

    it('is corrupt when it was saved by another version', () => {
        expect(reasonOf(savedGameWith((saved) => ({ ...saved, version: 0 })))).toMatch(/version/);
    });

    it('is corrupt when a game does not hold the 52 cards exactly once', () => {
        const deal = dealGame({ seed: 1, drawMode: DrawMode.One });
        const [, ...rest] = deal.stock;
        const duplicated = { ...deal, stock: [...rest, ...rest.slice(0, 1)] };
        const missingOne = { ...deal, stock: rest };
        const withGame = (game: typeof deal) =>
            serializeGame({ ...makeSession({ seed: 1, drawMode: DrawMode.One }), game });

        expect(reasonOf(withGame(duplicated))).toMatch(/52 cards/);
        expect(reasonOf(withGame(missingOne))).toMatch(/52 cards/);
    });

    it('is corrupt when a foundation is not built up from the Ace in one suit (it would fake a win)', () => {
        const won = aGameState().asWon().build();
        const [hearts = [], spades = [], ...rest] = won.foundations;
        const swapKings = [
            [...hearts.slice(0, -1), ...spades.slice(-1)],
            [...spades.slice(0, -1), ...hearts.slice(-1)],
            ...rest,
        ];
        const mixed = { ...won, foundations: swapKings };

        expect(reasonOf(serializeGame({ ...makeSession({ seed: 1, drawMode: DrawMode.One }), game: mixed }))).toMatch(
            /foundation/,
        );
    });

    it('is corrupt when more waste cards are fanned out than the waste holds or a draw turns', () => {
        const session = playedSession();
        const overFanned = { ...session, game: { ...session.game, wasteFan: session.game.waste.length + 1 } };

        expect(reasonOf(serializeGame(overFanned))).toMatch(/fan/);
    });

    it('is corrupt when its undo history belongs to another deal', () => {
        const session = playedSession();
        const otherDeal = dealGame({ seed: session.game.seed + 1, drawMode: session.game.drawMode });

        expect(reasonOf(serializeGame({ ...session, history: [otherDeal, ...session.history] }))).toMatch(/history/);
    });

    it('is corrupt when a tableau column holds what no game could produce, so it is never drawn', () => {
        const deal = dealGame({ seed: 1, drawMode: DrawMode.One });
        const withColumns = (tableau: typeof deal.tableau) =>
            serializeGame({ ...makeSession({ seed: 1, drawMode: DrawMode.One }), game: { ...deal, tableau } });
        const [first = [], second = [], ...rest] = deal.tableau;
        const [secondHidden, secondShown] = second;
        const hiddenOnTop = secondHidden === undefined || secondShown === undefined ? [] : [secondShown, secondHidden];
        // the first column is dealt one face-up card and never holds a hidden one
        const tooManyHidden = [...second.map((card) => ({ ...card, faceUp: false })), ...first];
        const notARun = [...first, ...second.filter((card) => card.faceUp)];

        expect(reasonOf(withColumns([first, hiddenOnTop, ...rest]))).toMatch(/tableau/);
        expect(reasonOf(withColumns([tooManyHidden, [], ...rest]))).toMatch(/tableau/);
        expect(reasonOf(withColumns([notARun, second.filter((card) => !card.faceUp), ...rest]))).toMatch(/tableau/);
    });

    it('accepts every position real play reaches, so a real game is never thrown away', () => {
        fc.assert(
            fc.property(
                fc.record({
                    seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
                    drawMode: fc.constantFrom(DrawMode.One, DrawMode.Three),
                    picks: fc.array(fc.nat(), { minLength: 1, maxLength: 150 }),
                }),
                ({ seed, drawMode, picks }) => {
                    const { states } = playRandomly({ start: dealGame({ seed, drawMode }), picks });
                    const last = states[states.length - 1] ?? dealGame({ seed, drawMode });
                    const session = { ...makeSession({ seed, drawMode }), game: last, history: states.slice(0, -1) };

                    expect(parseSavedGame(serializeGame(session)).kind).toBe(SavedKind.Found);
                },
            ),
            { numRuns: 60 },
        );
    });

    it('is corrupt when a card is not a real card', () => {
        const raw = serializeGame(playedSession()).replace('"spades-13:', '"spades-14:');

        expect(parseSavedGame(raw).kind).toBe(SavedKind.Corrupt);
    });
});

describe('saved stats', () => {
    it('restores played, won and both bests', () => {
        const stats = recordWin({ stats: recordPlayed(recordPlayed(emptyStats)), timeMs: 61_000, score: 512 });

        expect(parseSavedStats(serializeStats(stats))).toEqual({ kind: SavedKind.Found, value: stats });
    });

    it('restores a record with no win yet', () => {
        expect(parseSavedStats(serializeStats(recordPlayed(emptyStats)))).toEqual({
            kind: SavedKind.Found,
            value: recordPlayed(emptyStats),
        });
    });

    it('is corrupt when it claims more wins than games played', () => {
        const raw = serializeStats(recordWin({ stats: emptyStats, timeMs: 1, score: 1 }));

        expect(parseSavedStats(raw).kind).toBe(SavedKind.Corrupt);
    });

    it('is missing when nothing was saved', () => {
        expect(parseSavedStats(undefined)).toEqual({ kind: SavedKind.Missing });
    });
});

describe('chooseInitialSession', () => {
    const stats = recordPlayed(emptyStats);
    const freshSeed = (): number => 99;

    it('resumes the saved game with the saved record', () => {
        const session = playedSession();
        const saved = { ...session, progress: DealProgress.Started };

        const initial = chooseInitialSession({ savedGame: saved, stats, requestedDeal: undefined, freshSeed });

        expect(initial.game).toEqual(session.game);
        expect(initial.history).toEqual(session.history);
        expect(initial.elapsedMs).toBe(83_250);
        expect(initial.stats).toEqual(stats);
    });

    it('deals a fresh random game with the saved record when there is no saved game', () => {
        const initial = chooseInitialSession({ savedGame: undefined, stats, requestedDeal: undefined, freshSeed });

        expect(initial.game).toEqual(dealGame({ seed: 99, drawMode: DrawMode.One }));
        expect(initial.stats).toEqual(stats);
    });

    it('deals the requested deal, in its draw mode, instead of resuming, keeping the record', () => {
        const initial = chooseInitialSession({
            savedGame: playedSession(),
            stats,
            requestedDeal: { seed: 7, drawMode: DrawMode.Three },
            freshSeed,
        });

        expect(initial.game).toEqual(dealGame({ seed: 7, drawMode: DrawMode.Three }));
        expect(initial.history).toEqual([]);
        expect(initial.stats).toEqual(stats);
    });
});
