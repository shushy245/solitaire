import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { playRandomly } from '~/testkit/play-randomly.ts';
import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { dealGame } from './deal.ts';
import { isStuck } from './stuck.ts';
import { listLegalMoves } from './rules.ts';
import { isRevealingMove } from './click-move.ts';
import { DrawMode, GameStateModel, Move, MoveKind, Rank, Suit } from './model.ts';

const up = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).build();
const down = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).asFaceDown().build();

describe('isStuck', () => {
    it('is not stuck once the game is won', () => {
        expect(isStuck(aGameState().asWon().build())).toBe(false);
    });

    it('is stuck when the deck is spent and no table move is left', () => {
        const state = aGameState()
            .withColumn({
                index: 0,
                cards: [down({ rank: Rank.Two, suit: Suit.Hearts }), up({ rank: Rank.Five, suit: Suit.Spades })],
            })
            .build();

        expect(isStuck(state)).toBe(true);
    });
});

describe('isStuck — progress on the table', () => {
    const hidden = down({ rank: Rank.Two, suit: Suit.Clubs });

    it('is not stuck while a column move would turn a card over', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [hidden, up({ rank: Rank.Nine, suit: Suit.Spades })] })
            .withColumn({ index: 1, cards: [up({ rank: Rank.Ten, suit: Suit.Hearts })] })
            .build();

        expect(isStuck(state)).toBe(false);
    });

    it('is not stuck while a card can go home', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [up({ rank: Rank.Ace, suit: Suit.Clubs })] })
            .build();

        expect(isStuck(state)).toBe(false);
    });

    it('is not stuck when splitting a run frees a card for its foundation', () => {
        const spadesToSeven = [Rank.Ace, Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven].map((rank) =>
            up({ rank, suit: Suit.Spades }),
        );
        const state = aGameState()
            .withFoundation({ index: 0, cards: spadesToSeven })
            .withColumn({
                index: 0,
                cards: [
                    hidden,
                    up({ rank: Rank.Eight, suit: Suit.Spades }),
                    up({ rank: Rank.Seven, suit: Suit.Hearts }),
                ],
            })
            .withColumn({ index: 1, cards: [up({ rank: Rank.Eight, suit: Suit.Clubs })] })
            .build();

        expect(isStuck(state)).toBe(false);
    });

    it('is stuck when the only moves shift a run to an equal place or take a card off a foundation and back', () => {
        const state = aGameState()
            .withFoundation({ index: 0, cards: [up({ rank: Rank.Ace, suit: Suit.Hearts })] })
            .withColumn({
                index: 0,
                cards: [
                    hidden,
                    up({ rank: Rank.Eight, suit: Suit.Spades }),
                    up({ rank: Rank.Seven, suit: Suit.Hearts }),
                ],
            })
            .withColumn({
                index: 1,
                cards: [down({ rank: Rank.Three, suit: Suit.Clubs }), up({ rank: Rank.Eight, suit: Suit.Clubs })],
            })
            .withColumn({
                index: 2,
                cards: [down({ rank: Rank.Four, suit: Suit.Clubs }), up({ rank: Rank.Two, suit: Suit.Spades })],
            })
            .build();

        expect(isStuck(state)).toBe(true);
    });
});

describe('isStuck — cycling the deck', () => {
    const aceOfClubs = down({ rank: Rank.Ace, suit: Suit.Clubs });
    const fillers = [Rank.Nine, Rank.Ten].map((rank) => down({ rank, suit: Suit.Diamonds }));
    const blockedTable = () =>
        aGameState().withColumn({
            index: 0,
            cards: [down({ rank: Rank.Two, suit: Suit.Hearts }), up({ rank: Rank.Five, suit: Suit.Spades })],
        });

    it('is not stuck when a card further round the deck would play, though the waste top cannot', () => {
        const state = blockedTable()
            .withStock([aceOfClubs])
            .withWaste([up({ rank: Rank.Nine, suit: Suit.Hearts })])
            .build();

        expect(isStuck(state)).toBe(false);
    });

    it('turn 3: is stuck when the playable card is always buried inside a draw of three', () => {
        // the stock's top card is drawn first, so it lies under the other two every time round
        const state = blockedTable()
            .withDrawMode(DrawMode.Three)
            .withStock([...fillers, aceOfClubs])
            .build();

        expect(isStuck(state)).toBe(true);
    });

    it('turn 3: is not stuck when a draw of three leaves the playable card on top', () => {
        const state = blockedTable()
            .withDrawMode(DrawMode.Three)
            .withStock([aceOfClubs, ...fillers])
            .build();

        expect(isStuck(state)).toBe(false);
    });
});

const progressKinds: ReadonlySet<MoveKind> = new Set([
    MoveKind.WasteToTableau,
    MoveKind.WasteToFoundation,
    MoveKind.TableauToFoundation,
]);

// A move that by itself turns a card over, sends a card home or plays the waste.
const isProgressMove = ({ state, move }: { state: GameStateModel; move: Move }): boolean =>
    progressKinds.has(move.kind) || isRevealingMove({ state, move });

describe('isStuck over random games', () => {
    it('never calls a position stuck while a move would turn a card over, send a card home or play the waste', () => {
        fc.assert(
            fc.property(
                fc.record({
                    seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
                    drawMode: fc.constantFrom(DrawMode.One, DrawMode.Three),
                    picks: fc.array(fc.nat(), { minLength: 1, maxLength: 200 }),
                }),
                ({ seed, drawMode, picks }) => {
                    const { states } = playRandomly({ start: dealGame({ seed, drawMode }), picks });

                    states
                        .filter((state) => isStuck(state))
                        .forEach((state) => {
                            expect(listLegalMoves(state).filter((move) => isProgressMove({ state, move }))).toEqual([]);
                        });
                },
            ),
            { numRuns: 60 },
        );
    });
});
