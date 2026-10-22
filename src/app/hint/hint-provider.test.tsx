import { beforeEach, describe, it } from 'vitest';

import { HintProviderDriver, makeHintProviderDriver } from './hint-provider.driver.tsx';

describe('HintProvider', () => {
    let driver: HintProviderDriver;

    beforeEach(() => {
        driver = makeHintProviderDriver();
    });

    it('offers hints only once the table says this deal has landed', async () => {
        driver.given.freshDeal();
        await driver.when.created();

        driver.assert.canHint(false);

        driver.when.tableReported({ dealNumber: 0, isReady: true });

        driver.assert.canHint(true);
    });

    it('calls a stuck game over only once its table is ready, never for an older deal’s report', async () => {
        driver.given.stuckGame();
        await driver.when.created();

        driver.when.tableReported({ dealNumber: 7, isReady: true });
        driver.assert.gameOver(false);

        driver.when.tableReported({ dealNumber: 0, isReady: true });
        driver.assert.gameOver(true);
    });
});
