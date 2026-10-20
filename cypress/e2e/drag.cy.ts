import { boardDriver } from '../support/drivers/board.driver.ts';

describe('dragging a card in a real browser', () => {
    it('drops the Jack of diamonds onto the black Queen in another column', () => {
        boardDriver.given.dealWithOpeningColumnMove();

        boardDriver.drag.cardOntoCard({ cardId: 'diamonds-11', ontoCardId: 'clubs-12' });

        boardDriver.assert.cardInTableauColumn({ cardId: 'diamonds-11', column: 4 });
    });
});
