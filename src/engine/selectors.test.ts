import { describe, expect, it } from 'vitest';

import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { isWon } from './selectors.ts';
import { Rank, Suit } from './model.ts';

const fullSuit = (suit: Suit) =>
    Array.from({ length: 13 }, (_, i) =>
        aCard()
            .withSuit(suit)
            .withRank(Rank.Ace + i)
            .build(),
    );

describe('isWon', () => {
    it('is true exactly when all four foundations hold 13 cards', () => {
        const won = Object.values(Suit).reduce(
            (builder, suit, index) => builder.withFoundation({ index, cards: fullSuit(suit) }),
            aGameState(),
        );

        expect(isWon(won.build())).toBe(true);
        expect(isWon(won.withFoundation({ index: 3, cards: fullSuit(Suit.Spades).slice(0, 12) }).build())).toBe(false);
    });

    it('is false for an empty table', () => {
        expect(isWon(aGameState().build())).toBe(false);
    });
});
