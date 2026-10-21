import { StrictMode } from 'react';
import { expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';

import { aSession } from '~/testkit/builders/index.ts';
import { DrawMode, makeDrawMove } from '~/engine/index.ts';
import { FakeSoundPlayer } from '~/testkit/fakes/fake-sound.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';

import { SoundKind } from './sound.utils.ts';
import { SoundEffects } from './sound-effects.tsx';
import { SessionModel } from '../session/session.utils.ts';
import { GameContextValue } from '../game-provider.utils.ts';
import { GameProvider, useGame } from '../game-provider.tsx';
import { SoundProvider, useSound } from './sound-provider.tsx';

export type SoundEffectsDriver = {
    given: { muted: () => void; resumedGame: () => void };
    when: {
        created: () => Promise<void>;
        cardDrawn: () => void;
        clockTicked: () => void;
        newGameDealt: () => void;
        muteToggled: () => void;
        soundPlayedThroughAnEarlierHandle: () => void;
    };
    assert: { played: (sounds: readonly SoundKind[]) => void; savedMuted: (muted: readonly boolean[]) => void };
};

// Mounted in StrictMode, as the app is, so a doubled effect would show up as a doubled sound.
export const makeSoundEffectsDriver = (): SoundEffectsDriver => {
    vi.useFakeTimers();
    const player = new FakeSoundPlayer();
    const saved: boolean[] = [];
    const scenario: { session: SessionModel; isMuted: boolean } = {
        session: aSession().withDeal({ seed: 1, drawMode: DrawMode.One }).build(),
        isMuted: false,
    };
    const outside: {
        game: GameContextValue | undefined;
        toggleMute: () => void;
        firstPlay: ((sound: SoundKind) => void) | undefined;
    } = { game: undefined, toggleMute: () => undefined, firstPlay: undefined };

    const ElsewhereInTheApp = (): undefined => {
        outside.game = useGame();
        const sound = useSound();
        outside.toggleMute = sound.toggleMute;
        // Kept from the first render, like a handler a drag captured when the pointer went down.
        outside.firstPlay ??= sound.play;

        return undefined;
    };

    const game = (): GameContextValue => {
        if (outside.game === undefined) throw new Error('sound effects driver: call when.created() first');

        return outside.game;
    };

    const handleSaveMuted = ({ muted }: { muted: boolean }): void => {
        saved.push(muted);
    };

    return {
        given: {
            muted: () => {
                scenario.isMuted = true;
            },
            resumedGame: () => {
                scenario.session = aSession().withDeal({ seed: 1, drawMode: DrawMode.One }).afterDraws(5).build();
            },
        },
        when: {
            created: async () => {
                const session = scenario.session;
                const initialSession = (): SessionModel => session;
                render(
                    <StrictMode>
                        <SoundProvider player={player} initiallyMuted={scenario.isMuted} saveMuted={handleSaveMuted}>
                            <GameProvider
                                createInitialSession={initialSession}
                                seedSource={fixedSeed}
                                now={fakeNow}
                                saveSession={discardSave}
                            >
                                <SoundEffects />
                                <ElsewhereInTheApp />
                            </GameProvider>
                        </SoundProvider>
                    </StrictMode>,
                );
            },
            cardDrawn: () => {
                const draw = makeDrawMove(game().session.game);

                if (draw === undefined) throw new Error('sound effects driver: the stock is empty');

                act(() => {
                    game().dispatchMove(draw);
                });
            },
            clockTicked: () => {
                act(() => {
                    vi.advanceTimersByTime(1_000);
                });
            },
            newGameDealt: () => {
                act(() => {
                    game().newGame({ drawMode: DrawMode.One });
                });
            },
            soundPlayedThroughAnEarlierHandle: () => {
                const play = outside.firstPlay;

                if (play === undefined) throw new Error('sound effects driver: call when.created() first');

                play(SoundKind.SnapBack);
            },
            muteToggled: () => {
                act(() => {
                    outside.toggleMute();
                });
            },
        },
        assert: {
            played: (sounds) => {
                expect(player.played).toEqual(sounds);
            },
            savedMuted: (muted) => {
                expect(saved).toEqual(muted);
            },
        },
    };
};
