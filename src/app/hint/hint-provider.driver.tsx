import { expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';

import { makeHookProbe } from '~/testkit/hook-probe.tsx';
import { DrawMode, Rank, Suit } from '~/engine/index.ts';
import { aCard, aGameState, aSession } from '~/testkit/builders/index.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';

import { GameProvider } from '../game-provider.tsx';
import { SessionModel } from '../session/session.utils.ts';
import { HintProvider, useHint } from './hint-provider.tsx';

// The deck is spent and the black five has nowhere to go: no progress is possible.
const stuck = aGameState()
    .withColumn({
        index: 0,
        cards: [
            aCard().withRank(Rank.Two).withSuit(Suit.Hearts).asFaceDown().build(),
            aCard().withRank(Rank.Five).withSuit(Suit.Spades).build(),
        ],
    })
    .build();

export type HintProviderDriver = {
    given: { stuckGame: () => void; freshDeal: () => void };
    when: { created: () => Promise<void>; tableReported: (args: { dealNumber: number; isReady: boolean }) => void };
    assert: { gameOver: (isGameOver: boolean) => void; canHint: (canHint: boolean) => void };
};

export const makeHintProviderDriver = (): HintProviderDriver => {
    vi.useFakeTimers();
    const scenario: { session: SessionModel } = { session: aSession().build() };
    const elsewhere = makeHookProbe({ useValue: useHint, driver: 'hint-provider' });
    const hint = elsewhere.read;

    return {
        given: {
            stuckGame: () => {
                scenario.session = aSession().withGame(stuck).asStarted().build();
            },
            freshDeal: () => {
                scenario.session = aSession().withDeal({ seed: 4, drawMode: DrawMode.One }).build();
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
                        <HintProvider>
                            <elsewhere.Probe />
                        </HintProvider>
                    </GameProvider>,
                );
            },
            tableReported: (report) => {
                act(() => {
                    hint().reportTableReady(report);
                });
            },
        },
        assert: {
            gameOver: (isGameOver) => {
                expect(hint().isGameOver).toBe(isGameOver);
            },
            canHint: (canHint) => {
                expect(hint().canHint).toBe(canHint);
            },
        },
    };
};
