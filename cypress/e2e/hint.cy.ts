import { hintDriver } from '../support/drivers/hint.driver.ts';
import { gameOverDriver } from '../support/drivers/game-over.driver.ts';

const jackOntoQueen = ['diamonds-11', 'clubs-12'];
const fourOntoFive = ['hearts-4', 'clubs-5'];

describe('hints in a real browser', () => {
    it('the Hint button rings a card and the card it goes onto, then the ring goes out after about two seconds', () => {
        hintDriver.given.dealWithTwoColumnHints();

        hintDriver.when.hintButtonPressed();

        hintDriver.assert.ringed(jackOntoQueen);
        hintDriver.assert.ringGoesOutAfterAboutTwoSeconds('diamonds-11');
    });

    it('pressing H again shows the next hint', () => {
        hintDriver.given.dealWithTwoColumnHints();

        hintDriver.when.hintKeyPressed();
        hintDriver.when.hintKeyPressed();

        hintDriver.assert.ringed(fourOntoFive);
        hintDriver.assert.notRinged(jackOntoQueen);
    });

    it('says "No moves left" in a game where no progress is possible, without moving the table', () => {
        gameOverDriver.given.dealStuckFromTheStart();
        hintDriver.remember.boardTop();

        hintDriver.when.hintButtonPressed();

        hintDriver.assert.boardNotMovedWhileNoMovesSaid();
    });
});
