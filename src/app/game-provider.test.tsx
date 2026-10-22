import { beforeEach, describe, it } from 'vitest';

import { GameProviderDriver, makeGameProviderDriver } from './game-provider.driver.tsx';

describe('GameProvider', () => {
    let driver: GameProviderDriver;

    beforeEach(() => {
        driver = makeGameProviderDriver();
    });

    it('auto-complete sends one card home per step, on its own timer, until the game is won', async () => {
        driver.given.readyToAutoComplete();
        await driver.when.created();

        driver.when.autoCompleteStarted();
        driver.assert.cardsHome(0);

        driver.when.stepsPassed(1);
        driver.assert.cardsHome(1);

        driver.when.stepsPassed(51);
        driver.assert.won();
    });
});
