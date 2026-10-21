import { beforeEach, describe, it } from 'vitest';

import { DrawMode, Rank, Suit } from '~/engine/index.ts';

import { PileKind } from './layout.utils.ts';
import { DEAL_TOTAL_MS, DealPhase } from './board.utils.ts';
import { BoardDriver, makeBoardDriver } from './board.driver.tsx';

describe('Board', () => {
    let driver: BoardDriver;

    beforeEach(() => {
        driver = makeBoardDriver();
    });

    it('lays out all 52 cards', async () => {
        driver.given.dealtGame({ seed: 12, drawMode: DrawMode.One });

        await driver.when.created();

        driver.assert.cardCount(52);
    });

    it('clicking the stock turns its top card onto the waste', async () => {
        driver.given.dealtGame({ seed: 12, drawMode: DrawMode.One });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.stock();

        driver.assert.dealtStockTopNowOnWaste();
    });

    it('offers to draw while the stock has cards and to recycle once it is empty', async () => {
        driver.given.emptyStockWithWaste();
        await driver.when.created();
        driver.when.dealt();

        driver.assert.stockLabel('Recycle the waste into the stock');

        await driver.click.stock();

        driver.assert.cardIn({ card: { rank: Rank.Five, suit: Suit.Clubs }, pile: PileKind.Stock, pileIndex: 0 });
        driver.assert.stockLabel('Draw from the stock');
    });

    it('double-clicking a playable top card sends it to a foundation', async () => {
        driver.given.column({ index: 4, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.doubleClick.card({ rank: Rank.Ace, suit: Suit.Hearts });

        driver.assert.cardIn({ card: { rank: Rank.Ace, suit: Suit.Hearts }, pile: PileKind.Foundation, pileIndex: 0 });
    });

    it('double-clicking a card that cannot go up leaves it where it is', async () => {
        driver.given.column({ index: 2, cards: [{ rank: Rank.Seven, suit: Suit.Spades }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.doubleClick.card({ rank: Rank.Seven, suit: Suit.Spades });

        driver.assert.cardIn({ card: { rank: Rank.Seven, suit: Suit.Spades }, pile: PileKind.Tableau, pileIndex: 2 });
    });

    it('ignores double-clicks while the cards are still being dealt', async () => {
        driver.given.column({ index: 4, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        await driver.when.created();

        await driver.doubleClick.card({ rank: Rank.Ace, suit: Suit.Hearts });

        driver.assert.cardIn({ card: { rank: Rank.Ace, suit: Suit.Hearts }, pile: PileKind.Tableau, pileIndex: 4 });
    });

    it('names face-up cards and hides face-down ones from assistive tech', async () => {
        driver.given.column({
            index: 0,
            cards: [
                { rank: Rank.Two, suit: Suit.Clubs, faceUp: false },
                { rank: Rank.Queen, suit: Suit.Hearts },
            ],
        });
        await driver.when.created();

        driver.assert.cardLabel({ card: { rank: Rank.Queen, suit: Suit.Hearts }, label: 'Queen of hearts' });
        driver.assert.cardFaceDownAndUnlabelled({ rank: Rank.Two, suit: Suit.Clubs });
    });

    it('ignores clicks on the stock while the cards are still being dealt', async () => {
        driver.given.dealtGame({ seed: 12, drawMode: DrawMode.One });
        await driver.when.created();

        await driver.click.stock();
        driver.when.dealt();

        driver.assert.dealtStockTopStillOnStock();
    });

    it('lifts a card above the table while it flies, and settles it when it lands', async () => {
        driver.given.dealtGame({ seed: 12, drawMode: DrawMode.One });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.stock();

        driver.assert.dealtStockTopLifted(true);
    });

    it('drops the lift once the card has landed', async () => {
        driver.given.waste([{ rank: Rank.Ace, suit: Suit.Spades }]);
        await driver.when.created();
        driver.when.dealt();
        await driver.doubleClick.card({ rank: Rank.Ace, suit: Suit.Spades });
        driver.assert.lifted({ card: { rank: Rank.Ace, suit: Suit.Spades }, isLifted: true });

        driver.fire.landed({ rank: Rank.Ace, suit: Suit.Spades });

        driver.assert.lifted({ card: { rank: Rank.Ace, suit: Suit.Spades }, isLifted: false });
    });

    it('shows a game resumed mid-play where it was left, without dealing it again', async () => {
        driver.given.readyToAutoCompleteAfterMoves(96);

        await driver.when.created();

        driver.assert.dealPhase(DealPhase.Settled);
        driver.assert.cardIn({ card: { rank: Rank.Ace, suit: Suit.Spades }, pile: PileKind.Tableau, pileIndex: 1 });
    });

    it('deals from a stack on the stock out to the table, then settles', async () => {
        driver.given.dealtGame({ seed: 3, drawMode: DrawMode.Three });
        await driver.when.created();

        driver.assert.dealPhase(DealPhase.Stacked);
        driver.time.pass(100);
        driver.assert.dealPhase(DealPhase.Dealing);
        driver.time.pass(DEAL_TOTAL_MS);
        driver.assert.dealPhase(DealPhase.Settled);
    });
});
