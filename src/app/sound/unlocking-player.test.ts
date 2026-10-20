import { beforeEach, describe, it } from 'vitest';

import { SoundKind } from './sound.utils.ts';
import { makeUnlockingPlayerDriver, UnlockingPlayerDriver } from './unlocking-player.driver.ts';

describe('unlocking sound player', () => {
    let driver: UnlockingPlayerDriver;

    beforeEach(() => {
        driver = makeUnlockingPlayerDriver();
    });

    it('creates no audio and plays nothing before the player first touches the page', () => {
        driver.when.created();

        driver.when.played(SoundKind.Deal);

        driver.assert.voicesCreated(0);
        driver.assert.sounded([]);
    });

    it('starts audio at the first pointer press, once, and plays from then on', () => {
        driver.when.created();

        driver.when.pointerPressed();
        driver.when.pointerPressed();
        driver.when.played(SoundKind.Draw);

        driver.assert.voicesCreated(1);
        driver.assert.sounded([SoundKind.Draw]);
    });

    it('starts audio at the first key press too', () => {
        driver.when.created();

        driver.when.keyPressed();
        driver.when.played(SoundKind.Place);

        driver.assert.sounded([SoundKind.Place]);
    });

    it('stays silent, and says so once, where the browser has no audio', () => {
        driver.given.audioUnavailable();
        driver.when.created();

        driver.when.pointerPressed();
        driver.when.played(SoundKind.Draw);
        driver.when.played(SoundKind.Place);

        driver.assert.sounded([]);
        driver.assert.warnedOnce();
    });

    it('reports a refused resume without letting it escape as an unhandled rejection', async () => {
        driver.given.audioRefusedToResume();
        driver.when.created();

        driver.when.pointerPressed();
        await Promise.resolve();
        await Promise.resolve();

        driver.assert.warnedOnce();
    });
});
