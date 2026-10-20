import { describe, expect, it } from 'vitest';

import { seedFromSearch } from './seed-source.utils.ts';

describe('seedFromSearch', () => {
    it('reads a whole-number seed from the URL', () => {
        expect(seedFromSearch('?seed=42')).toBe(42);
    });

    it('ignores a missing, negative, fractional, oversized or non-numeric seed', () => {
        const rejected = [
            '',
            '?seed=',
            '?seed=-1',
            '?seed=1.5',
            '?seed=4294967296',
            '?seed=abc',
            '?seed=%20',
            '?seed=0x10',
            '?seed=1e3',
        ];

        expect(rejected.map(seedFromSearch).filter((seed) => seed !== undefined)).toEqual([]);
    });
});
