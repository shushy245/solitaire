import { beforeEach, describe, it } from 'vitest';

import { DrawMode, Rank, Suit } from '~/engine/index.ts';

import { PileKind } from './layout.utils.ts';
import { BoardDriver, makeBoardDriver } from './board.driver.tsx';
import { DEAL_TOTAL_MS, DealPhase, STACK_HOLD_MS } from './board.utils.ts';

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

    it('keeps every card in its place in the page while cards move, so a drawn card flies instead of jumping', async () => {
        driver.given.dealtGame({ seed: 12, drawMode: DrawMode.One });
        await driver.when.created();
        driver.when.dealt();
        driver.remember.cardOrder();

        await driver.click.stock();
        await driver.click.stock();

        driver.assert.cardOrderUnchanged();
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

    it('clicking a playable top card sends it to a foundation', async () => {
        driver.given.column({ index: 4, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Ace, suit: Suit.Hearts });

        driver.assert.cardIn({ card: { rank: Rank.Ace, suit: Suit.Hearts }, pile: PileKind.Foundation, pileIndex: 0 });
    });

    it('clicking a card that cannot go up moves it onto the first column that takes it', async () => {
        driver.given.column({ index: 1, cards: [{ rank: Rank.Seven, suit: Suit.Spades }] });
        driver.given.column({ index: 3, cards: [{ rank: Rank.Eight, suit: Suit.Hearts }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Seven, suit: Suit.Spades });

        driver.assert.cardIn({ card: { rank: Rank.Seven, suit: Suit.Spades }, pile: PileKind.Tableau, pileIndex: 3 });
    });

    it('clicking a card with no move shakes it, plays the snap-back sound and leaves it where it is', async () => {
        driver.given.column({ index: 2, cards: [{ rank: Rank.Seven, suit: Suit.Spades }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Seven, suit: Suit.Spades });

        driver.assert.cardIn({ card: { rank: Rank.Seven, suit: Suit.Spades }, pile: PileKind.Tableau, pileIndex: 2 });
        driver.assert.shaking({ card: { rank: Rank.Seven, suit: Suit.Spades }, isShaking: true });
        driver.assert.snapBackSounds(1);
    });

    it('plays a double-clicked card once, so it never hops on to a second column', async () => {
        driver.given.column({ index: 1, cards: [{ rank: Rank.Seven, suit: Suit.Spades }] });
        driver.given.column({ index: 3, cards: [{ rank: Rank.Eight, suit: Suit.Hearts }] });
        driver.given.column({ index: 5, cards: [{ rank: Rank.Eight, suit: Suit.Diamonds }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.doubleClick.card({ rank: Rank.Seven, suit: Suit.Spades });

        driver.assert.cardIn({ card: { rank: Rank.Seven, suit: Suit.Spades }, pile: PileKind.Tableau, pileIndex: 3 });
    });

    it('plays quick clicks on different cards, though the browser counts the second as part of a double-click', async () => {
        driver.given.column({ index: 1, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        driver.given.column({ index: 2, cards: [{ rank: Rank.Ace, suit: Suit.Spades }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Ace, suit: Suit.Hearts });
        await driver.click.cardRightAfterAnother({ rank: Rank.Ace, suit: Suit.Spades });

        driver.assert.cardIn({ card: { rank: Rank.Ace, suit: Suit.Spades }, pile: PileKind.Foundation, pileIndex: 1 });
    });

    it('ignores a click on a face-down card — no shake, no sound', async () => {
        driver.given.column({
            index: 0,
            cards: [
                { rank: Rank.Two, suit: Suit.Clubs, faceUp: false },
                { rank: Rank.Queen, suit: Suit.Hearts },
            ],
        });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Two, suit: Suit.Clubs });

        driver.assert.shaking({ card: { rank: Rank.Two, suit: Suit.Clubs }, isShaking: false });
        driver.assert.snapBackSounds(0);
    });

    it('stops shaking once the shake has played, and once the game moves on', async () => {
        driver.given.column({ index: 2, cards: [{ rank: Rank.Seven, suit: Suit.Spades }] });
        driver.given.column({ index: 4, cards: [{ rank: Rank.Six, suit: Suit.Spades }] });
        driver.given.stock([{ rank: Rank.Five, suit: Suit.Clubs }]);
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Seven, suit: Suit.Spades });
        driver.fire.shakeEnded({ rank: Rank.Seven, suit: Suit.Spades });
        driver.assert.shaking({ card: { rank: Rank.Seven, suit: Suit.Spades }, isShaking: false });

        await driver.click.card({ rank: Rank.Six, suit: Suit.Spades });
        await driver.click.stock();
        driver.assert.shaking({ card: { rank: Rank.Six, suit: Suit.Spades }, isShaking: false });
    });

    it('ignores clicks on cards while they are still being dealt', async () => {
        driver.given.column({ index: 4, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        await driver.when.created();

        await driver.click.card({ rank: Rank.Ace, suit: Suit.Hearts });

        driver.assert.cardIn({ card: { rank: Rank.Ace, suit: Suit.Hearts }, pile: PileKind.Tableau, pileIndex: 4 });
        driver.assert.shaking({ card: { rank: Rank.Ace, suit: Suit.Hearts }, isShaking: false });
    });

    it('ignores clicks on cards while auto-complete is sending them home', async () => {
        driver.given.readyToAutoCompleteAfterMoves(96);
        await driver.when.created();
        driver.when.autoCompleteStartedElsewhere();

        await driver.click.card({ rank: Rank.Ten, suit: Suit.Hearts });

        driver.assert.shaking({ card: { rank: Rank.Ten, suit: Suit.Hearts }, isShaking: false });
        driver.assert.snapBackSounds(0);
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
        driver.time.pass(STACK_HOLD_MS);

        driver.assert.dealPhase(DealPhase.Dealing);
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
