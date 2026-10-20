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
});
