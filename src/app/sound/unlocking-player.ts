import { Logger } from '~/utils/logger.port.ts';

import { SoundPlayer, SoundVoice } from './sound-player.port.ts';

// Browsers allow audio only from a user gesture, and which events count differs: a mouse press does, a touch
// press does not (its release does), Esc does not. So every press, release and key is a chance to start audio,
// until audio is actually running; sounds asked for before then are simply not played.
const UNLOCKING_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

export const makeUnlockingPlayer = ({
    createVoice,
    gestures,
    logger,
}: {
    createVoice: () => SoundVoice;
    gestures: Pick<Window, 'addEventListener' | 'removeEventListener'>;
    logger: Logger;
}): SoundPlayer => {
    const audio: { voice: SoundVoice | undefined; isRunning: boolean; hasReported: boolean } = {
        voice: undefined,
        isRunning: false,
        hasReported: false,
    };

    // Reported once: a refusal is often followed by success at the next gesture, and missing audio stays missing.
    const reportFailure = (error: unknown): void => {
        if (audio.hasReported) return;

        audio.hasReported = true;
        logger.warn('unlockingPlayer: audio not started — silent until an interaction allows it', {
            error: String(error),
        });
    };

    const stopListening = (): void => {
        UNLOCKING_EVENTS.forEach((type) => {
            gestures.removeEventListener(type, handleGesture, true);
        });
    };

    const handleRunning = (): void => {
        audio.isRunning = true;
        stopListening();
    };

    // Asking again on every gesture is harmless, and some browsers only start audio when asked within one they accept.
    function handleGesture(): void {
        if (audio.isRunning) return;

        try {
            const voice = audio.voice ?? createVoice();
            audio.voice = voice;
            voice.resume().then(handleRunning, reportFailure);
        } catch (error) {
            reportFailure(error);
        }
    }

    UNLOCKING_EVENTS.forEach((type) => {
        gestures.addEventListener(type, handleGesture, true);
    });

    return {
        play: (sound) => {
            if (!audio.isRunning || audio.voice === undefined) return;

            try {
                audio.voice.play(sound);
            } catch (error) {
                reportFailure(error);
            }
        },
    };
};
