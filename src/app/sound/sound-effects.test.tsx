import { beforeEach, describe, it } from 'vitest';

import { SoundKind } from './sound.utils.ts';
import { makeSoundEffectsDriver, SoundEffectsDriver } from './sound-effects.driver.tsx';

describe('SoundEffects', () => {
    let driver: SoundEffectsDriver;

    beforeEach(() => {
        driver = makeSoundEffectsDriver();
    });

    it('plays nothing for the game it opens with, freshly dealt or resumed', async () => {
        driver.given.resumedGame();

        await driver.when.created();

        driver.assert.played([]);
    });

    it('plays each change’s sound exactly once, even with React’s doubled effects', async () => {
        await driver.when.created();

        driver.when.cardDrawn();
        driver.when.newGameDealt();

        driver.assert.played([SoundKind.Draw, SoundKind.Deal]);
    });

    it('stays quiet while only the clock moves', async () => {
        await driver.when.created();
        driver.when.cardDrawn();

        driver.when.clockTicked();
        driver.when.clockTicked();

        driver.assert.played([SoundKind.Draw]);
    });

    it('plays nothing while muted, and remembers each mute choice', async () => {
        driver.given.muted();
        await driver.when.created();

        driver.when.cardDrawn();
        driver.when.muteToggled();
        driver.when.cardDrawn();

        driver.assert.played([SoundKind.Draw]);
        driver.assert.savedMuted([false]);
    });

    it('honours a mute even through a play handle taken before it (a drag in progress)', async () => {
        await driver.when.created();

        driver.when.muteToggled();
        driver.when.soundPlayedThroughAnEarlierHandle();

        driver.assert.played([]);
    });
});
