import { Logger } from '~/utils/logger.port.ts';

import { SoundPlayer, SoundVoice } from './sound-player.port.ts';

// Browsers allow audio only from a user gesture, and which events count differs: a mouse press does, a touch
// press does not (its release does), Esc does not — and audio can be suspended again later (a locked phone).
// So every press, release and key that finds audio not running asks it to start; the press and release come
// before the click they belong to, so the tap that wakes audio also sounds. Nothing plays while audio is not
// running — sounds are dropped, never queued.
const UNLOCKING_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;

export const makeUnlockingPlayer = ({
    createVoice,
    gestures,
    logger,
}: {
    createVoice: () => SoundVoice;
    gestures: Pick<Window, 'addEventListener'>;
    logger: Logger;
}): SoundPlayer => {
    const audio: { voice: SoundVoice | undefined; hasReported: boolean } = { voice: undefined, hasReported: false };

    // Reported once: a refusal is often followed by success at the next gesture, and missing audio stays missing.
    const reportFailure = (error: unknown): void => {
        if (audio.hasReported) return;

        audio.hasReported = true;
        logger.warn('unlockingPlayer: audio not started — silent until an interaction allows it', {
            error: String(error),
        });
    };

    const isRunning = (): boolean => audio.voice !== undefined && audio.voice.isRunning();

    // Asking again on every gesture is harmless, and some browsers only start audio when asked within one they accept.
    const handleGesture = (): void => {
        if (isRunning()) return;

        try {
            const voice = audio.voice ?? createVoice();
            audio.voice = voice;
            voice.resume().catch(reportFailure);
        } catch (error) {
            reportFailure(error);
        }
    };

    UNLOCKING_EVENTS.forEach((type) => {
        gestures.addEventListener(type, handleGesture, true);
    });

    return {
        play: (sound) => {
            if (audio.voice === undefined || !isRunning()) return;

            try {
                audio.voice.play(sound);
            } catch (error) {
                reportFailure(error);
            }
        },
    };
};
