import { Logger } from '~/utils/logger.port.ts';
import { KeyValueStore, WriteOutcome } from '~/utils/key-value-store.port.ts';

import { SessionModel } from '../session/session.utils.ts';
import { emptyStats, mergeStats, StatsModel } from '../stats/stats.utils.ts';
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

    const readSavedStats = (): StatsModel => readSaved({ key: SAVED_STATS_KEY, parse: parseSavedStats }) ?? emptyStats;

    // The record as this tab last loaded or saved it — what it has added since is the difference.
    const synced: { stats: StatsModel } = { stats: emptyStats };

    // Another tab may have saved its own games meanwhile, so this tab's additions are merged into the saved
    // record rather than written over it.
    const saveStats = (stats: StatsModel): void => {
        if (stats === synced.stats) return;

        const merged = mergeStats({ saved: readSavedStats(), before: synced.stats, after: stats });

        if (store.write({ key: SAVED_STATS_KEY, value: serializeStats(merged) }) === WriteOutcome.Saved) {
            synced.stats = stats;
        }
    };

    return {
        load: ({ seedParam, freshSeed }) => {
            const stats = readSavedStats();
            synced.stats = stats;

            return chooseInitialSession({
                savedGame: readSaved({ key: SAVED_GAME_KEY, parse: parseSavedGame }),
                stats,
                seedParam,
                freshSeed,
            });
        },
        // The game goes first: a win the saved game does not show yet would be counted again after a reload.
        save: (session) => {
            if (store.write({ key: SAVED_GAME_KEY, value: serializeGame(session) }) === WriteOutcome.Refused) return;

            saveStats(session.stats);
        },
    };
};
