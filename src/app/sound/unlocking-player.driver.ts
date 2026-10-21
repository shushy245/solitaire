import { expect } from 'vitest';
import { act, fireEvent } from '@testing-library/react';

import { FakeLogger } from '~/testkit/fakes/fake-logger.ts';
import { FakeSoundVoice, ResumeOutcome } from '~/testkit/fakes/fake-sound.ts';

import { SoundKind } from './sound.utils.ts';
import { SoundVoice } from './sound-player.port.ts';
import { makeUnlockingPlayer } from './unlocking-player.ts';

export type UnlockingPlayerDriver = {
    given: { audioUnavailable: () => void; resumes: (outcomes: readonly ResumeOutcome[]) => void };
    when: {
        created: () => void;
        played: (sound: SoundKind) => void;
        pointerPressed: () => Promise<void>;
        pointerReleased: () => Promise<void>;
        keyPressed: () => Promise<void>;
    };
    assert: {
        voicesCreated: (count: number) => void;
        sounded: (sounds: readonly SoundKind[]) => void;
        warnedOnce: () => void;
    };
};

// Lets a resume's promise settle before the next step.
const settle = async (): Promise<void> => {
    await act(async () => {
        await Promise.resolve();
    });
};

export const makeUnlockingPlayerDriver = (): UnlockingPlayerDriver => {
    const logger = new FakeLogger();
    const scenario: { isAvailable: boolean; outcomes: readonly ResumeOutcome[] } = {
        isAvailable: true,
        outcomes: [ResumeOutcome.Resumes],
    };
    const voices: FakeSoundVoice[] = [];
    const created: { play: (sound: SoundKind) => void } = { play: () => undefined };

    const createVoice = (): SoundVoice => {
        if (!scenario.isAvailable) throw new Error('AudioContext is not defined');

        const voice = new FakeSoundVoice(scenario.outcomes);
        voices.push(voice);

        return voice;
    };

    return {
        given: {
            audioUnavailable: () => {
                scenario.isAvailable = false;
            },
            resumes: (outcomes) => {
                scenario.outcomes = outcomes;
            },
        },
        when: {
            created: () => {
                created.play = makeUnlockingPlayer({ createVoice, gestures: window, logger }).play;
            },
            played: (sound) => {
                created.play(sound);
            },
            pointerPressed: async () => {
                fireEvent.pointerDown(window);
                await settle();
            },
            pointerReleased: async () => {
                fireEvent.pointerUp(window);
                await settle();
            },
            keyPressed: async () => {
                fireEvent.keyDown(window, { key: 'a' });
                await settle();
            },
        },
        assert: {
            voicesCreated: (count) => {
                expect(voices).toHaveLength(count);
            },
            sounded: (sounds) => {
                expect(voices.flatMap((voice) => voice.played)).toEqual(sounds);
            },
            warnedOnce: () => {
                expect(logger.warnings).toHaveLength(1);
            },
        },
    };
};
