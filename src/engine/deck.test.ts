import { describe, expect, it } from 'vitest';

import { Rank, Suit } from './model.ts';
import { createDeck, shuffle } from './deck.ts';

describe('createDeck', () => {
    it('holds 52 distinct face-down cards, 13 of each suit', () => {
        const deck = createDeck();

        expect(new Set(deck.map((c) => c.id)).size).toBe(52);
        expect(deck.every((c) => !c.faceUp)).toBe(true);
        expect(Object.values(Suit).map((suit) => deck.filter((c) => c.suit === suit).length)).toEqual([13, 13, 13, 13]);
    });

    it('names each card by suit and rank', () => {
        expect(createDeck().map((c) => c.id)).toContain(`${Suit.Hearts}-${Rank.Queen}`);
    });
});

describe('shuffle', () => {
    const items = Array.from({ length: 52 }, (_, i) => i);

    it('is deterministic per seed', () => {
        expect(shuffle({ items, seed: 123 })).toEqual(shuffle({ items, seed: 123 }));
    });

    it('differs across seeds', () => {
        expect(shuffle({ items, seed: 1 })).not.toEqual(shuffle({ items, seed: 2 }));
    });

    it('is a permutation — nothing lost, nothing duplicated', () => {
        expect([...shuffle({ items, seed: 9 })].sort((a, b) => a - b)).toEqual(items);
    });

    it('does not mutate its input', () => {
        const input = [1, 2, 3, 4, 5];
        shuffle({ items: input, seed: 5 });

        expect(input).toEqual([1, 2, 3, 4, 5]);
    });

    it('puts every item first roughly equally often across many seeds', () => {
        const small = [0, 1, 2, 3];
        const trials = 8000;
        const counts = Array.from({ length: trials }, (_, seed) => shuffle({ items: small, seed })[0]).reduce<
            Record<number, number>
        >((acc, first) => (first === undefined ? acc : { ...acc, [first]: (acc[first] ?? 0) + 1 }), {});

        // expected 2000 each; ±10% is > 9 standard deviations of slack for a fair shuffle
        expect(small.every((v) => Math.abs((counts[v] ?? 0) - trials / small.length) < 200)).toBe(true);
    });
});
