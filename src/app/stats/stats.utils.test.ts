import { describe, expect, it } from 'vitest';

import { emptyStats, recordPlayed, recordWin, winPercent } from './stats.utils.ts';

describe('stats', () => {
    it('starts with nothing played, nothing won and no bests', () => {
        expect(emptyStats).toEqual({ played: 0, won: 0, best: undefined });
    });

    it('counts a played game', () => {
        expect(recordPlayed(emptyStats).played).toBe(1);
    });

    it('the first win sets both bests', () => {
        const stats = recordWin({ stats: recordPlayed(emptyStats), timeMs: 90_000, score: 400 });

        expect(stats).toEqual({ played: 1, won: 1, best: { timeMs: 90_000, score: 400 } });
    });

    it('a later win keeps the faster time and the higher score, even from different games', () => {
        const first = recordWin({ stats: emptyStats, timeMs: 90_000, score: 400 });

        const second = recordWin({ stats: first, timeMs: 120_000, score: 650 });

        expect(second.won).toBe(2);
        expect(second.best).toEqual({ timeMs: 90_000, score: 650 });
    });

    it('win % rounds to a whole number and is 0 before any game is played', () => {
        const oneOfThree = recordWin({
            stats: recordPlayed(recordPlayed(recordPlayed(emptyStats))),
            timeMs: 1,
            score: 1,
        });

        expect(winPercent(emptyStats)).toBe(0);
        expect(winPercent(oneOfThree)).toBe(33);
    });
});
