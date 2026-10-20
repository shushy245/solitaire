import { beforeEach, describe, it } from 'vitest';

import { AppDriver, makeAppDriver } from './app.driver.tsx';

describe('App', () => {
    let driver: AppDriver;

    beforeEach(() => {
        driver = makeAppDriver();
    });

    it('shows the Solitaire title', async () => {
        await driver.when.created();

        driver.assert.titleShown();
    });

    it('deals the requested first seed even when React runs initialisers twice (StrictMode)', async () => {
        driver.given.firstDeal(1);
        driver.given.laterDealsFrom([2, 3, 4]);

        await driver.when.createdInStrictMode();

        // seed 1 deals the Jack of diamonds face-up on column 2 (index 1)
        driver.assert.tableauTop({ column: 1, cardId: 'diamonds-11' });
    });
});
