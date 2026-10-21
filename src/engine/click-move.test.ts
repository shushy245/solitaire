import { describe, expect, it } from 'vitest';

import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { findClickMove } from './click-move.ts';
import { MoveKind, Rank, Suit } from './model.ts';

const up = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).build();
const down = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).asFaceDown().build();

const aceOfHearts = up({ rank: Rank.Ace, suit: Suit.Hearts });
const twoOfHearts = up({ rank: Rank.Two, suit: Suit.Hearts });
const blackNine = up({ rank: Rank.Nine, suit: Suit.Spades });
const redEight = up({ rank: Rank.Eight, suit: Suit.Diamonds });
const redTen = up({ rank: Rank.Ten, suit: Suit.Hearts });
const kingOfClubs = up({ rank: Rank.King, suit: Suit.Clubs });
const hidden = down({ rank: Rank.Four, suit: Suit.Clubs });

describe('findClickMove', () => {
    it('sends a card that fits a foundation up (2♥ onto A♥)', () => {
        const state = aGameState()
            .withFoundation({ index: 2, cards: [aceOfHearts] })
            .withColumn({ index: 0, cards: [hidden, twoOfHearts] })
            .withColumn({ index: 1, cards: [up({ rank: Rank.Three, suit: Suit.Spades })] })
            .build();

        expect(findClickMove({ state, cardId: twoOfHearts.id })).toEqual({
            kind: MoveKind.TableauToFoundation,
            cardId: twoOfHearts.id,
            from: 0,
            to: 2,
        });
    });

    it('sends an Ace from the waste to an empty foundation', () => {
        const state = aGameState().withWaste([aceOfHearts]).build();

        expect(findClickMove({ state, cardId: aceOfHearts.id })).toMatchObject({ kind: MoveKind.WasteToFoundation });
    });

    it('otherwise moves the card and the run above it to the first column that takes it', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [hidden, blackNine, redEight] })
            .withColumn({ index: 2, cards: [up({ rank: Rank.Ten, suit: Suit.Clubs })] })
            .withColumn({ index: 4, cards: [redTen] })
            .withColumn({ index: 5, cards: [up({ rank: Rank.Ten, suit: Suit.Diamonds })] })
            .build();

        expect(findClickMove({ state, cardId: blackNine.id })).toEqual({
            kind: MoveKind.TableauToTableau,
            cardId: blackNine.id,
            from: 0,
            to: 4,
        });
    });

    it('prefers a column with cards over an empty one', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [hidden, blackNine] })
            .withColumn({ index: 6, cards: [redTen] })
            .build();

        expect(findClickMove({ state, cardId: blackNine.id })).toMatchObject({ to: 6 });
    });

    it('moves a King to an empty column when that uncovers a card', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [up({ rank: Rank.Two, suit: Suit.Clubs })] })
            .withColumn({ index: 3, cards: [hidden, kingOfClubs] })
            .build();

        expect(findClickMove({ state, cardId: kingOfClubs.id })).toMatchObject({
            kind: MoveKind.TableauToTableau,
            from: 3,
        });
    });

    it('does not move a King that already heads its column to another empty column', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [kingOfClubs] })
            .withColumn({ index: 1, cards: [up({ rank: Rank.Two, suit: Suit.Clubs })] })
            .build();

        expect(findClickMove({ state, cardId: kingOfClubs.id })).toBeUndefined();
    });

    it('never takes a card back down from a foundation', () => {
        const state = aGameState()
            .withFoundation({ index: 0, cards: [aceOfHearts, twoOfHearts] })
            .withColumn({ index: 0, cards: [up({ rank: Rank.Three, suit: Suit.Spades })] })
            .build();

        expect(findClickMove({ state, cardId: twoOfHearts.id })).toBeUndefined();
    });

    it('finds nothing for a card with no legal move, a face-down card or a stock card', () => {
        const stockCard = down({ rank: Rank.Five, suit: Suit.Hearts });
        const state = aGameState()
            .withColumn({ index: 0, cards: [hidden, blackNine] })
            .withColumn({ index: 1, cards: [up({ rank: Rank.Ten, suit: Suit.Clubs })] })
            .withStock([stockCard])
            .build();

        expect(findClickMove({ state, cardId: blackNine.id })).toBeUndefined();
        expect(findClickMove({ state, cardId: hidden.id })).toBeUndefined();
        expect(findClickMove({ state, cardId: stockCard.id })).toBeUndefined();
    });
});
