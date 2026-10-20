import { beforeEach, describe, it } from 'vitest';

import { Rank, Suit } from '~/engine/index.ts';

import { PileKind } from '../board/layout.utils.ts';
import { BoardDriver, makeBoardDriver } from '../board/board.driver.tsx';

const redTen = { rank: Rank.Ten, suit: Suit.Hearts };
const blackNine = { rank: Rank.Nine, suit: Suit.Spades };
const hidden = { rank: Rank.Two, suit: Suit.Clubs, faceUp: false };
const aceOfHearts = { rank: Rank.Ace, suit: Suit.Hearts };

describe('dragging cards', () => {
    let driver: BoardDriver;

    beforeEach(() => {
        driver = makeBoardDriver();
    });

    it('picks up a face-up card together with the cards above it once the pointer travels', async () => {
        driver.given.column({ index: 0, cards: [hidden, redTen, blackNine] });
        await driver.when.created();
        driver.when.dealt();

        driver.pointer.press(redTen);
        driver.pointer.moveBy({ dx: 30, dy: 40 });

        driver.assert.dragging({ card: redTen, isDragging: true });
        driver.assert.dragging({ card: blackNine, isDragging: true });
    });

    it('treats a press with only a little jitter as a click, so double-click still sends a card up', async () => {
        driver.given.column({ index: 4, cards: [aceOfHearts] });
        await driver.when.created();
        driver.when.dealt();

        driver.pointer.press(aceOfHearts);
        driver.pointer.moveBy({ dx: 2, dy: 1 });
        driver.pointer.release();
        await driver.doubleClick.card(aceOfHearts);

        driver.assert.dragging({ card: aceOfHearts, isDragging: false });
        driver.assert.cardIn({ card: aceOfHearts, pile: PileKind.Foundation, pileIndex: 0 });
    });

    it('never picks up a face-down card', async () => {
        driver.given.column({ index: 0, cards: [hidden, redTen] });
        await driver.when.created();
        driver.when.dealt();

        driver.pointer.press(hidden);
        driver.pointer.moveBy({ dx: 30, dy: 40 });

        driver.assert.dragging({ card: hidden, isDragging: false });
    });

    it('cannot pick up cards while they are still being dealt', async () => {
        driver.given.column({ index: 0, cards: [redTen] });
        await driver.when.created();

        driver.pointer.press(redTen);
        driver.pointer.moveBy({ dx: 30, dy: 40 });

        driver.assert.dragging({ card: redTen, isDragging: false });
    });

    it('snaps the cards back when dropped on bare felt', async () => {
        driver.given.column({ index: 0, cards: [redTen, blackNine] });
        await driver.when.created();
        driver.when.dealt();

        driver.pointer.press(redTen);
        driver.pointer.moveBy({ dx: 300, dy: 400 });
        driver.pointer.release();

        driver.assert.dragging({ card: redTen, isDragging: false });
        driver.assert.cardIn({ card: redTen, pile: PileKind.Tableau, pileIndex: 0 });
        driver.assert.cardIn({ card: blackNine, pile: PileKind.Tableau, pileIndex: 0 });
    });

    it('ends the drag when the pointer is cancelled (e.g. the browser takes over the touch)', async () => {
        driver.given.column({ index: 0, cards: [redTen] });
        await driver.when.created();
        driver.when.dealt();

        driver.pointer.press(redTen);
        driver.pointer.moveBy({ dx: 30, dy: 40 });
        driver.pointer.cancel();

        driver.assert.dragging({ card: redTen, isDragging: false });
        driver.assert.pointerListenersDetached();
    });

    it('lets go of the window listeners if the table unmounts mid-drag', async () => {
        driver.given.column({ index: 0, cards: [redTen] });
        await driver.when.created();
        driver.when.dealt();

        driver.pointer.press(redTen);
        driver.pointer.moveBy({ dx: 30, dy: 40 });
        driver.when.unmounted();

        driver.assert.pointerListenersDetached();
    });
});
