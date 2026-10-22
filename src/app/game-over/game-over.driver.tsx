import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { makeHookProbe } from '~/testkit/hook-probe.tsx';
import { FakeSoundPlayer } from '~/testkit/fakes/fake-sound.ts';
import { aCard, aGameState, aSession } from '~/testkit/builders/index.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';
import { DrawMode, makeDrawMove, MoveKind, Rank, Suit } from '~/engine/index.ts';

import { GameOver } from './game-over.tsx';
import { Board } from '../board/board.tsx';
import { HintProvider } from '../hint/hint-provider.tsx';
import { BoardTestIds } from '../board/board.test-ids.ts';
import { GameOverTestIds } from './game-over.test-ids.ts';
import { SessionModel } from '../session/session.utils.ts';
import { SoundProvider } from '../sound/sound-provider.tsx';
import { GameProvider, useGame } from '../game-provider.tsx';
import { MotionProvider } from '../motion/motion-provider.tsx';
import { DEAL_TOTAL_MS, STACK_HOLD_MS } from '../board/board.utils.ts';

// A deal whose first position is already stuck in turn 3 (found by search over seeds).
const STUCK_DEAL_SEED = 22;

const hiddenTwo = aCard().withRank(Rank.Two).withSuit(Suit.Hearts).asFaceDown().build();
const blackFive = aCard().withRank(Rank.Five).withSuit(Suit.Spades).build();
const redSix = aCard().withRank(Rank.Six).withSuit(Suit.Hearts).build();

// The deck is spent; the black five can move onto the red six once, turning the two over — and then nothing plays.
const oneMoveFromStuck = aGameState()
    .withColumn({ index: 0, cards: [hiddenTwo, blackFive] })
    .withColumn({ index: 1, cards: [redSix] })
    .build();

// The same, with two cards left in the deck that never play: drawing them keeps the game stuck.
const deadStock = [Rank.Nine, Rank.Nine].map((rank, i) =>
    aCard()
        .withRank(rank)
        .withSuit(i === 0 ? Suit.Clubs : Suit.Diamonds)
        .asFaceDown()
        .build(),
);
const oneMoveFromStuckWithDeck = aGameState()
    .withColumn({ index: 0, cards: [hiddenTwo, blackFive] })
    .withColumn({ index: 1, cards: [redSix] })
    .withStock(deadStock)
    .build();

// The same, with the Ace of diamonds home: it can come down onto the two of spades and go back up, stuck or not.
const aceOfDiamonds = aCard().withRank(Rank.Ace).withSuit(Suit.Diamonds).build();
const twoOfSpades = aCard().withRank(Rank.Two).withSuit(Suit.Spades).build();
const oneMoveFromStuckWithAceHome = aGameState()
    .withFoundation({ index: 0, cards: [aceOfDiamonds] })
    .withColumn({ index: 0, cards: [hiddenTwo, blackFive] })
    .withColumn({ index: 1, cards: [redSix] })
    .withColumn({
        index: 2,
        cards: [aCard().withRank(Rank.Three).withSuit(Suit.Clubs).asFaceDown().build(), twoOfSpades],
    })
    .build();

const stuck = aGameState()
    .withColumn({ index: 0, cards: [hiddenTwo, blackFive] })
    .build();

export type GameOverDriver = {
    given: {
        oneMoveFromStuck: (drawMode: DrawMode) => void;
        oneMoveFromStuckWithDeck: () => void;
        oneMoveFromStuckWithAceHome: () => void;
        alreadyStuck: () => void;
        stuckFreshDeal: () => void;
        won: () => void;
    };
    when: {
        created: () => Promise<void>;
        dealSettled: () => void;
        lastMovePlayed: () => void;
        drawn: (times: number) => void;
        aceTakenDown: () => void;
        acePutBack: () => void;
        undoneElsewhere: () => void;
    };
    click: { undo: () => void; newGame: () => void; close: () => void };
    press: { escape: () => void };
    time: { pass: (ms: number) => void };
    assert: {
        panelShown: (isShown: boolean) => void;
        panelNeverAppeared: () => void;
        undoFocused: () => void;
        newGameFocused: () => void;
        tableFocused: () => void;
        undoEnabled: (isEnabled: boolean) => void;
        movesMade: (moves: number) => void;
        timePlayed: (ms: number) => void;
        freshDealIn: (drawMode: DrawMode) => void;
    };
};

// The board renders beside the panel: it tells the hint provider when the deal has settled.
const clickFocused = (testId: string): void => {
    const button = screen.getByTestId(testId);
    button.focus();
    fireEvent.click(button);
};

