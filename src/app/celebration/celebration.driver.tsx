import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { DrawMode } from '~/engine/index.ts';
import { aSession } from '~/testkit/builders/index.ts';
import { FakeSoundPlayer } from '~/testkit/fakes/fake-sound.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';

import { Board } from '../board/board.tsx';
import { Celebration } from './celebration.tsx';
import { SessionModel } from '../session/session.utils.ts';
import { SoundProvider } from '../sound/sound-provider.tsx';
import { GameContextValue } from '../game-provider.utils.ts';
import { GameProvider, useGame } from '../game-provider.tsx';
import { MotionProvider } from '../motion/motion-provider.tsx';
import { CelebrationTestIds } from './celebration.test-ids.ts';

const FRAME_WINDOW_MS = 100;

export type CelebrationDriver = {
    given: {
        oneMoveFromWon: (drawMode: DrawMode) => void;
        alreadyWon: () => void;
        reducedMotion: () => void;
    };
    when: {
        created: () => Promise<void>;
        winningCardSentUp: () => void;
        winUndone: () => void;
        newGameStartedElsewhere: () => void;
        unmounted: () => void;
        windowResizedTo: (args: { width: number; height: number }) => void;
    };
    click: { newGame: () => void };
    assert: {
        overlayShown: (isShown: boolean) => void;
        summary: (summary: string) => void;
        newGameFocused: () => void;
        cascadeRunning: (isRunning: boolean) => void;
        freshDealIn: (drawMode: DrawMode) => void;
        cascadeCanvasSize: (args: { width: number; height: number }) => void;
    };
};

// The board renders beside the celebration so the cascade can find the foundation cards it launches.
export const makeCelebrationDriver = (): CelebrationDriver => {
    vi.useFakeTimers();
    const frameRequests = vi.spyOn(window, 'requestAnimationFrame');
    const scenario: { session: SessionModel; isMotionReduced: boolean } = {
        session: aSession().build(),
        isMotionReduced: false,
    };
    const outside: { game: GameContextValue | undefined } = { game: undefined };
    const rendered: { unmount: () => void } = { unmount: () => undefined };

    const ElsewhereInTheApp = (): undefined => {
        outside.game = useGame();

        return undefined;
    };

    const game = (): GameContextValue => {
        if (outside.game === undefined) throw new Error('celebration driver: call when.created() first');

        return outside.game;
    };

    const prefersReducedMotion = (): boolean => scenario.isMotionReduced;

    return {
        given: {
            oneMoveFromWon: (drawMode) => {
                scenario.session = aSession().asOneMoveFromWon().withDrawMode(drawMode).build();
            },
            alreadyWon: () => {
                scenario.session = aSession().asWon().build();
            },
            reducedMotion: () => {
                scenario.isMotionReduced = true;
            },
        },
        when: {
            created: async () => {
                const session = scenario.session;
                const initialSession = (): SessionModel => session;
                rendered.unmount = render(
                    <GameProvider
                        createInitialSession={initialSession}
                        seedSource={fixedSeed}
                        now={fakeNow}
                        saveSession={discardSave}
                    >
                        <SoundProvider player={new FakeSoundPlayer()} initiallyMuted={false} saveMuted={discardSave}>
                            <MotionProvider prefersReducedMotion={prefersReducedMotion}>
                                <Board />
                                <Celebration />
                                <ElsewhereInTheApp />
                            </MotionProvider>
                        </SoundProvider>
                    </GameProvider>,
                ).unmount;
            },
            winningCardSentUp: () => {
                act(() => {
                    game().playCard('hearts-13');
                });
            },
            winUndone: () => {
                act(() => {
                    game().undo();
                });
            },
            newGameStartedElsewhere: () => {
                act(() => {
                    game().newGame({ drawMode: DrawMode.One });
                });
            },
            unmounted: () => {
                rendered.unmount();
            },
            windowResizedTo: ({ width, height }) => {
                vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
                vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(height);
                fireEvent(window, new Event('resize'));
            },
        },
        click: {
            newGame: () => {
                fireEvent.click(screen.getByTestId(CelebrationTestIds.NewGame));
            },
        },
        assert: {
            overlayShown: (isShown) => {
                // A named region, not a dialog: it is not modal — play stays live behind it.
                if (isShown) expect(screen.getByRole('region', { name: 'You won!' })).toBeVisible();
                else expect(screen.queryByTestId(CelebrationTestIds.Overlay)).not.toBeInTheDocument();
            },
            summary: (summary) => {
                expect(screen.getByTestId(CelebrationTestIds.Summary)).toHaveTextContent(summary);
            },
            newGameFocused: () => {
                expect(screen.getByTestId(CelebrationTestIds.NewGame)).toHaveFocus();
            },
            // Running means frames keep being requested; stopped means none are, whether or not a canvas remains.
            cascadeRunning: (isRunning) => {
                const before = frameRequests.mock.calls.length;
                act(() => {
                    vi.advanceTimersByTime(FRAME_WINDOW_MS);
                });
                const requested = frameRequests.mock.calls.length - before;

                if (isRunning) expect(requested).toBeGreaterThan(0);
                else expect(requested).toBe(0);
            },
            // jsdom reports a device pixel ratio of 1, so the bitmap matches the window in CSS pixels.
            cascadeCanvasSize: ({ width, height }) => {
                const canvas = screen.getByTestId(CelebrationTestIds.Cascade);
                expect(canvas).toHaveAttribute('width', String(width));
                expect(canvas).toHaveAttribute('height', String(height));
            },
            freshDealIn: (drawMode) => {
                expect(game().session.game.moves).toBe(0);
                expect(game().session.game.drawMode).toBe(drawMode);
            },
        },
    };
};
