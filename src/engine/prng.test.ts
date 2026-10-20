import { describe, expect, it } from 'vitest';

import { randomSequence } from '~/testkit/random-sequence.ts';

import { nextRandom } from './prng.ts';

describe('prng', () => {
    it('yields the same sequence for the same seed', () => {
        expect(randomSequence({ seed: 42, length: 5 })).toEqual(randomSequence({ seed: 42, length: 5 }));
    });

    it('yields different sequences for different seeds', () => {
        expect(randomSequence({ seed: 1, length: 5 })).not.toEqual(randomSequence({ seed: 2, length: 5 }));
    });

    it('yields values in [0, 1)', () => {
        const values = randomSequence({ seed: 7, length: 1000 });

        expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    });

    it('returns the next seed so the caller can continue the sequence', () => {
        const first = nextRandom(99);
        const second = nextRandom(first.seed);

        expect(randomSequence({ seed: 99, length: 2 })).toEqual([first.value, second.value]);
    });
});
