import { StrictMode } from 'react';
import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { App } from './app.tsx';
import { AppTestIds } from './app.utils.ts';
import { HudTestIds } from './app/hud/hud.test-ids.ts';
import { FakeLogger } from './testkit/fakes/fake-logger.ts';
import { BoardTestIds } from './app/board/board.test-ids.ts';
import { SoundProvider } from './app/sound/sound-provider.tsx';
import { FakeSoundPlayer } from './testkit/fakes/fake-sound.ts';
import { MotionProvider } from './app/motion/motion-provider.tsx';
import { MemoryStorage } from './testkit/fakes/memory-storage.ts';
import { discardSave, fakeNow } from './testkit/provider-fakes.ts';
import { makeSessionStore } from './app/persistence/session-store.ts';
import { DEAL_TOTAL_MS, STACK_HOLD_MS } from './app/board/board.utils.ts';
import { makeBrowserKeyValueStore } from './utils/browser-key-value-store.ts';

export type AppDriver = {
    given: { firstDeal: (seed: number) => void; laterDealsFrom: (seeds: readonly number[]) => void };
    when: {
        created: () => Promise<void>;
        createdInStrictMode: () => Promise<void>;
        dealt: () => void;
        reloaded: () => Promise<void>;
    };
    click: { stock: () => void };
    assert: {
        titleShown: () => void;
        tableauTop: (args: { column: number; cardId: string }) => void;
        tableAsBeforeReload: () => void;
    };
};

const passTime = (ms: number): void => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

const motionIsFine = (): boolean => false;

// Where every card sits and which way up, plus the move count — what a player would see change.
const snapshotTable = (): readonly string[] => [
    ...screen
        .getAllByTestId(/^BoardTestIds\.Card\./)
        .map(
            (card) =>
                `${card.dataset.testid ?? ''} ${card.dataset.pile ?? ''}:${card.dataset.pileIndex ?? ''}:${card.dataset.face ?? ''}`,
        )
        .sort(),
    screen.getByTestId(HudTestIds.Moves).textContent,
];

// Boots the app the way main.tsx does — the session store loads the first session, the provider saves every
// change — over one in-memory storage that outlives a "reload" (unmount, then boot again).
export const makeAppDriver = (): AppDriver => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const sound = new FakeSoundPlayer();
    const logger = new FakeLogger();
    const scenario: { seedParam: number | undefined; laterSeeds: number[] } = { seedParam: undefined, laterSeeds: [] };
    const seedSource = (): number => scenario.laterSeeds.shift() ?? 0;
    const rendered: { unmount: () => void; tableBeforeReload: readonly string[] } = {
        unmount: () => undefined,
        tableBeforeReload: [],
    };

    const bootApp = (): JSX.Element => {
        const store = makeSessionStore({ store: makeBrowserKeyValueStore({ storage: () => storage, logger }), logger });
        const initialSession = store.load({ seedParam: scenario.seedParam, freshSeed: seedSource });

        return (
            <SoundProvider player={sound} initiallyMuted={false} saveMuted={discardSave}>
                <MotionProvider prefersReducedMotion={motionIsFine}>
                    <App
                        initialSession={initialSession}
                        saveSession={store.save}
                        seedSource={seedSource}
                        now={fakeNow}
                    />
                </MotionProvider>
            </SoundProvider>
        );
    };

    return {
        given: {
            firstDeal: (seed) => {
                scenario.seedParam = seed;
            },
            laterDealsFrom: (seeds) => {
                scenario.laterSeeds = [...seeds];
            },
        },
        when: {
            created: async () => {
                rendered.unmount = render(bootApp()).unmount;
            },
            createdInStrictMode: async () => {
                rendered.unmount = render(<StrictMode>{bootApp()}</StrictMode>).unmount;
            },
            dealt: () => {
                passTime(STACK_HOLD_MS);
                passTime(DEAL_TOTAL_MS);
            },
            reloaded: async () => {
                rendered.tableBeforeReload = snapshotTable();
                rendered.unmount();
                rendered.unmount = render(bootApp()).unmount;
                passTime(STACK_HOLD_MS);
                passTime(DEAL_TOTAL_MS);
            },
        },
        click: {
            stock: () => {
                fireEvent.click(screen.getByTestId(BoardTestIds.Stock));
            },
        },
        assert: {
            titleShown: () => {
                expect(screen.getByTestId(AppTestIds.Title)).toHaveTextContent('Solitaire');
            },
            tableauTop: ({ column, cardId }) => {
                const card = screen.getByTestId(BoardTestIds.Card(cardId));
                expect(card).toHaveAttribute('data-pile', 'tableau');
                expect(card).toHaveAttribute('data-pile-index', String(column));
                expect(card).toHaveAttribute('data-face', 'up');
            },
            tableAsBeforeReload: () => {
                expect(rendered.tableBeforeReload).toContain('1 move');
                expect(snapshotTable()).toEqual(rendered.tableBeforeReload);
                expect(logger.warnings).toEqual([]);
            },
        },
    };
};
