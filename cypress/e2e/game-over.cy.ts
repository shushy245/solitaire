import { gameOverDriver } from '../support/drivers/game-over.driver.ts';

describe('"No more moves" in a real browser', () => {
    it('shows once a deal stuck from the start has landed; New game deals in turn 3 and the panel goes', () => {
        gameOverDriver.given.dealStuckFromTheStart();

        gameOverDriver.assert.panelShown();

        gameOverDriver.when.newGameChosen();

        gameOverDriver.assert.panelGone();
        gameOverDriver.assert.freshDealInTurnThree();
    });

    it('shows with Undo once a move leaves the game stuck; Undo closes it and takes the move back', () => {
        gameOverDriver.given.dealOneMoveFromStuck();

        gameOverDriver.when.lastMovePlayed();

        gameOverDriver.assert.panelShown();
        gameOverDriver.assert.undoEnabled();

        gameOverDriver.when.undoChosen();

        gameOverDriver.assert.panelGone();
        gameOverDriver.assert.lastMoveTakenBack();
    });
});
