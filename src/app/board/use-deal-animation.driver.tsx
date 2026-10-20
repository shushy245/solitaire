import { expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { DealPhase } from './board.utils.ts';
import { useDealAnimation } from './use-deal-animation.ts';

export type DealAnimationDriver = {
    given: { fakeClock: () => void };
    when: { mounted: (dealKey: number) => void; redealt: (dealKey: number) => void };
    time: { pass: (ms: number) => void };
    assert: { phase: (phase: DealPhase) => void };
};

export const makeDealAnimationDriver = (): DealAnimationDriver => {
    const hook: { current: ReturnType<typeof renderHook<DealPhase, { dealKey: number }>> | undefined } = {
        current: undefined,
    };

    const mounted = (): NonNullable<typeof hook.current> => {
        if (hook.current === undefined) throw new Error('deal animation driver: call when.mounted first');

        return hook.current;
    };

    return {
        given: {
            fakeClock: () => {
                vi.useFakeTimers();
            },
        },
        when: {
            mounted: (dealKey) => {
                hook.current = renderHook(({ dealKey: key }) => useDealAnimation(key), { initialProps: { dealKey } });
            },
            redealt: (dealKey) => {
                mounted().rerender({ dealKey });
            },
        },
        time: {
            pass: (ms) => {
                act(() => {
                    vi.advanceTimersByTime(ms);
                });
            },
        },
        assert: {
            phase: (phase) => {
                expect(mounted().result.current).toBe(phase);
            },
        },
    };
};
