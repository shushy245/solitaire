import { beforeEach, describe, it } from 'vitest';

import { DrawMode } from '~/engine/index.ts';

import { HudTestIds } from './hud.test-ids.ts';
import { HudDriver, makeHudDriver } from './hud.driver.tsx';

describe('Hud', () => {
    let driver: HudDriver;

    beforeEach(() => {
        driver = makeHudDriver();
    });

    describe('score, moves and time', () => {
        it('shows the score, the move count and the time played', async () => {
            driver.given.session((s) => s.withScore(25).asPlayed(7).withElapsedMs(125_000));

            await driver.when.created();

            driver.assert.stats({ score: '25', moves: '7', time: '2:05' });
        });

        it('keeps the clock running while a game is under way', async () => {
            driver.given.session((s) => s.asPlayed(2).withElapsedMs(10_000));
            await driver.when.created();

            driver.time.pass(3_000);

            driver.assert.time('0:13');
        });

        it('starts the clock at the moment of the first move, not at the tick before it', async () => {
            await driver.when.created();

            driver.time.pass(900);
            driver.when.cardDrawnElsewhere();
            driver.time.pass(600);

            driver.assert.time('0:00');
        });

        it('counts right up to the winning card, then stops', async () => {
            driver.given.session((s) => s.asReadyToAutoComplete().withElapsedMs(500));
            await driver.when.created();

            driver.click.autoComplete();
            driver.time.autoCompleteSteps(52);
            driver.time.pass(3_000);

            driver.assert.time('0:05');
        });

        it('keeps the time measured so far when the clock function is replaced mid-game', async () => {
            driver.given.session((s) => s.asPlayed(2));
            await driver.when.created();

            driver.time.pass(900);
            driver.when.rerenderedWithANewClock();
            driver.time.pass(200);
            driver.when.cardDrawnElsewhere();

            driver.assert.time('0:01');
        });

        it('leaves the clock at zero until the first move', async () => {
            await driver.when.created();

            driver.time.pass(5_000);

            driver.assert.time('0:00');
        });
    });

    describe('undo', () => {
        it('becomes unavailable once everything is undone', async () => {
            driver.given.session((s) => s.asPlayed(1));
            await driver.when.created();

            driver.click.undo();

            driver.assert.moves('0');
            driver.assert.undoEnabled(false);
        });

        it('is unavailable with nothing to undo', async () => {
            await driver.when.created();

            driver.assert.undoEnabled(false);
        });

        it('takes back the last move', async () => {
            driver.given.session((s) => s.asPlayed(4));
            await driver.when.created();

            driver.click.undo();

            driver.assert.moves('3');
            driver.assert.undoEnabled(true);
        });

        it('answers Ctrl+Z and Cmd+Z, once per key press', async () => {
            driver.given.session((s) => s.asPlayed(4));
            await driver.when.created();

            driver.press.undoShortcut({ modifier: 'meta' });
            driver.press.undoShortcut({ modifier: 'meta', isRepeat: true });

            driver.assert.moves('3');
        });

        it('answers Ctrl+Z too', async () => {
            driver.given.session((s) => s.asPlayed(4));
            await driver.when.created();

            driver.press.undoShortcut({ modifier: 'ctrl' });

            driver.assert.moves('3');
        });

        it('stops listening for the shortcut once gone', async () => {
            await driver.when.created();

            driver.when.unmounted();

            driver.assert.undoShortcutListenerRemoved();
        });
    });

    describe('new game', () => {
        it('deals straight away when no move has been made', async () => {
            await driver.when.created();

            driver.click.newGame();

            driver.assert.confirmShown(false);
            driver.assert.dealNumber(1);
        });

        it('asks first when a game is under way, and keeping it changes nothing', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.newGame();
            driver.assert.confirmShown(true);
            driver.click.keepPlaying();

            driver.assert.confirmShown(false);
            driver.assert.moves('5');
            driver.assert.dealNumber(0);
        });

        it('deals a new game once confirmed', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.newGame();
            driver.click.confirmLeave();

            driver.assert.confirmShown(false);
            driver.assert.moves('0');
            driver.assert.dealNumber(1);
        });

        it('closes the question with Escape', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.newGame();
            driver.press.escape();

            driver.assert.confirmShown(false);
            driver.assert.dealNumber(0);
        });

        it('hands focus back to the button that asked once the question is answered', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.newGame();
            driver.assert.focusOn(HudTestIds.ConfirmLeave);
            driver.click.keepPlaying();

            driver.assert.focusOn(HudTestIds.NewGame);
        });

        it('forgets the question once everything is undone, so a later move does not bring it back', async () => {
            driver.given.session((s) => s.asPlayed(1));
            await driver.when.created();

            driver.click.newGame();
            driver.click.undo();
            driver.when.cardDrawnElsewhere();

            driver.assert.confirmShown(false);
        });

        it('leaves focus where the player put it when the question lapses on its own', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.newGame();
            driver.when.focused(HudTestIds.Undo);
            driver.when.newGameStartedElsewhere();

            driver.assert.focusOn(HudTestIds.Undo);
        });

        it('drops the question if the game it was about is replaced elsewhere', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.newGame();
            driver.when.newGameStartedElsewhere();

            driver.assert.confirmShown(false);
        });
    });

    describe('turn one or turn three', () => {
        it('shows the current game’s mode', async () => {
            driver.given.session((s) => s.withDrawMode(DrawMode.Three));

            await driver.when.created();

            driver.assert.modeSelected(DrawMode.Three);
        });

        it('switching before any move redeals in the new mode', async () => {
            await driver.when.created();

            driver.click.mode(DrawMode.Three);

            driver.assert.modeSelected(DrawMode.Three);
            driver.assert.dealNumber(1);
        });

        it('switching mid-game asks first, and declining keeps the current mode', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.mode(DrawMode.Three);
            driver.assert.confirmShown(true);
            driver.click.keepPlaying();

            driver.assert.modeSelected(DrawMode.One);
            driver.assert.dealNumber(0);
        });

        it('switching mid-game and confirming deals in the new mode', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.mode(DrawMode.Three);
            driver.click.confirmLeave();

            driver.assert.modeSelected(DrawMode.Three);
            driver.assert.dealNumber(1);
        });

        it('choosing the mode already in play does nothing', async () => {
            driver.given.session((s) => s.asPlayed(5));
            await driver.when.created();

            driver.click.mode(DrawMode.One);

            driver.assert.confirmShown(false);
            driver.assert.dealNumber(0);
        });
    });

    describe('auto-complete', () => {
        it('is offered only once the game can finish itself', async () => {
            driver.given.session((s) => s.asPlayed(3));
            await driver.when.created();

            driver.assert.autoCompleteOffered(false);
        });

        it('sends the cards up one at a time and locks undo while it runs', async () => {
            driver.given.session((s) => s.asReadyToAutoComplete());
            await driver.when.created();

            driver.click.autoComplete();
            driver.time.autoCompleteSteps(3);

            driver.assert.score('30');
            driver.assert.undoEnabled(false);
            driver.assert.autoCompleteOffered(false);
        });

        it('stops when a new game is dealt mid-sweep', async () => {
            driver.given.session((s) => s.asReadyToAutoComplete());
            await driver.when.created();

            driver.click.autoComplete();
            driver.time.autoCompleteSteps(2);
            driver.click.newGame();
            driver.click.confirmLeave();
            driver.time.autoCompleteSteps(3);

            driver.assert.score('0');
            driver.assert.moves('0');
        });
    });
});
