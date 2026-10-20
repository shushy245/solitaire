import { beforeEach, describe, it } from 'vitest';

import { DrawMode } from '~/engine/index.ts';
import { aSession } from '~/testkit/builders/index.ts';

import { emptyStats, recordPlayed, recordWin } from '../stats/stats.utils.ts';
import { makeSessionStoreDriver, SessionStoreDriver } from './session-store.driver.ts';
import { SAVED_GAME_KEY, SAVED_STATS_KEY, serializeGame, serializeStats } from './persistence.utils.ts';

describe('session store', () => {
    let driver: SessionStoreDriver;
    const played = aSession()
        .withDeal({ seed: 808, drawMode: DrawMode.Three })
        .afterDraws(4)
        .withElapsedMs(42_000)
        .build();
    const record = recordWin({ stats: recordPlayed(recordPlayed(emptyStats)), timeMs: 200_000, score: 610 });

    beforeEach(() => {
        driver = makeSessionStoreDriver();
    });

    it('resumes the saved game with the saved record', () => {
        driver.given.savedGame(serializeGame(played));
        driver.given.savedStats(serializeStats(record));

        driver.when.loaded();

        driver.assert.resumed(played);
        driver.assert.stats(record);
        driver.assert.noWarnings();
    });

    it('deals a fresh game when nothing was saved, without complaint', () => {
        driver.when.loaded();

        driver.assert.freshDeal();
        driver.assert.stats(emptyStats);
        driver.assert.noWarnings();
    });

    it('discards an unreadable game, says why, deals a fresh one and keeps the record', () => {
        driver.given.savedGame('{"version":0}');
        driver.given.savedStats(serializeStats(record));

        driver.when.loaded();

        driver.assert.freshDeal();
        driver.assert.stats(record);
        driver.assert.warnedAbout({ key: SAVED_GAME_KEY, reason: /discarded/ });
    });

    it('discards an unreadable record, says why, and still resumes the game', () => {
        driver.given.savedGame(serializeGame(played));
        driver.given.savedStats('not json');

        driver.when.loaded();

        driver.assert.resumed(played);
        driver.assert.stats(emptyStats);
        driver.assert.warnedAbout({ key: SAVED_STATS_KEY, reason: /discarded/ });
    });

    it('deals the seed the page asks for instead of resuming', () => {
        driver.given.savedGame(serializeGame(played));
        driver.given.seedParam(5);

        driver.when.loaded();

        driver.assert.dealOf(5);
    });

    it('reads back what it saved', () => {
        driver.when.saved({ ...played, stats: record });

        driver.when.loaded();

        driver.assert.resumed(played);
        driver.assert.stats(record);
    });

    it('keeps the game going when storage refuses every call, and says so', () => {
        driver.given.storageUnavailable();

        driver.when.saved(played);
        driver.when.loaded();

        driver.assert.freshDeal();
        driver.assert.warnedAbout({ key: SAVED_GAME_KEY, reason: /could not save/ });
        driver.assert.warnedAbout({ key: SAVED_GAME_KEY, reason: /could not read/ });
    });
});
