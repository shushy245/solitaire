import { describe, expect, it } from 'vitest';

import { makeSeedSource, seedFromSearch } from './seed-source.utils.ts';

describe('seedFromSearch', () => {
    it('reads a whole-number seed from the URL', () => {
        expect(seedFromSearch('?seed=42')).toBe(42);
    });

    it('ignores a missing, negative, fractional, oversized or non-numeric seed', () => {
        expect(['', '?seed=', '?seed=-1', '?seed=1.5', '?seed=4294967296', '?seed=abc'].map(seedFromSearch)).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    });
});

describe('makeSeedSource', () => {
    it('deals the requested seed first, then fresh random seeds', () => {
        const randoms = [7, 8];
        const next = makeSeedSource({ firstSeed: 42, generateSeed: () => randoms.shift() ?? 0 });

        expect([next(), next(), next()]).toEqual([42, 7, 8]);
    });

    it('is purely random when no seed was requested', () => {
        const next = makeSeedSource({ firstSeed: undefined, generateSeed: () => 5 });

        expect([next(), next()]).toEqual([5, 5]);
    });
});
