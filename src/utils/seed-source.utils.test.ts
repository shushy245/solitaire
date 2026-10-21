import { describe, expect, it } from 'vitest';

import { DrawMode } from '~/engine/index.ts';

import { dealFromSearch, drawModeFromSearch, searchWithoutSeed, seedFromSearch } from './seed-source.utils.ts';

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

describe('drawModeFromSearch', () => {
    it('asks for turn 3 with draw=3, and turn 1 otherwise', () => {
        expect(drawModeFromSearch('?seed=4&draw=3')).toBe(DrawMode.Three);
        expect(drawModeFromSearch('?seed=4&draw=1')).toBe(DrawMode.One);
        expect(drawModeFromSearch('?seed=4&draw=three')).toBe(DrawMode.One);
        expect(drawModeFromSearch('?seed=4')).toBe(DrawMode.One);
    });
});

describe('dealFromSearch', () => {
    it('names the seed and draw mode the address asks for, or nothing without a seed', () => {
        expect(dealFromSearch('?seed=9&draw=3')).toEqual({ seed: 9, drawMode: DrawMode.Three });
        expect(dealFromSearch('?draw=3')).toBe(undefined);
    });
});

describe('searchWithoutSeed', () => {
    it('drops the seed and the draw and keeps every other parameter', () => {
        expect(searchWithoutSeed('?seed=42')).toBe('');
        expect(searchWithoutSeed('?debug=1&seed=42&draw=3&x=y')).toBe('?debug=1&x=y');
    });
});
