import { describe, expect, it } from 'vitest';

import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { nextSafeMove } from './safe-move.ts';
import { MoveKind, Rank, Suit } from './model.ts';

const up = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).build();

const suitUpTo = ({ suit, rank }: { suit: Suit; rank: Rank }) =>
    Array.from({ length: rank }, (_, index) => up({ rank: index + 1, suit }));

const none: ReadonlySet<string> = new Set();

const hidden = aCard().withRank(Rank.King).withSuit(Suit.Clubs).asFaceDown().build();

describe('nextSafeMove', () => {
    it('sends an Ace home from a column', () => {
        const ace = up({ rank: Rank.Ace, suit: Suit.Hearts });
        const state = aGameState()
            .withColumn({ index: 2, cards: [hidden, ace] })
            .build();

        expect(nextSafeMove({ state, keptOnTable: none })).toEqual({
            kind: MoveKind.TableauToFoundation,
            cardId: ace.id,
            from: 2,
            to: 0,
        });
    });

    it('sends a Two home once its Ace is there, from the waste', () => {
        const two = up({ rank: Rank.Two, suit: Suit.Spades });
        const state = aGameState()
            .withFoundation({ index: 1, cards: suitUpTo({ suit: Suit.Spades, rank: Rank.Ace }) })
            .withWaste([two])
            .build();

        expect(nextSafeMove({ state, keptOnTable: none })).toEqual({
            kind: MoveKind.WasteToFoundation,
            cardId: two.id,
            to: 1,
        });
    });

    it('sends a card home only when both opposite-colour cards one rank lower are already home', () => {
        const threeOfHearts = up({ rank: Rank.Three, suit: Suit.Hearts });
        const heartsToTwo = suitUpTo({ suit: Suit.Hearts, rank: Rank.Two });
        const onlyClubs = aGameState()
            .withFoundation({ index: 0, cards: heartsToTwo })
            .withFoundation({ index: 1, cards: suitUpTo({ suit: Suit.Clubs, rank: Rank.Two }) })
            .withColumn({ index: 0, cards: [hidden, threeOfHearts] })
            .build();
        const bothBlacks = aGameState()
            .withFoundation({ index: 0, cards: heartsToTwo })
            .withFoundation({ index: 1, cards: suitUpTo({ suit: Suit.Clubs, rank: Rank.Two }) })
            .withFoundation({ index: 2, cards: suitUpTo({ suit: Suit.Spades, rank: Rank.Two }) })
            .withColumn({ index: 0, cards: [hidden, threeOfHearts] })
            .build();

        expect(nextSafeMove({ state: onlyClubs, keptOnTable: none })).toBeUndefined();
        expect(nextSafeMove({ state: bothBlacks, keptOnTable: none })).toEqual({
            kind: MoveKind.TableauToFoundation,
            cardId: threeOfHearts.id,
            from: 0,
            to: 0,
        });
    });

    it('moves only top cards, and never a card that is already home', () => {
        const buriedAce = up({ rank: Rank.Ace, suit: Suit.Diamonds });
        const state = aGameState()
            .withFoundation({ index: 0, cards: suitUpTo({ suit: Suit.Clubs, rank: Rank.Ace }) })
            .withColumn({ index: 0, cards: [buriedAce, up({ rank: Rank.King, suit: Suit.Spades })] })
            .withWaste([up({ rank: Rank.Nine, suit: Suit.Hearts })])
            .build();

        expect(nextSafeMove({ state, keptOnTable: none })).toBeUndefined();
    });

    it('never sends back a card the player took down off a foundation', () => {
        const ace = up({ rank: Rank.Ace, suit: Suit.Hearts });
        const state = aGameState()
            .withColumn({ index: 2, cards: [hidden, ace] })
            .build();

        expect(nextSafeMove({ state, keptOnTable: new Set([ace.id]) })).toBeUndefined();
    });

    it('finds nothing in a won game', () => {
        expect(nextSafeMove({ state: aGameState().asWon().build(), keptOnTable: none })).toBeUndefined();
    });
});
