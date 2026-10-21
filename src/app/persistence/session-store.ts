import { Logger } from '~/utils/logger.port.ts';
import { KeyValueStore, WriteOutcome } from '~/utils/key-value-store.port.ts';

import { SessionModel } from '../session/session.utils.ts';
import { emptyStats, mergeStats, StatsModel } from '../stats/stats.utils.ts';
import {
    chooseInitialSession,
    parseSavedGame,
    parseSavedStats,
    RequestedDealModel,
    SAVED_GAME_KEY,
    SAVED_STATS_KEY,
    SavedKind,
    SavedResult,
    serializeGame,
    serializeStats,
} from './persistence.utils.ts';

export type SessionStore = {
    // The session to start with: the page's requested deal, else the saved game, else a fresh deal — with the saved record.
    load: (args: { requestedDeal: RequestedDealModel | undefined; freshSeed: () => number }) => SessionModel;
    save: (session: SessionModel) => void;
};

export const makeSessionStore = ({ store, logger }: { store: KeyValueStore; logger: Logger }): SessionStore => {
    // Missing data is normal (first visit); corrupt data is reported, then treated as missing.
    // `operation` names who is reading (the load, or a save merging the record), so the log says where it came from.
    const readSaved = <T>({
        operation,
        key,
        parse,
    }: {
        operation: string;
        key: string;
        parse: (raw: string | undefined) => SavedResult<T>;
    }) => {
        const result = parse(store.read(key));

        if (result.kind === SavedKind.Corrupt) {
            logger.warn(`${operation}: saved data discarded`, { key, reason: result.reason });
        }

        return result.kind === SavedKind.Found ? result.value : undefined;
    };

    const readSavedStats = (operation: string): StatsModel =>
        readSaved({ operation, key: SAVED_STATS_KEY, parse: parseSavedStats }) ?? emptyStats;

    // The record as this tab last loaded or saved it — what it has added since is the difference.
    const synced: { stats: StatsModel } = { stats: emptyStats };

    // Another tab may have saved its own games meanwhile, so this tab's additions are merged into the saved
    // record rather than written over it.
    const saveStats = (stats: StatsModel): void => {
        if (stats === synced.stats) return;

        const merged = mergeStats({ saved: readSavedStats('sessionStore.save'), before: synced.stats, after: stats });

        if (store.write({ key: SAVED_STATS_KEY, value: serializeStats(merged) }) === WriteOutcome.Saved) {
            synced.stats = stats;
        }
    };

    return {
        load: ({ requestedDeal, freshSeed }) => {
            const stats = readSavedStats('sessionStore.load');
            synced.stats = stats;

            return chooseInitialSession({
                savedGame: readSaved({ operation: 'sessionStore.load', key: SAVED_GAME_KEY, parse: parseSavedGame }),
                stats,
                requestedDeal,
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