export const makeGameOverDriver = (): GameOverDriver => {
    vi.useFakeTimers();
    const scenario: { session: SessionModel } = { session: aSession().build() };
    // Catches a panel that comes and goes between two assertions (one commit is enough to grab focus).
    const sightings = { panel: 0 };
    const panelSelector = `[data-testid="${GameOverTestIds.Panel}"]`;
    const holdsPanel = (node: Node): boolean =>
        node instanceof HTMLElement && (node.matches(panelSelector) || node.querySelectorAll(panelSelector).length > 0);
    // Reads what was added, not the page now: React may have removed the panel again before this runs.
    const observer = new MutationObserver((records) => {
        sightings.panel += records.flatMap((record) => [...record.addedNodes]).filter(holdsPanel).length;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const elsewhere = makeHookProbe({ useValue: useGame, driver: 'game-over' });
    const game = elsewhere.read;

    const prefersReducedMotion = (): boolean => false;

    return {
        given: {
            oneMoveFromStuck: (drawMode) => {
                scenario.session = aSession().withGame(oneMoveFromStuck).withDrawMode(drawMode).asStarted().build();
            },
            oneMoveFromStuckWithDeck: () => {
                scenario.session = aSession().withGame(oneMoveFromStuckWithDeck).asStarted().build();
            },
            oneMoveFromStuckWithAceHome: () => {
                scenario.session = aSession().withGame(oneMoveFromStuckWithAceHome).asStarted().build();
            },
            alreadyStuck: () => {
                scenario.session = aSession().withGame(stuck).asStarted().build();
            },
            stuckFreshDeal: () => {
                scenario.session = aSession().withDeal({ seed: STUCK_DEAL_SEED, drawMode: DrawMode.Three }).build();
            },
            won: () => {
                scenario.session = aSession().asWon().build();
            },
        },
        when: {
            created: async () => {
                const session = scenario.session;
                const initialSession = (): SessionModel => session;
                render(
                    <GameProvider
                        createInitialSession={initialSession}
                        seedSource={fixedSeed}
                        now={fakeNow}
                        saveSession={discardSave}
                    >
                        <SoundProvider player={new FakeSoundPlayer()} initiallyMuted={false} saveMuted={discardSave}>
                            <MotionProvider prefersReducedMotion={prefersReducedMotion}>
                                <HintProvider>
                                    <Board />
                                    <GameOver />
                                    <elsewhere.Probe />
                                </HintProvider>
                            </MotionProvider>
                        </SoundProvider>
                    </GameProvider>,
                );
            },
            // One step per deal phase: React schedules each phase's timer when it renders the one before.
            dealSettled: () => {
                [STACK_HOLD_MS, DEAL_TOTAL_MS].forEach((ms) => {
                    act(() => {
                        vi.advanceTimersByTime(ms);
                    });
                });
            },
            lastMovePlayed: () => {
                act(() => {
                    game().dispatchMove({ kind: MoveKind.TableauToTableau, cardId: blackFive.id, from: 0, to: 1 });
                });
            },
            drawn: (times) => {
                Array.from({ length: times }).forEach(() => {
                    const draw = makeDrawMove(game().session.game);

                    if (draw === undefined) throw new Error('game-over driver: nothing left to draw');
                    act(() => {
                        game().dispatchMove(draw);
                    });
                });
            },
            aceTakenDown: () => {
                act(() => {
                    game().dispatchMove({
                        kind: MoveKind.FoundationToTableau,
                        cardId: aceOfDiamonds.id,
                        from: 0,
                        to: 2,
                    });
                });
            },
            acePutBack: () => {
                act(() => {
                    game().dispatchMove({
                        kind: MoveKind.TableauToFoundation,
                        cardId: aceOfDiamonds.id,
                        from: 2,
                        to: 0,
                    });
                });
            },
            // The HUD's Undo and Ctrl+Z go through the game's plain undo.
            undoneElsewhere: () => {
                act(() => {
                    game().undo();
                });
            },
        },
        // A mouse click focuses the button in Chrome, so the panel goes away with focus inside it.
        click: {
            undo: () => {
                clickFocused(GameOverTestIds.Undo);
            },
            newGame: () => {
                clickFocused(GameOverTestIds.NewGame);
            },
            close: () => {
                clickFocused(GameOverTestIds.Close);
            },
        },
        press: {
            escape: () => {
                const focused = document.activeElement ?? document.body;
                fireEvent.keyDown(focused, { key: 'Escape' });
            },
        },
        time: {
            pass: (ms) => {
                act(() => {
                    vi.advanceTimersByTime(ms);
                });
            },
        },
        assert: {
            panelShown: (isShown) => {
                // A named region, not a dialog: it is not modal — the table stays live behind it.
                if (isShown) expect(screen.getByRole('region', { name: 'No more moves' })).toBeVisible();
                else expect(screen.queryByTestId(GameOverTestIds.Panel)).not.toBeInTheDocument();
            },
            panelNeverAppeared: () => {
                expect(sightings.panel).toBe(0);
            },
            undoFocused: () => {
                expect(screen.getByTestId(GameOverTestIds.Undo)).toHaveFocus();
            },
            newGameFocused: () => {
                expect(screen.getByTestId(GameOverTestIds.NewGame)).toHaveFocus();
            },
            tableFocused: () => {
                expect(screen.getByTestId(BoardTestIds.Stock)).toHaveFocus();
            },
            undoEnabled: (isEnabled) => {
                if (isEnabled) expect(screen.getByTestId(GameOverTestIds.Undo)).toBeEnabled();
                else expect(screen.getByTestId(GameOverTestIds.Undo)).toBeDisabled();
            },
            movesMade: (moves) => {
                expect(game().session.game.moves).toBe(moves);
            },
            timePlayed: (ms) => {
                expect(game().session.elapsedMs).toBe(ms);
            },
            freshDealIn: (drawMode) => {
                expect(game().session.game.moves).toBe(0);
                expect(game().session.game.drawMode).toBe(drawMode);
            },
        },
    };
};
