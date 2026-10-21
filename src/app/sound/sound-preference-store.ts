import { Logger } from '~/utils/logger.port.ts';
import { KeyValueStore } from '~/utils/key-value-store.port.ts';

import { SAVED_SOUND_KEY } from '../persistence/storage-keys.utils.ts';
import { parseSoundPreference, serializeSoundPreference } from './sound-preference.utils.ts';

export type SoundPreferenceStore = { loadMuted: () => boolean; saveMuted: (muted: boolean) => void };

export const makeSoundPreferenceStore = ({
    store,
    logger,
}: {
    store: KeyValueStore;
    logger: Logger;
}): SoundPreferenceStore => ({
    loadMuted: () => {
        const { muted, isCorrupt } = parseSoundPreference(store.read(SAVED_SOUND_KEY));

        if (isCorrupt)
            logger.warn('soundPreferenceStore.loadMuted: saved preference discarded', { key: SAVED_SOUND_KEY });

        return muted;
    },
    saveMuted: (muted) => {
        store.write({ key: SAVED_SOUND_KEY, value: serializeSoundPreference({ muted }) });
    },
});
