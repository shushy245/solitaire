import { appDriver } from '../support/drivers/app.driver.ts';

describe('app boot', () => {
    it('shows the Solitaire title when the app loads', () => {
        appDriver.given.visit();

        appDriver.assert.titleVisible();
    });
});
