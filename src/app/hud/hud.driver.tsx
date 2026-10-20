import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { DrawMode } from '~/engine/index.ts';
import { aSession } from '~/testkit/builders/index.ts';

import { Hud } from './hud.tsx';
import { HudTestIds } from './hud.test-ids.ts';
import { SessionModel } from '../session/session.utils.ts';
import { GameProvider, useGame } from '../game-provider.tsx';
import { AUTO_COMPLETE_STEP_MS, GameContextValue } from '../game-provider.utils.ts';

export type HudDriver = {
    given: {
        session: (build: (builder: ReturnType<typeof aSession>) => ReturnType<typeof aSession>) => void;
    };
    when: {
        created: () => Promise<void>;
        unmounted: () => void;
        newGameStartedElsewhere: () => void;
    };
    click: {
        undo: () => void;
        newGame: () => void;
        mode: (mode: DrawMode) => void;
        autoComplete: () => void;
        confirmLeave: () => void;
        keepPlaying: () => void;
    };
    press: { undoShortcut: (args: { modifier: 'ctrl' | 'meta'; isRepeat?: boolean }) => void; escape: () => void };
    time: { pass: (ms: number) => void; autoCompleteSteps: (count: number) => void };
    assert: {
        stats: (args: { score: string; moves: string; time: string }) => void;
        time: (time: string) => void;
        moves: (moves: string) => void;
        score: (score: string) => void;
        undoEnabled: (isEnabled: boolean) => void;
        modeSelected: (mode: DrawMode) => void;
        confirmShown: (isShown: boolean) => void;
        dealNumber: (dealNumber: number) => void;
        autoCompleteOffered: (isOffered: boolean) => void;
        undoShortcutListenerRemoved: () => void;
    };
};

const passTime = (ms: number): void => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

const fixedSeed = (): number => 3;

// Fake timers fake Date too, so the provider's clock advances with the fake clock.
const fakeNow = (): number => Date.now();

export const makeHudDriver = (): HudDriver => {
    vi.useFakeTimers();
    const scenario: { session: SessionModel } = { session: aSession().build() };
    const outside: { game: GameContextValue | undefined } = { game: undefined };
    const rendered: { unmount: () => void } = { unmount: () => undefined };
    const keySpies = { add: vi.spyOn(window, 'addEventListener'), remove: vi.spyOn(window, 'removeEventListener') };

    // Stands in for another part of the app (e.g. the win screen) that can start a new game.
    const ElsewhereInTheApp = (): undefined => {
        outside.game = useGame();

        return undefined;
    };

    const click = (testId: string): void => {
        fireEvent.click(screen.getByTestId(testId));
    };

    const keydownCount = (spy: typeof keySpies.add): number =>
        spy.mock.calls.filter(([type]) => type === 'keydown').length;

    return {
        given: {
            session: (build) => {
                scenario.session = build(aSession()).build();
            },
        },
        when: {
            created: async () => {
                const session = scenario.session;
                const initialSession = (): SessionModel => session;
                rendered.unmount = render(
                    <GameProvider createInitialSession={initialSession} seedSource={fixedSeed} now={fakeNow}>
                        <Hud />
                        <ElsewhereInTheApp />
                    </GameProvider>,
                ).unmount;
            },
            unmounted: () => {
                rendered.unmount();
            },
            newGameStartedElsewhere: () => {
                const game = outside.game;

                if (game === undefined) throw new Error('hud driver: newGameStartedElsewhere needs when.created first');

                act(() => {
                    game.newGame({ drawMode: DrawMode.One });
                });
            },
        },
        click: {
            undo: () => click(HudTestIds.Undo),
            newGame: () => click(HudTestIds.NewGame),
            mode: (mode) => click(HudTestIds.Mode(mode)),
            autoComplete: () => click(HudTestIds.AutoComplete),
            confirmLeave: () => click(HudTestIds.ConfirmLeave),
            keepPlaying: () => click(HudTestIds.ConfirmStay),
        },
        press: {
            undoShortcut: ({ modifier, isRepeat = false }) => {
                fireEvent.keyDown(window, {
                    key: 'z',
                    ctrlKey: modifier === 'ctrl',
                    metaKey: modifier === 'meta',
                    repeat: isRepeat,
                });
            },
            escape: () => {
                fireEvent.keyDown(screen.getByTestId(HudTestIds.Confirm), { key: 'Escape' });
            },
        },
        time: {
            pass: passTime,
            autoCompleteSteps: (count) => {
                Array.from({ length: count }).forEach(() => {
                    passTime(AUTO_COMPLETE_STEP_MS);
                });
            },
        },
        assert: {
            stats: ({ score, moves, time }) => {
                expect(screen.getByTestId(HudTestIds.Score)).toHaveTextContent(score);
                expect(screen.getByTestId(HudTestIds.Moves)).toHaveTextContent(moves);
                expect(screen.getByTestId(HudTestIds.Time)).toHaveTextContent(time);
            },
            time: (time) => {
                expect(screen.getByTestId(HudTestIds.Time)).toHaveTextContent(time);
            },
            moves: (moves) => {
                expect(screen.getByTestId(HudTestIds.Moves)).toHaveTextContent(moves);
            },
            score: (score) => {
                expect(screen.getByTestId(HudTestIds.Score)).toHaveTextContent(score);
            },
            undoEnabled: (isEnabled) => {
                const undo = screen.getByTestId(HudTestIds.Undo);
                if (isEnabled) expect(undo).toBeEnabled();
                else expect(undo).toBeDisabled();
            },
            modeSelected: (mode) => {
                expect(screen.getByTestId(HudTestIds.Mode(mode))).toHaveAttribute('aria-pressed', 'true');
            },
            confirmShown: (isShown) => {
                if (isShown) expect(screen.getByTestId(HudTestIds.Confirm)).toBeInTheDocument();
                else expect(screen.queryByTestId(HudTestIds.Confirm)).not.toBeInTheDocument();
            },
            dealNumber: (dealNumber) => {
                expect(screen.getByTestId(HudTestIds.Root)).toHaveAttribute('data-deal-number', String(dealNumber));
            },
            autoCompleteOffered: (isOffered) => {
                if (isOffered) expect(screen.getByTestId(HudTestIds.AutoComplete)).toBeInTheDocument();
                else expect(screen.queryByTestId(HudTestIds.AutoComplete)).not.toBeInTheDocument();
            },
            undoShortcutListenerRemoved: () => {
                expect(keydownCount(keySpies.remove)).toBe(keydownCount(keySpies.add));
            },
        },
    };
};
