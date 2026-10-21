import { expect } from 'vitest';

import { dealGame, DrawMode } from '~/engine/index.ts';
import { FakeLogger } from '~/testkit/fakes/fake-logger.ts';
import { QuotaStorage } from '~/testkit/fakes/quota-storage.ts';
import { MemoryStorage } from '~/testkit/fakes/memory-storage.ts';
import { RequestedDealModel } from '~/utils/seed-source.utils.ts';
import { UnavailableStorage } from '~/testkit/fakes/unavailable-storage.ts';
import { makeBrowserKeyValueStore } from '~/utils/browser-key-value-store.ts';

import { StatsModel } from '../stats/stats.utils.ts';
import { SessionModel } from '../session/session.utils.ts';
import { makeSessionStore, SessionStore } from './session-store.ts';
import { parseSavedStats, SAVED_GAME_KEY, SAVED_STATS_KEY, SavedKind, serializeStats } from './persistence.utils.ts';

const FRESH_SEED = 31;

export type SessionStoreDriver = {
    given: {
        savedGame: (raw: string) => void;
        savedStats: (raw: string) => void;
        storageUnavailable: () => void;
        storageWithRoomForStatsOnly: () => void;
        requestedDeal: (deal: RequestedDealModel) => void;
        statsSavedByAnotherTab: (stats: StatsModel) => void;
    };
    when: { loaded: () => void; saved: (session: SessionModel) => void };
    assert: {
        resumed: (session: SessionModel) => void;
        freshDeal: () => void;
        deal: (deal: RequestedDealModel) => void;
        stats: (stats: StatsModel) => void;
        warnedAbout: (args: { key: string; reason: RegExp }) => void;
        noWarnings: () => void;
        warningCount: (count: number) => void;
        savedStats: (stats: StatsModel | undefined) => void;
    };
};

// Runs the real Web Storage adapter (over in-memory storage, or one that refuses every call) under the session store.
export const makeSessionStoreDriver = (): SessionStoreDriver => {
    const logger = new FakeLogger();
    const scenario: { storage: MemoryStorage | UnavailableStorage; requestedDeal: RequestedDealModel | undefined } = {
        storage: new MemoryStorage(),
        requestedDeal: undefined,
    };
    const saved = (): Storage => scenario.storage;
    const loaded: { session: SessionModel | undefined } = { session: undefined };
    // One store for the whole test, as the app makes one at its composition root.
    const built: { store: SessionStore | undefined } = { store: undefined };
    const store = (): SessionStore => {
        built.store ??= makeSessionStore({ store: makeBrowserKeyValueStore({ storage: saved, logger }), logger });

        return built.store;
    };
    const readSavedStats = (): StatsModel | undefined => {
        const result = parseSavedStats(saved().getItem(SAVED_STATS_KEY) ?? undefined);

        return result.kind === SavedKind.Found ? result.value : undefined;
    };
    const loadedSession = (): SessionModel => {
        if (loaded.session === undefined) throw new Error('session store driver: call when.loaded() first');

        return loaded.session;
    };

    return {
        given: {
            savedGame: (raw) => {
                saved().setItem(SAVED_GAME_KEY, raw);
            },
            savedStats: (raw) => {
                saved().setItem(SAVED_STATS_KEY, raw);
            },
            storageUnavailable: () => {
                scenario.storage = new UnavailableStorage();
            },
            // Only small values fit: the record does, a whole game does not.
            storageWithRoomForStatsOnly: () => {
                scenario.storage = new QuotaStorage(200);
            },
            statsSavedByAnotherTab: (stats) => {
                saved().setItem(SAVED_STATS_KEY, serializeStats(stats));
            },
            requestedDeal: (deal) => {
                scenario.requestedDeal = deal;
            },
        },
        when: {
            loaded: () => {
                loaded.session = store().load({ requestedDeal: scenario.requestedDeal, freshSeed: () => FRESH_SEED });
            },
            saved: (session) => {
                store().save(session);
            },
        },
        assert: {
            resumed: (session) => {
                expect(loadedSession().game).toEqual(session.game);
                expect(loadedSession().history).toEqual(session.history);
                expect(loadedSession().elapsedMs).toBe(session.elapsedMs);
            },
            freshDeal: () => {
                expect(loadedSession().game).toEqual(dealGame({ seed: FRESH_SEED, drawMode: DrawMode.One }));
                expect(loadedSession().history).toEqual([]);
            },
            deal: ({ seed, drawMode }) => {
                expect(loadedSession().game).toEqual(dealGame({ seed, drawMode }));
            },
            stats: (stats) => {
                expect(loadedSession().stats).toEqual(stats);
            },
            warnedAbout: ({ key, reason }) => {
                expect(logger.warnings).toContainEqual({
                    message: expect.stringMatching(reason),
                    context: expect.objectContaining({ key }),
                });
            },
            noWarnings: () => {
                expect(logger.warnings).toEqual([]);
            },
            warningCount: (count) => {
                expect(logger.warnings).toHaveLength(count);
            },
            savedStats: (stats) => {
                expect(readSavedStats()).toEqual(stats);
            },
        },
    };
};
