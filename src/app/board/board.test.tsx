import { beforeEach, describe, it } from 'vitest';

import { DrawMode, Rank, Suit } from '~/engine/index.ts';

import { PileKind } from './layout.utils.ts';
import { HINT_SHOWN_MS } from '../hint/hint-timing.ts';
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

    it('ignores the second click of a double-click on the card the first click uncovered', async () => {
        driver.given.column({
            index: 1,
            cards: [
                { rank: Rank.Eight, suit: Suit.Diamonds, faceUp: false },
                { rank: Rank.Seven, suit: Suit.Spades },
            ],
        });
        driver.given.column({ index: 3, cards: [{ rank: Rank.Eight, suit: Suit.Hearts }] });
        driver.given.column({ index: 5, cards: [{ rank: Rank.Nine, suit: Suit.Clubs }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Seven, suit: Suit.Spades });
        await driver.click.cardRightAfterAnother({ rank: Rank.Eight, suit: Suit.Diamonds });

        driver.assert.cardIn({ card: { rank: Rank.Seven, suit: Suit.Spades }, pile: PileKind.Tableau, pileIndex: 3 });
        driver.assert.cardIn({ card: { rank: Rank.Eight, suit: Suit.Diamonds }, pile: PileKind.Tableau, pileIndex: 1 });
    });

    it('ignores a click on a card already home — no shake, no sound', async () => {
        driver.given.foundation({ index: 0, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        await driver.when.created();
        driver.when.dealt();

        await driver.click.card({ rank: Rank.Ace, suit: Suit.Hearts });

        driver.assert.shaking({ card: { rank: Rank.Ace, suit: Suit.Hearts }, isShaking: false });
        driver.assert.snapBackSounds(0);
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

    it('a hint lights the cards that would move and the card they land on, and goes out after a while', async () => {
        driver.given.column({
            index: 0,
            cards: [
                { rank: Rank.Four, suit: Suit.Clubs, faceUp: false },
                { rank: Rank.Nine, suit: Suit.Spades },
            ],
        });
        driver.given.column({ index: 1, cards: [{ rank: Rank.Ten, suit: Suit.Hearts }] });
        await driver.when.created();
        driver.when.dealt();

        driver.when.hintRequestedElsewhere();

        driver.assert.hinted({ card: { rank: Rank.Nine, suit: Suit.Spades }, isHinted: true });
        driver.assert.hinted({ card: { rank: Rank.Ten, suit: Suit.Hearts }, isHinted: true });
        driver.time.pass(HINT_SHOWN_MS);
        driver.assert.hinted({ card: { rank: Rank.Nine, suit: Suit.Spades }, isHinted: false });
    });

    it('a hint onto an empty pile lights that pile, and a draw hint lights the stock', async () => {
        driver.given.column({ index: 2, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        driver.given.stock([{ rank: Rank.Five, suit: Suit.Clubs }]);
        await driver.when.created();
        driver.when.dealt();

        driver.when.hintRequestedElsewhere();
        driver.assert.pileHinted({ pile: PileKind.Foundation, pileIndex: 0, isHinted: true });
        driver.assert.stockHinted(false);

        driver.when.hintRequestedElsewhere();
        driver.assert.stockHinted(true);
        driver.assert.pileHinted({ pile: PileKind.Foundation, pileIndex: 0, isHinted: false });
    });

    it('a move puts the hint out at once, and a later hint restarts its own timer', async () => {
        // A column move, not a card home: a loose Ace would fly home by itself after the draw.
        driver.given.column({
            index: 2,
            cards: [
                { rank: Rank.Four, suit: Suit.Clubs, faceUp: false },
                { rank: Rank.Nine, suit: Suit.Spades },
            ],
        });
        driver.given.column({ index: 3, cards: [{ rank: Rank.Ten, suit: Suit.Hearts }] });
        driver.given.stock([{ rank: Rank.Five, suit: Suit.Clubs }]);
        await driver.when.created();
        driver.when.dealt();

        driver.when.hintRequestedElsewhere();
        await driver.click.stock();
        driver.assert.hinted({ card: { rank: Rank.Nine, suit: Suit.Spades }, isHinted: false });

        driver.time.pass(HINT_SHOWN_MS - 500);
        driver.when.hintRequestedElsewhere();
        driver.time.pass(1000);
        driver.assert.hinted({ card: { rank: Rank.Nine, suit: Suit.Spades }, isHinted: true });
    });

    it('ignores a hint asked for mid-deal, so the first hint after the deal is still the best one', async () => {
        driver.given.column({ index: 2, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        driver.given.stock([{ rank: Rank.Five, suit: Suit.Clubs }]);
        await driver.when.created();

        driver.when.hintRequestedElsewhere();
        driver.assert.hinted({ card: { rank: Rank.Ace, suit: Suit.Hearts }, isHinted: false });

        driver.when.dealt();
        driver.when.hintRequestedElsewhere();
        driver.assert.pileHinted({ pile: PileKind.Foundation, pileIndex: 0, isHinted: true });
    });

    it('an undo does not bring back a hint that a move put out', async () => {
        driver.given.column({ index: 2, cards: [{ rank: Rank.Ace, suit: Suit.Hearts }] });
        driver.given.stock([{ rank: Rank.Five, suit: Suit.Clubs }]);
        await driver.when.created();
        driver.when.dealt();

        driver.when.hintRequestedElsewhere();
        await driver.click.stock();
        driver.when.undoneElsewhere();

        driver.assert.pileHinted({ pile: PileKind.Foundation, pileIndex: 0, isHinted: false });
        driver.when.hintRequestedElsewhere();
        driver.assert.pileHinted({ pile: PileKind.Foundation, pileIndex: 0, isHinted: true });
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

        driver.assert.cardLabel({ card: { rank: Rank.Queen, suit: Suit.Hearts }, label: 'Queen of hearts, column 1' });
        driver.assert.cardFaceDownAndUnlabelled({
            card: { rank: Rank.Two, suit: Suit.Clubs },
            label: 'Face-down card, column 1',
        });
    });

    // The cards sit in the page in a fixed order (by id), not table order, so the name carries the place.
    it('names where each card lies: column, waste, foundation or stock', async () => {
        driver.given.column({ index: 2, cards: [{ rank: Rank.Nine, suit: Suit.Spades }] });
        driver.given.waste([{ rank: Rank.Five, suit: Suit.Diamonds }]);
        driver.given.foundation({ index: 3, cards: [{ rank: Rank.Ace, suit: Suit.Clubs }] });
        driver.given.stock([{ rank: Rank.King, suit: Suit.Hearts }]);
        await driver.when.created();

        driver.assert.cardLabel({ card: { rank: Rank.Nine, suit: Suit.Spades }, label: 'Nine of spades, column 3' });
        driver.assert.cardLabel({ card: { rank: Rank.Five, suit: Suit.Diamonds }, label: 'Five of diamonds, waste' });
        driver.assert.cardLabel({ card: { rank: Rank.Ace, suit: Suit.Clubs }, label: 'Ace of clubs, foundation 4' });
        driver.assert.cardFaceDownAndUnlabelled({
            card: { rank: Rank.King, suit: Suit.Hearts },
            label: 'Face-down card, stock',
        });
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

    it('tells assistive tech the stock is not ready while the cards are dealt, and ready once they land', async () => {
        driver.given.dealtGame({ seed: 12, drawMode: DrawMode.One });
        await driver.when.created();
        driver.time.pass(STACK_HOLD_MS);

        driver.assert.stockReady(false);
        driver.when.dealt();

        driver.assert.stockReady(true);
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
