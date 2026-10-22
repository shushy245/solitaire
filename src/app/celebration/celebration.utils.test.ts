import { describe, expect, it } from 'vitest';

import { aGameState } from '~/testkit/builders/index.ts';

import { cornerRatioOf, LaunchPlanKind, planLaunches, RectModel, winSummary } from './celebration.utils.ts';

// Foundations side by side on one row, 100px apart, 90px from the top of the window.
const foundationRects: readonly RectModel[] = [300, 400, 500, 600].map((left) => ({
    left,
    top: 90,
    width: 80,
    height: 112,
}));
const foundationRect = (index: number): RectModel | undefined => foundationRects[index];

describe('planLaunches', () => {
    it('launches every card from its own foundation’s place, Kings first, sized like a foundation', () => {
        const plan = planLaunches({ game: aGameState().asWon().build(), foundationRect });

        if (plan.kind !== LaunchPlanKind.Ready) throw new Error('planLaunches test: expected a ready plan');

        expect(plan.launches).toHaveLength(52);
        expect(plan.launches.slice(0, 2)).toEqual([
            { cardId: 'hearts-13', from: { x: 300, y: 90 } },
            { cardId: 'spades-13', from: { x: 400, y: 90 } },
        ]);
        expect(plan.cardSize).toEqual({ width: 80, height: 112 });
        expect(plan.paintTop).toBe(90);
    });

    it('has nothing to launch when no foundation is on screen', () => {
        const plan = planLaunches({ game: aGameState().asWon().build(), foundationRect: () => undefined });

        expect(plan).toEqual({ kind: LaunchPlanKind.Nothing });
    });
});

describe('winSummary', () => {
    it('gives the time played and the score', () => {
        expect(winSummary({ elapsedMs: 245_000, score: 700 })).toBe('4:05 · 700 points');
    });
});

describe('cornerRatioOf', () => {
    it('is the rendered card’s corner radius as a share of its width', () => {
        expect(cornerRatioOf({ radius: '10.4px', width: 104 })).toBeCloseTo(0.1);
    });

    it('is a square corner when the card could not be measured', () => {
        expect(cornerRatioOf({ radius: '', width: 104 })).toBe(0);
        expect(cornerRatioOf({ radius: '10px', width: 0 })).toBe(0);
    });
});
