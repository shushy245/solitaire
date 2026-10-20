import { Logger } from './logger.port.ts';
import { KeyValueStore } from './key-value-store.port.ts';

// Wraps Web Storage once: the browser may refuse even to hand the storage over (site data blocked), and any
// read or write may throw (quota full). A refusal is reported and the game carries on without saving.
export const makeBrowserKeyValueStore = ({
    storage,
    logger,
}: {
    storage: () => Storage;
    logger: Logger;
}): KeyValueStore => ({
    read: (key) => {
        try {
            return storage().getItem(key) ?? undefined;
        } catch (error) {
            logger.warn('browserKeyValueStore.read: could not read saved data', { key, error: String(error) });

            return undefined;
        }
    },
    write: ({ key, value }) => {
        try {
            storage().setItem(key, value);
        } catch (error) {
            logger.warn('browserKeyValueStore.write: could not save', {
                key,
                bytes: value.length,
                error: String(error),
            });
        }
    },
});
