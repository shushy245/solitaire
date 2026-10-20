import { expect } from 'vitest';
import { fireEvent } from '@testing-library/react';

import { FakeLogger } from '~/testkit/fakes/fake-logger.ts';
import { FakeSoundVoice } from '~/testkit/fakes/fake-sound.ts';

import { SoundKind } from './sound.utils.ts';
import { SoundVoice } from './sound-player.port.ts';
import { makeUnlockingPlayer } from './unlocking-player.ts';

export type UnlockingPlayerDriver = {
    given: { audioUnavailable: () => void; audioRefusedToResume: () => void };
    when: {
        created: () => void;
        played: (sound: SoundKind) => void;
        pointerPressed: () => void;
        keyPressed: () => void;
    };
    assert: {
        voicesCreated: (count: number) => void;
        sounded: (sounds: readonly SoundKind[]) => void;
        warnedOnce: () => void;
        noWarnings: () => void;
    };
};

export const makeUnlockingPlayerDriver = (): UnlockingPlayerDriver => {
    const logger = new FakeLogger();
    const scenario: { outcome: 'resumes' | 'refuses' | 'unavailable' } = { outcome: 'resumes' };
    const voices: FakeSoundVoice[] = [];
    const created: { play: (sound: SoundKind) => void } = { play: () => undefined };

    const createVoice = (): SoundVoice => {
        if (scenario.outcome === 'unavailable') throw new Error('AudioContext is not defined');

        const voice = new FakeSoundVoice(scenario.outcome);
        voices.push(voice);

        return voice;
    };

    return {
        given: {
            audioUnavailable: () => {
                scenario.outcome = 'unavailable';
            },
            audioRefusedToResume: () => {
                scenario.outcome = 'refuses';
            },
        },
        when: {
            created: () => {
                created.play = makeUnlockingPlayer({ createVoice, gestures: window, logger }).play;
            },
            played: (sound) => {
                created.play(sound);
            },
            pointerPressed: () => {
                fireEvent.pointerDown(window);
            },
            keyPressed: () => {
                fireEvent.keyDown(window, { key: 'a' });
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
            noWarnings: () => {
                expect(logger.warnings).toEqual([]);
            },
        },
    };
};
