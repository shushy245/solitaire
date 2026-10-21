import { beforeEach, describe, it } from 'vitest';

import { ResumeOutcome } from '~/testkit/fakes/fake-sound.ts';

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

    it('starts audio at the first pointer press, once, and plays from then on', async () => {
        driver.when.created();

        await driver.when.pointerPressed();
        await driver.when.pointerPressed();
        driver.when.played(SoundKind.Draw);

        driver.assert.voicesCreated(1);
        driver.assert.sounded([SoundKind.Draw]);
    });

    it('starts audio at the first key press too', async () => {
        driver.when.created();

        await driver.when.keyPressed();
        driver.when.played(SoundKind.Place);

        driver.assert.sounded([SoundKind.Place]);
    });

    it('plays nothing while audio is still waiting to start, rather than piling sounds up', async () => {
        driver.given.resumes([ResumeOutcome.Waits]);
        driver.when.created();

        await driver.when.pointerPressed();
        driver.when.played(SoundKind.Draw);

        driver.assert.sounded([]);
    });

    it('tries again at the next interaction when the browser refuses one (a touch press, then its release)', async () => {
        driver.given.resumes([ResumeOutcome.Refuses, ResumeOutcome.Resumes]);
        driver.when.created();

        await driver.when.pointerPressed();
        driver.when.played(SoundKind.Deal);
        await driver.when.pointerReleased();
        driver.when.played(SoundKind.Draw);

        driver.assert.voicesCreated(1);
        driver.assert.sounded([SoundKind.Draw]);
    });

    it('starts audio again at the next interaction after the browser suspends it (a locked phone)', async () => {
        driver.when.created();
        await driver.when.pointerPressed();
        driver.when.audioSuspendedByTheBrowser();

        driver.when.played(SoundKind.Deal);
        await driver.when.pointerPressed();
        driver.when.played(SoundKind.Draw);

        driver.assert.voicesCreated(1);
        driver.assert.sounded([SoundKind.Draw]);
    });

    it('stays silent, and says so once, where the browser has no audio', async () => {
        driver.given.audioUnavailable();
        driver.when.created();

        await driver.when.pointerPressed();
        await driver.when.pointerReleased();
        driver.when.played(SoundKind.Draw);

        driver.assert.sounded([]);
        driver.assert.warnedOnce();
    });
});
