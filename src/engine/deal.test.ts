import { describe, expect, it } from 'vitest';

import { at } from '~/testkit/at.ts';

import { dealGame } from './deal.ts';
import { DrawMode } from './model.ts';

describe('dealGame', () => {
    const game = dealGame({ seed: 2026, drawMode: DrawMode.Three });

    it('deals 7 tableau columns holding 1..7 cards', () => {
        expect(game.tableau.map((column) => column.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('turns only the top card of each column face-up', () => {
        expect(game.tableau.map((column) => column.map((c) => c.faceUp))).toEqual(
            game.tableau.map((column) => column.map((_, i) => i === column.length - 1)),
        );
    });

    it('leaves the other 24 cards face-down in the stock', () => {
        expect(game.stock).toHaveLength(24);
        expect(game.stock.every((c) => !c.faceUp)).toBe(true);
    });

    it('starts with empty waste and foundations and a zeroed score, move count and recycle count', () => {
        expect(game.waste).toEqual([]);
        expect(game.wasteFan).toBe(0);
        expect(game.foundations).toEqual([[], [], [], []]);
        expect([game.score, game.moves, game.recycles]).toEqual([0, 0, 0]);
    });

    it('records the seed and draw mode it was dealt with', () => {
        expect([game.seed, game.drawMode]).toEqual([2026, DrawMode.Three]);
    });

    it('deals the same game for the same seed and a different one for another seed', () => {
        expect(dealGame({ seed: 2026, drawMode: DrawMode.One }).tableau).toEqual(game.tableau);
        expect(at(dealGame({ seed: 2027, drawMode: DrawMode.Three }).tableau, 6)).not.toEqual(at(game.tableau, 6));
    });

    it('uses all 52 cards exactly once', () => {
        const ids = [...game.stock, ...game.tableau.flat()].map((c) => c.id);

        expect(new Set(ids).size).toBe(52);
    });
});
