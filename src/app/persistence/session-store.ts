import { Logger } from '~/utils/logger.port.ts';
import { KeyValueStore } from '~/utils/key-value-store.port.ts';

import { emptyStats } from '../stats/stats.utils.ts';
import { SessionModel } from '../session/session.utils.ts';
import {
    chooseInitialSession,
    parseSavedGame,
    parseSavedStats,
    SAVED_GAME_KEY,
    SAVED_STATS_KEY,
    SavedKind,
    SavedResult,
    serializeGame,
    serializeStats,
} from './persistence.utils.ts';

export type SessionStore = {
    // The session to start with: the page's ?seed= deal, else the saved game, else a fresh deal — with the saved record.
    load: (args: { seedParam: number | undefined; freshSeed: () => number }) => SessionModel;
    save: (session: SessionModel) => void;
};

export const makeSessionStore = ({ store, logger }: { store: KeyValueStore; logger: Logger }): SessionStore => {
    // Missing data is normal (first visit); corrupt data is reported, then treated as missing.
    const readSaved = <T>({ key, parse }: { key: string; parse: (raw: string | undefined) => SavedResult<T> }) => {
        const result = parse(store.read(key));

        if (result.kind === SavedKind.Corrupt) {
            logger.warn('sessionStore.load: saved data discarded', { key, reason: result.reason });
        }

        return result.kind === SavedKind.Found ? result.value : undefined;
    };

    return {
        load: ({ seedParam, freshSeed }) =>
            chooseInitialSession({
                savedGame: readSaved({ key: SAVED_GAME_KEY, parse: parseSavedGame }),
                stats: readSaved({ key: SAVED_STATS_KEY, parse: parseSavedStats }) ?? emptyStats,
                seedParam,
                freshSeed,
            }),
        save: (session) => {
            store.write({ key: SAVED_GAME_KEY, value: serializeGame(session) });
            store.write({ key: SAVED_STATS_KEY, value: serializeStats(session.stats) });
        },
    };
};
