import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { FakeSoundPlayer } from '~/testkit/fakes/fake-sound.ts';
import { aCard, aGameState, aSession } from '~/testkit/builders/index.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';
import { DrawMode, makeDrawMove, MoveKind, Rank, Suit } from '~/engine/index.ts';

import { GameOver } from './game-over.tsx';
import { Board } from '../board/board.tsx';
import { HintProvider } from '../hint/hint-provider.tsx';
import { GameOverTestIds } from './game-over.test-ids.ts';
import { SessionModel } from '../session/session.utils.ts';
import { SoundProvider } from '../sound/sound-provider.tsx';
import { GameContextValue } from '../game-provider.utils.ts';
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

const stuck = aGameState()
    .withColumn({ index: 0, cards: [hiddenTwo, blackFive] })
    .build();

export type GameOverDriver = {
    given: {
        oneMoveFromStuck: (drawMode: DrawMode) => void;
        oneMoveFromStuckWithDeck: () => void;
        alreadyStuck: () => void;
        stuckFreshDeal: () => void;
        won: () => void;
    };
    when: {
        created: () => Promise<void>;
        dealSettled: () => void;
        lastMovePlayed: () => void;
        drawn: (times: number) => void;
        undoneElsewhere: () => void;
    };
    click: { undo: () => void; newGame: () => void; close: () => void };
    assert: {
        panelShown: (isShown: boolean) => void;
        panelNeverAppeared: () => void;
        undoFocused: () => void;
        newGameFocused: () => void;
        undoEnabled: (isEnabled: boolean) => void;
        movesMade: (moves: number) => void;
        freshDealIn: (drawMode: DrawMode) => void;
    };
};

// The board renders beside the panel: it tells the hint provider when the deal has settled.
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
    const outside: { game: GameContextValue | undefined } = { game: undefined };

    const ElsewhereInTheApp = (): undefined => {
        outside.game = useGame();

        return undefined;
    };

    const game = (): GameContextValue => {
        if (outside.game === undefined) throw new Error('game-over driver: call when.created() first');

        return outside.game;
    };

    const prefersReducedMotion = (): boolean => false;

    return {
        given: {
            oneMoveFromStuck: (drawMode) => {
                scenario.session = aSession().withGame(oneMoveFromStuck).withDrawMode(drawMode).asStarted().build();
            },
            oneMoveFromStuckWithDeck: () => {
                scenario.session = aSession().withGame(oneMoveFromStuckWithDeck).asStarted().build();
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
                                    <ElsewhereInTheApp />
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
            // The HUD's Undo and Ctrl+Z go through the game's plain undo.
            undoneElsewhere: () => {
                act(() => {
                    game().undo();
                });
            },
        },
        click: {
            undo: () => {
                fireEvent.click(screen.getByTestId(GameOverTestIds.Undo));
            },
            newGame: () => {
                fireEvent.click(screen.getByTestId(GameOverTestIds.NewGame));
            },
            close: () => {
                fireEvent.click(screen.getByRole('button', { name: 'Close' }));
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
            undoEnabled: (isEnabled) => {
                if (isEnabled) expect(screen.getByTestId(GameOverTestIds.Undo)).toBeEnabled();
                else expect(screen.getByTestId(GameOverTestIds.Undo)).toBeDisabled();
            },
            movesMade: (moves) => {
                expect(game().session.game.moves).toBe(moves);
            },
            freshDealIn: (drawMode) => {
                expect(game().session.game.moves).toBe(0);
                expect(game().session.game.drawMode).toBe(drawMode);
            },
        },
    };
};
