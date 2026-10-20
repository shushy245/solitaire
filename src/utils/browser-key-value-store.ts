import { Logger } from './logger.port.ts';
import { KeyValueStore, WriteOutcome } from './key-value-store.port.ts';

// Wraps Web Storage once: the browser may refuse even to hand the storage over (site data blocked), and any
// read or write may throw (quota full). A refusal is reported once per key — until a write to it succeeds
// again — and the game carries on without saving.
export const makeBrowserKeyValueStore = ({
    storage,
    logger,
}: {
    storage: () => Storage;
    logger: Logger;
}): KeyValueStore => {
    const refusedKeys = new Set<string>();

    return {
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
                refusedKeys.delete(key);

                return WriteOutcome.Saved;
            } catch (error) {
                if (!refusedKeys.has(key)) {
                    logger.warn(
                        'browserKeyValueStore.write: could not save — further refusals for this key are not reported',
                        {
                            key,
                            bytes: value.length,
                            error: String(error),
                        },
                    );
                }
                refusedKeys.add(key);

                return WriteOutcome.Refused;
            }
        },
    };
};
