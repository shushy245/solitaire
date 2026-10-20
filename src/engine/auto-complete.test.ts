import { describe, expect, it } from 'vitest';

import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { dealGame } from './deal.ts';
import { applyMove } from './apply.ts';
import { isWon } from './selectors.ts';
import { DrawMode, GameStateModel, MoveKind, Rank, Suit } from './model.ts';
import { findFoundationTarget, isAutoCompletable, nextAutoMove } from './auto-complete.ts';

const up = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).build();

const allFaceUpTable = (): GameStateModel => aGameState().asReadyToAutoComplete().build();

// Applies nextAutoMove until it offers nothing; 52 cards means at most 52 steps.
const runAutoComplete = (state: GameStateModel) =>
    Array.from({ length: 52 }).reduce<GameStateModel>((current) => {
        const move = nextAutoMove(current);

        return move === undefined ? current : applyMove({ state: current, move });
    }, state);

describe('isAutoCompletable', () => {
    it('is true when stock and waste are empty and every tableau card is face-up', () => {
        expect(isAutoCompletable(allFaceUpTable())).toBe(true);
    });

    it('is false while a tableau card is face-down', () => {
        const hidden = aCard().withRank(Rank.Ace).withSuit(Suit.Clubs).asFaceDown().build();

        expect(
            isAutoCompletable(
                aGameState()
                    .withColumn({ index: 0, cards: [hidden, up({ rank: Rank.King, suit: Suit.Hearts })] })
                    .build(),
            ),
        ).toBe(false);
    });

    it('is false while the stock or waste has cards', () => {
        const stock = [aCard().asFaceDown().build()];

        expect(isAutoCompletable({ ...allFaceUpTable(), stock })).toBe(false);
        expect(isAutoCompletable({ ...allFaceUpTable(), waste: [up({ rank: Rank.Ace, suit: Suit.Clubs })] })).toBe(
            false,
        );
    });

    it('is false for a fresh deal and for an already-won game', () => {
        expect(isAutoCompletable(dealGame({ seed: 3, drawMode: DrawMode.One }))).toBe(false);
        expect(isAutoCompletable(runAutoComplete(allFaceUpTable()))).toBe(false);
    });
});

describe('nextAutoMove', () => {
    it('sends the lowest available card to a foundation', () => {
        expect(nextAutoMove(allFaceUpTable())).toMatchObject({ kind: MoveKind.TableauToFoundation, to: 0 });
    });

    it('finishes the game from an eligible state', () => {
        expect(isWon(runAutoComplete(allFaceUpTable()))).toBe(true);
    });

    it('returns nothing when the state is not eligible', () => {
        expect(nextAutoMove(dealGame({ seed: 3, drawMode: DrawMode.One }))).toBeUndefined();
    });
});

describe('findFoundationTarget', () => {
    it('picks the foundation already holding the suit', () => {
        const state = aGameState()
            .withFoundation({ index: 0, cards: [up({ rank: Rank.Ace, suit: Suit.Clubs })] })
            .withFoundation({ index: 2, cards: [up({ rank: Rank.Ace, suit: Suit.Hearts })] })
            .build();

        expect(findFoundationTarget({ state, card: up({ rank: Rank.Two, suit: Suit.Hearts }) })).toBe(2);
    });

    it('picks the first empty foundation for an Ace', () => {
        const state = aGameState()
            .withFoundation({ index: 0, cards: [up({ rank: Rank.Ace, suit: Suit.Clubs })] })
            .build();

        expect(findFoundationTarget({ state, card: up({ rank: Rank.Ace, suit: Suit.Spades }) })).toBe(1);
    });

    it('finds nothing for a card that cannot go up yet', () => {
        expect(
            findFoundationTarget({ state: aGameState().build(), card: up({ rank: Rank.Three, suit: Suit.Spades }) }),
        ).toBeUndefined();
    });
});
