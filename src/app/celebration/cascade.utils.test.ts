import { describe, expect, it } from 'vitest';

import { aGameState } from '~/testkit/builders/index.ts';

import {
    BOUNCE_DAMPING,
    BoundsModel,
    FlyingCardModel,
    hasLeftScreen,
    isCascadeOver,
    LAUNCH_INTERVAL_MS,
    launchCard,
    launchOrder,
    makeCascade,
    MAX_FRAME_MS,
    stepCard,
    stepCascade,
} from './cascade.utils.ts';

const bounds: BoundsModel = { width: 800, height: 600, cardWidth: 80, cardHeight: 112 };
const floor = bounds.height - bounds.cardHeight;
const resting: FlyingCardModel = { cardId: 'hearts-13', x: 300, y: 100, vx: 0.2, vy: 0 };

describe('stepCard', () => {
    it('falls faster under gravity while drifting sideways', () => {
        const once = stepCard({ card: resting, dtMs: 16, bounds });
        const twice = stepCard({ card: once, dtMs: 16, bounds });

        expect(once.vy).toBeGreaterThan(0);
        expect(twice.y - once.y).toBeGreaterThan(once.y - resting.y);
        expect(twice.x).toBeCloseTo(resting.x + 0.2 * 32);
    });

    it('bounces off the floor, losing some of its speed', () => {
        const landing = { ...resting, y: floor - 1, vy: 1 };

        const bounced = stepCard({ card: landing, dtMs: 16, bounds });

        expect(bounced.y).toBeLessThanOrEqual(floor);
        expect(bounced.vy).toBeLessThan(0);
        expect(Math.abs(bounced.vy)).toBeLessThan(1);
        expect(Math.abs(bounced.vy)).toBeGreaterThan(BOUNCE_DAMPING * 0.9);
    });
});

describe('hasLeftScreen', () => {
    it('is done once the card is wholly past either side, never before', () => {
        expect(hasLeftScreen({ card: { ...resting, x: bounds.width + 1 }, bounds })).toBe(true);
        expect(hasLeftScreen({ card: { ...resting, x: -bounds.cardWidth - 1 }, bounds })).toBe(true);
        expect(hasLeftScreen({ card: { ...resting, x: bounds.width - 10 }, bounds })).toBe(false);
        expect(hasLeftScreen({ card: { ...resting, x: -bounds.cardWidth + 10 }, bounds })).toBe(false);
    });
});

describe('launchCard', () => {
    it('throws the card sideways from where it sits, the same way for the same seed', () => {
        const from = { x: 500, y: 20 };

        const first = launchCard({ launch: { cardId: 'spades-13', from }, seed: 9 });
        const again = launchCard({ launch: { cardId: 'spades-13', from }, seed: 9 });

        expect(first.card).toMatchObject({ cardId: 'spades-13', x: 500, y: 20 });
        expect(Math.abs(first.card.vx)).toBeGreaterThan(0);
        expect(first.card.vy).toBeLessThanOrEqual(0);
        expect(again).toEqual(first);
    });
});

describe('launchOrder', () => {
    it('takes the Kings off all four foundations first, then the Queens, down to the Aces', () => {
        const order = launchOrder(aGameState().asWon().build().foundations);

        expect(order).toHaveLength(52);
        expect(order.slice(0, 4)).toEqual(['hearts-13', 'spades-13', 'diamonds-13', 'clubs-13']);
        expect(order.slice(4, 8)).toEqual(['hearts-12', 'spades-12', 'diamonds-12', 'clubs-12']);
        expect(order.slice(-1)).toEqual(['clubs-1']);
    });
});

describe('stepCascade', () => {
    const launches = [
        { cardId: 'hearts-13', from: { x: 400, y: 10 } },
        { cardId: 'spades-13', from: { x: 500, y: 10 } },
    ];

    it('launches the first card straight away and the next after the launch interval', () => {
        const first = stepCascade({ cascade: makeCascade({ launches, seed: 3 }), dtMs: 16, bounds });
        const later = stepCascade({ cascade: first, dtMs: LAUNCH_INTERVAL_MS, bounds });

        expect(first.flying.map((card) => card.cardId)).toEqual(['hearts-13']);
        expect(later.flying.map((card) => card.cardId)).toEqual(['hearts-13', 'spades-13']);
        expect(later.waiting).toEqual([]);
    });

    it('lets a card go once it has left the screen, and ends when every card has', () => {
        const gone = { ...makeCascade({ launches: [], seed: 3 }), flying: [{ ...resting, x: bounds.width + 50 }] };

        const next = stepCascade({ cascade: gone, dtMs: 16, bounds });

        expect(next.flying).toEqual([]);
        expect(isCascadeOver(next)).toBe(true);
        expect(isCascadeOver(makeCascade({ launches, seed: 3 }))).toBe(false);
    });

    it('treats a long pause between frames (a background tab) as one short frame', () => {
        const flying = { ...makeCascade({ launches: [], seed: 3 }), flying: [resting] };

        const afterPause = stepCascade({ cascade: flying, dtMs: 5_000, bounds });
        const afterFrame = stepCascade({ cascade: flying, dtMs: MAX_FRAME_MS, bounds });

        expect(afterPause.flying).toEqual(afterFrame.flying);
    });
});
