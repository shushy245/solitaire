import { Logger } from '~/utils/logger.port.ts';

import { SoundPlayer, SoundVoice } from './sound-player.port.ts';

const UNLOCKING_EVENTS = ['pointerdown', 'keydown'] as const;

// Browsers allow audio only after the player has interacted with the page, so no audio exists until the first
// pointer or key press; sounds asked for before then are simply not played. Audio that cannot start (missing,
// blocked, refused) is reported once and the game carries on in silence.
export const makeUnlockingPlayer = ({
    createVoice,
    gestures,
    logger,
}: {
    createVoice: () => SoundVoice;
    gestures: Pick<Window, 'addEventListener' | 'removeEventListener'>;
    logger: Logger;
}): SoundPlayer => {
    const audio: { voice: SoundVoice | undefined; hasFailed: boolean } = { voice: undefined, hasFailed: false };

    const reportFailure = (error: unknown): void => {
        if (audio.hasFailed) return;

        audio.hasFailed = true;
        logger.warn('unlockingPlayer: audio unavailable, playing silently', { error: String(error) });
    };

    const handleFirstGesture = (): void => {
        UNLOCKING_EVENTS.forEach((type) => {
            gestures.removeEventListener(type, handleFirstGesture, true);
        });

        try {
            const voice = createVoice();
            audio.voice = voice;
            voice.resume().catch(reportFailure);
        } catch (error) {
            reportFailure(error);
        }
    };

    UNLOCKING_EVENTS.forEach((type) => {
        gestures.addEventListener(type, handleFirstGesture, true);
    });

    return {
        play: (sound) => {
            if (audio.voice === undefined) return;

            try {
                audio.voice.play(sound);
            } catch (error) {
                reportFailure(error);
            }
        },
    };
};
