import { expect } from 'vitest';

import { dealGame, DrawMode } from '~/engine/index.ts';
import { FakeLogger } from '~/testkit/fakes/fake-logger.ts';
import { MemoryStorage } from '~/testkit/fakes/memory-storage.ts';
import { UnavailableStorage } from '~/testkit/fakes/unavailable-storage.ts';
import { makeBrowserKeyValueStore } from '~/utils/browser-key-value-store.ts';

import { StatsModel } from '../stats/stats.utils.ts';
import { SessionModel } from '../session/session.utils.ts';
import { makeSessionStore, SessionStore } from './session-store.ts';
import { SAVED_GAME_KEY, SAVED_STATS_KEY } from './persistence.utils.ts';

const FRESH_SEED = 31;

export type SessionStoreDriver = {
    given: {
        savedGame: (raw: string) => void;
        savedStats: (raw: string) => void;
        storageUnavailable: () => void;
        seedParam: (seed: number) => void;
    };
    when: { loaded: () => void; saved: (session: SessionModel) => void };
    assert: {
        resumed: (session: SessionModel) => void;
        freshDeal: () => void;
        dealOf: (seed: number) => void;
        stats: (stats: StatsModel) => void;
        warnedAbout: (args: { key: string; reason: RegExp }) => void;
        noWarnings: () => void;
    };
};

// Runs the real Web Storage adapter (over in-memory storage, or one that refuses every call) under the session store.
export const makeSessionStoreDriver = (): SessionStoreDriver => {
    const logger = new FakeLogger();
    const saved = new MemoryStorage();
    const scenario: { storage: Storage; seedParam: number | undefined } = { storage: saved, seedParam: undefined };
    const loaded: { session: SessionModel | undefined } = { session: undefined };
    const store = (): SessionStore =>
        makeSessionStore({ store: makeBrowserKeyValueStore({ storage: () => scenario.storage, logger }), logger });
    const loadedSession = (): SessionModel => {
        if (loaded.session === undefined) throw new Error('session store driver: call when.loaded() first');

        return loaded.session;
    };

    return {
        given: {
            savedGame: (raw) => {
                saved.setItem(SAVED_GAME_KEY, raw);
            },
            savedStats: (raw) => {
                saved.setItem(SAVED_STATS_KEY, raw);
            },
            storageUnavailable: () => {
                scenario.storage = new UnavailableStorage();
            },
            seedParam: (seed) => {
                scenario.seedParam = seed;
            },
        },
        when: {
            loaded: () => {
                loaded.session = store().load({ seedParam: scenario.seedParam, freshSeed: () => FRESH_SEED });
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
            dealOf: (seed) => {
                expect(loadedSession().game.seed).toBe(seed);
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
        },
    };
};
