import { expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';

import { isWon } from '~/engine/index.ts';
import { aSession } from '~/testkit/builders/index.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';

import { SessionModel } from './session/session.utils.ts';
import { GameProvider, useGame } from './game-provider.tsx';
import { AUTO_COMPLETE_STEP_MS, GameContextValue } from './game-provider.utils.ts';

export type GameProviderDriver = {
    given: { readyToAutoComplete: () => void };
    when: {
        created: () => Promise<void>;
        autoCompleteStarted: () => void;
        stepsPassed: (steps: number) => void;
    };
    assert: { cardsHome: (count: number) => void; won: () => void };
};

export const makeGameProviderDriver = (): GameProviderDriver => {
    vi.useFakeTimers();
    const scenario: { session: SessionModel } = { session: aSession().build() };
    const outside: { game: GameContextValue | undefined } = { game: undefined };

    const ElsewhereInTheApp = (): undefined => {
        outside.game = useGame();

        return undefined;
    };

    const game = (): GameContextValue => {
        if (outside.game === undefined) throw new Error('game-provider driver: call when.created() first');

        return outside.game;
    };

    return {
        given: {
            readyToAutoComplete: () => {
                scenario.session = aSession().asReadyToAutoComplete().build();
            },
        },
        when: {
            created: async () => {
                const session = scenario.session;
                const initialSession = (): SessionModel => session;
                render(
                    <GameProvider
                        createInitialSession={initialSession}
                        seedSource={fixedSeed}
                        now={fakeNow}
                        saveSession={discardSave}
                    >
                        <ElsewhereInTheApp />
                    </GameProvider>,
                );
            },
            autoCompleteStarted: () => {
                act(() => {
                    game().startAutoComplete();
                });
            },
            // One step at a time: each step's timer is scheduled by the render of the step before it.
            stepsPassed: (steps) => {
                Array.from({ length: steps }).forEach(() => {
                    act(() => {
                        vi.advanceTimersByTime(AUTO_COMPLETE_STEP_MS);
                    });
                });
            },
        },
        assert: {
            cardsHome: (count) => {
                expect(game().session.game.foundations.flat()).toHaveLength(count);
            },
            won: () => {
                expect(isWon(game().session.game)).toBe(true);
            },
        },
    };
};
