import { Logger } from '~/utils/logger.port.ts';
import { KeyValueStore } from '~/utils/key-value-store.port.ts';

import { SavedKind } from '../persistence/persistence.utils.ts';
import { SAVED_SOUND_KEY } from '../persistence/storage-keys.utils.ts';
import { parseSoundPreference, serializeSoundPreference, SoundPreferenceModel } from './sound-preference.utils.ts';

export type SoundPreferenceStore = {
    // Sound is on unless a readable save says it was turned off.
    loadMuted: () => boolean;
    saveMuted: (preference: SoundPreferenceModel) => void;
};

export const makeSoundPreferenceStore = ({
    store,
    logger,
}: {
    store: KeyValueStore;
    logger: Logger;
}): SoundPreferenceStore => ({
    loadMuted: () => {
        const saved = parseSoundPreference(store.read(SAVED_SOUND_KEY));

        if (saved.kind === SavedKind.Corrupt) {
            logger.warn('soundPreferenceStore.loadMuted: saved preference discarded', {
                key: SAVED_SOUND_KEY,
                reason: saved.reason,
            });
        }

        return saved.kind === SavedKind.Found && saved.value.muted;
    },
    saveMuted: (preference) => {
        store.write({ key: SAVED_SOUND_KEY, value: serializeSoundPreference(preference) });
    },
});
