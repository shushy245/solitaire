import { beforeEach, describe, it } from 'vitest';

import { DrawMode } from '~/engine/index.ts';

import { CelebrationDriver, makeCelebrationDriver } from './celebration.driver.tsx';

describe('Celebration', () => {
    let driver: CelebrationDriver;

    beforeEach(() => {
        driver = makeCelebrationDriver();
    });

    it('stays away while the game is still being played', async () => {
        driver.given.oneMoveFromWon(DrawMode.One);

        await driver.when.created();

        driver.assert.overlayShown(false);
        driver.assert.cascadeRunning(false);
    });

    it('celebrates the winning card with the cascade and the time and score, offering a new game', async () => {
        driver.given.oneMoveFromWon(DrawMode.One);
        await driver.when.created();

        driver.when.winningCardSentUp();

        driver.assert.overlayShown(true);
        driver.assert.summary('0:00');
        driver.assert.summary('510 points');
        driver.assert.newGameFocused();
        driver.assert.cascadeRunning(true);
    });

    it('deals a new game in the won game’s mode, and the celebration ends', async () => {
        driver.given.oneMoveFromWon(DrawMode.Three);
        await driver.when.created();
        driver.when.winningCardSentUp();

        driver.click.newGame();

        driver.assert.freshDealIn(DrawMode.Three);
        driver.assert.overlayShown(false);
        driver.assert.cascadeRunning(false);
    });

    it('skips the cascade for a player who prefers reduced motion, and still shows the win', async () => {
        driver.given.oneMoveFromWon(DrawMode.One);
        driver.given.reducedMotion();
        await driver.when.created();

        driver.when.winningCardSentUp();

        driver.assert.overlayShown(true);
        driver.assert.cascadeRunning(false);
    });

    it('stops the cascade when a new game is started elsewhere mid-cascade', async () => {
        driver.given.oneMoveFromWon(DrawMode.One);
        await driver.when.created();
        driver.when.winningCardSentUp();

        driver.when.newGameStartedElsewhere();

        driver.assert.overlayShown(false);
        driver.assert.cascadeRunning(false);
    });

    it('stops the cascade and the celebration when the win is undone', async () => {
        driver.given.oneMoveFromWon(DrawMode.One);
        await driver.when.created();
        driver.when.winningCardSentUp();

        driver.when.winUndone();

        driver.assert.overlayShown(false);
        driver.assert.cascadeRunning(false);
    });

    it('stops asking for frames once the table is gone', async () => {
        driver.given.oneMoveFromWon(DrawMode.One);
        await driver.when.created();
        driver.when.winningCardSentUp();

        driver.when.unmounted();

        driver.assert.cascadeRunning(false);
    });

    it('shows a game that was already won when the page opened without replaying the cascade', async () => {
        driver.given.alreadyWon();

        await driver.when.created();

        driver.assert.overlayShown(true);
        driver.assert.cascadeRunning(false);
    });
});
