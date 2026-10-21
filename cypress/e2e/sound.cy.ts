import { soundDriver } from '../support/drivers/sound.driver.ts';

describe('sound in a real browser', () => {
    it('makes no sound before the first interaction, then sounds card actions', () => {
        soundDriver.given.visitWithFakeAudio();

        soundDriver.assert.noAudioYet();

        soundDriver.when.stockClicked();

        soundDriver.assert.soundsStarted();
    });

    it('stays silent once muted, and is still muted after a reload', () => {
        soundDriver.given.visitWithFakeAudio();
        soundDriver.when.soundToggled();
        soundDriver.when.startsRemembered();

        soundDriver.when.stockClicked();

        soundDriver.assert.noNewSounds();

        soundDriver.when.reloaded();

        soundDriver.assert.soundShownOn(false);
    });
});
