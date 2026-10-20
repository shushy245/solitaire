import { celebrationDriver } from '../support/drivers/celebration.driver.ts';

describe('winning in a real browser', () => {
    it('auto-completes a near-won game to the win, then deals a new one', () => {
        celebrationDriver.given.gameReadyToAutoComplete();

        celebrationDriver.when.autoCompleted();

        celebrationDriver.assert.winShown();

        celebrationDriver.when.newGameChosen();

        celebrationDriver.assert.freshDealOnTable();
    });
});
