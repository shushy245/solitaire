import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { aSession } from '~/testkit/builders/index.ts';
import { DrawMode, makeDrawMove } from '~/engine/index.ts';
import { FakeSoundPlayer } from '~/testkit/fakes/fake-sound.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';

import { Hud } from './hud.tsx';
import { HudTestIds } from './hud.test-ids.ts';
import { SessionModel } from '../session/session.utils.ts';
import { SoundProvider } from '../sound/sound-provider.tsx';
import { GameProvider, useGame } from '../game-provider.tsx';
import { AUTO_COMPLETE_STEP_MS, GameContextValue } from '../game-provider.utils.ts';

export type HudDriver = {
    given: {
        session: (build: (builder: ReturnType<typeof aSession>) => ReturnType<typeof aSession>) => void;
        mutedLastTime: () => void;
    };
    when: {
        created: () => Promise<void>;
        unmounted: () => void;
        newGameStartedElsewhere: () => void;
        cardDrawnElsewhere: () => void;
        focused: (testId: string) => void;
        rerenderedWithANewClock: () => void;
    };
    click: {
        undo: () => void;
        newGame: () => void;
        mode: (mode: DrawMode) => void;
        autoComplete: () => void;
        confirmLeave: () => void;
        keepPlaying: () => void;
        record: () => void;
        sound: () => void;
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
        focusOn: (testId: string) => void;
        undoShortcutListenerRemoved: () => void;
        soundOn: (isOn: boolean) => void;
        savedMuted: (muted: readonly boolean[]) => void;
        recordShown: (isShown: boolean) => void;
        record: (args: { played: string; won: string; winRate: string; bestTime: string; bestScore: string }) => void;
    };
};

const passTime = (ms: number): void => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

export const makeHudDriver = (): HudDriver => {
    vi.useFakeTimers();
    const scenario: { session: SessionModel; isMuted: boolean } = { session: aSession().build(), isMuted: false };
    const savedMuted: boolean[] = [];
    const handleSaveMuted = (muted: boolean): void => {
        savedMuted.push(muted);
    };
    const outside: { game: GameContextValue | undefined } = { game: undefined };
    const rendered: { unmount: () => void; rerender: (ui: JSX.Element) => void } = {
        unmount: () => undefined,
        rerender: () => undefined,
    };
    const keySpies = { add: vi.spyOn(window, 'addEventListener'), remove: vi.spyOn(window, 'removeEventListener') };

    // Stands in for another part of the app (e.g. the win screen) that can start a new game.
    const ElsewhereInTheApp = (): undefined => {
        outside.game = useGame();

        return undefined;
    };

    // A real click focuses the button first; focus return depends on it.
    const tree = (now: () => number): JSX.Element => {
        const session = scenario.session;
        const initialSession = (): SessionModel => session;

        return (
            <SoundProvider player={new FakeSoundPlayer()} initiallyMuted={scenario.isMuted} saveMuted={handleSaveMuted}>
                <GameProvider
                    createInitialSession={initialSession}
                    seedSource={fixedSeed}
                    now={now}
                    saveSession={discardSave}
                >
                    <Hud />
                    <ElsewhereInTheApp />
                </GameProvider>
            </SoundProvider>
        );
    };

    const click = (testId: string): void => {
        const element = screen.getByTestId(testId);
        element.focus();
        fireEvent.click(element);
    };

    const keydownHandlers = (spy: typeof keySpies.add): unknown[] =>
        spy.mock.calls.filter(([type]) => type === 'keydown').map(([, handler]) => handler);

    return {
        given: {
            session: (build) => {
                scenario.session = build(aSession()).build();
            },
            mutedLastTime: () => {
                scenario.isMuted = true;
            },
        },
        when: {
            created: async () => {
                const { unmount, rerender } = render(tree(fakeNow));
                rendered.unmount = unmount;
                rendered.rerender = rerender;
            },
            // A parent re-rendering with a fresh clock function — same time source, new identity.
            rerenderedWithANewClock: () => {
                rendered.rerender(tree(() => fakeNow()));
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
            focused: (testId) => {
                screen.getByTestId(testId).focus();
            },
            cardDrawnElsewhere: () => {
                const game = outside.game;
                const draw = game === undefined ? undefined : makeDrawMove(game.session.game);

                if (game === undefined || draw === undefined)
                    throw new Error('hud driver: cardDrawnElsewhere needs when.created and a non-empty stock');

                act(() => {
                    game.dispatchMove(draw);
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
            record: () => click(HudTestIds.RecordToggle),
            sound: () => click(HudTestIds.SoundToggle),
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
            // Focus may be anywhere (e.g. on the page after a card was clicked), so Escape is pressed on the page.
            escape: () => {
                fireEvent.keyDown(document.body, { key: 'Escape' });
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
            focusOn: (testId) => {
                expect(screen.getByTestId(testId)).toHaveFocus();
            },
            soundOn: (isOn) => {
                expect(screen.getByTestId(HudTestIds.SoundToggle)).toHaveAttribute('aria-pressed', String(isOn));
            },
            savedMuted: (muted) => {
                expect(savedMuted).toEqual(muted);
            },
            // The panel stays in the page while hidden, so the toggle's aria-controls always points at it.
            recordShown: (isShown) => {
                const toggle = screen.getByTestId(HudTestIds.RecordToggle);
                const record = screen.getByTestId(HudTestIds.Record);
                expect(toggle).toHaveAttribute('aria-expanded', String(isShown));
                expect(toggle).toHaveAttribute('aria-controls', record.id);
                if (isShown) expect(record).toBeVisible();
                else expect(record).not.toBeVisible();
            },
            record: (entries) => {
                Object.entries(entries).forEach(([entry, value]) => {
                    expect(screen.getByTestId(HudTestIds.RecordEntry(entry))).toHaveTextContent(value);
                });
            },
            undoShortcutListenerRemoved: () => {
                const added = keydownHandlers(keySpies.add);

                expect(added).not.toHaveLength(0);
                expect(keydownHandlers(keySpies.remove)).toEqual(expect.arrayContaining(added));
            },
        },
    };
};
