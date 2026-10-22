import { beforeEach, describe, it } from 'vitest';

import { DrawMode } from '~/engine/index.ts';

import { CLOCK_TICK_MS } from '../game-provider.utils.ts';
import { GameOverDriver, makeGameOverDriver } from './game-over.driver.tsx';

describe('GameOver', () => {
    let driver: GameOverDriver;

    beforeEach(() => {
        driver = makeGameOverDriver();
    });

    it('stays away while progress is still possible', async () => {
        driver.given.oneMoveFromStuck(DrawMode.One);

        await driver.when.created();

        driver.assert.panelShown(false);
    });

    it('tells the player when no more progress is possible, offering Undo first', async () => {
        driver.given.oneMoveFromStuck(DrawMode.One);
        await driver.when.created();

        driver.when.lastMovePlayed();

        driver.assert.panelShown(true);
        driver.assert.undoFocused();
    });

    it('Undo steps back to the last move and the panel goes', async () => {
        driver.given.oneMoveFromStuck(DrawMode.One);
        await driver.when.created();
        driver.when.lastMovePlayed();

        driver.click.undo();

        driver.assert.movesMade(0);
        driver.assert.panelShown(false);
    });

    it('Undo goes back to the last position that was not stuck, however many draws came after', async () => {
        driver.given.oneMoveFromStuckWithDeck();
        await driver.when.created();
        driver.when.lastMovePlayed();
        driver.when.drawn(2);

        driver.click.undo();

        driver.assert.movesMade(0);
        driver.assert.panelShown(false);
    });

    it('the game’s own Undo still takes back one draw at a time', async () => {
        driver.given.oneMoveFromStuckWithDeck();
        await driver.when.created();
        driver.when.lastMovePlayed();
        driver.when.drawn(2);

        driver.when.undoneElsewhere();

        driver.assert.movesMade(2);
        driver.assert.panelShown(true);
    });

    it('New game deals in the stuck game’s mode, and the panel goes', async () => {
        driver.given.oneMoveFromStuck(DrawMode.Three);
        await driver.when.created();
        driver.when.lastMovePlayed();

        driver.click.newGame();

        driver.assert.freshDealIn(DrawMode.Three);
        driver.assert.panelShown(false);
    });

    it('can be closed, and stays closed while the game stays stuck — draws included', async () => {
        driver.given.oneMoveFromStuckWithDeck();
        await driver.when.created();
        driver.when.lastMovePlayed();

        driver.click.close();
        driver.assert.panelShown(false);
        driver.when.drawn(2);

        driver.assert.panelShown(false);
    });

    it('hands focus back to the table when it is closed', async () => {
        driver.given.alreadyStuck();
        await driver.when.created();

        driver.click.close();

        driver.assert.tableFocused();
    });

    it('hands focus to the table when New game deals, and it stays there while the deal flies out', async () => {
        driver.given.alreadyStuck();
        await driver.when.created();

        driver.click.newGame();
        driver.when.dealSettled();

        driver.assert.tableFocused();
    });

    it('closes on Escape while focus is in it', async () => {
        driver.given.alreadyStuck();
        await driver.when.created();

        driver.press.escape();

        driver.assert.panelShown(false);
        driver.assert.tableFocused();
    });

    it('comes back once the game has been un-stuck and gets stuck again', async () => {
        driver.given.oneMoveFromStuck(DrawMode.One);
        await driver.when.created();
        driver.when.lastMovePlayed();
        driver.click.close();

        driver.when.undoneElsewhere();
        driver.when.lastMovePlayed();

        driver.assert.panelShown(true);
    });

    it('stops the clock while the game is stuck, and runs it again after an Undo out of it', async () => {
        driver.given.oneMoveFromStuckWithDeck();
        await driver.when.created();
        driver.when.drawn(1);
        driver.time.pass(CLOCK_TICK_MS * 2);
        driver.when.lastMovePlayed();

        driver.time.pass(CLOCK_TICK_MS * 5);
        driver.assert.timePlayed(CLOCK_TICK_MS * 2);
        driver.when.undoneElsewhere();
        driver.time.pass(CLOCK_TICK_MS * 3);

        driver.assert.timePlayed(CLOCK_TICK_MS * 5);
    });

    it('keeps the clock stopped and a closed panel closed while a card is taken down and put back', async () => {
        driver.given.oneMoveFromStuckWithAceHome();
        await driver.when.created();
        driver.when.lastMovePlayed();
        driver.click.close();

        driver.when.aceTakenDown();
        driver.time.pass(CLOCK_TICK_MS * 3);
        driver.when.acePutBack();
        driver.time.pass(CLOCK_TICK_MS * 3);

        driver.assert.timePlayed(0);
        driver.assert.panelShown(false);
    });

    it('shows straight away for a game resumed already stuck', async () => {
        driver.given.alreadyStuck();

        await driver.when.created();

        driver.assert.panelShown(true);
    });

    it('says nothing while the cards are still being dealt', async () => {
        driver.given.stuckFreshDeal();

        await driver.when.created();

        driver.assert.panelNeverAppeared();
    });

    it('says a fresh deal is stuck once it has landed, with nothing to undo', async () => {
        driver.given.stuckFreshDeal();
        await driver.when.created();

        driver.when.dealSettled();

        driver.assert.panelShown(true);
        driver.assert.undoEnabled(false);
        driver.assert.newGameFocused();
    });

    it('never shows for a won game', async () => {
        driver.given.won();

        await driver.when.created();

        driver.assert.panelShown(false);
    });
});
