import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { aCard, aGameState } from '~/testkit/builders/index.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';
import { CardModel, DrawMode, GameStateModel, Rank, Suit, topCard } from '~/engine/index.ts';

import { Board } from './board.tsx';
import { PileKind } from './layout.utils.ts';
import { BoardTestIds } from './board.test-ids.ts';
import { GameProvider, useGame } from '../game-provider.tsx';
import { GameContextValue } from '../game-provider.utils.ts';
import { makeSession, SessionModel } from '../session/session.utils.ts';
import { DEAL_TOTAL_MS, DealPhase, STACK_HOLD_MS } from './board.utils.ts';

type CardName = { rank: Rank; suit: Suit };
type CardScenario = CardName & { faceUp?: boolean };

export type BoardDriver = {
    given: {
        dealtGame: (args: { seed: number; drawMode: DrawMode }) => void;
        column: (args: { index: number; cards: readonly CardScenario[] }) => void;
        waste: (cards: readonly CardName[]) => void;
        emptyStockWithWaste: () => void;
        stock: (cards: readonly CardName[]) => void;
        readyToAutoCompleteAfterMoves: (moves: number) => void;
    };
    when: { created: () => Promise<void>; dealt: () => void; unmounted: () => void; undoneElsewhere: () => void };
    pointer: {
        press: (card: CardName) => void;
        moveBy: (args: { dx: number; dy: number }) => void;
        hoverBy: (args: { dx: number; dy: number }) => void;
        release: () => void;
        cancel: () => void;
    };
    click: { stock: () => Promise<void> };
    doubleClick: { card: (card: CardName) => Promise<void> };
    fire: { landed: (card: CardName) => void };
    time: { pass: (ms: number) => void };
    assert: {
        cardCount: (count: number) => void;
        cardIn: (args: { card: CardName; pile: PileKind; pileIndex: number }) => void;
        dealtStockTopNowOnWaste: () => void;
        cardLabel: (args: { card: CardName; label: string }) => void;
        cardFaceDownAndUnlabelled: (card: CardName) => void;
        stockLabel: (label: string) => void;
        dealPhase: (phase: DealPhase) => void;
        lifted: (args: { card: CardName; isLifted: boolean }) => void;
        dealtStockTopLifted: (isLifted: boolean) => void;
        dragging: (args: { card: CardName; isDragging: boolean }) => void;
        pointerListenersDetached: () => void;
    };
};

const POINTER_ID = 1;
const pointerEvents = new Set(['pointermove', 'pointerup', 'pointercancel']);

// Advances the fake clock inside act; one step per scheduled phase, as React schedules the next timer on render.
const passTime = (ms: number): void => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
};

const buildCard = ({ rank, suit, faceUp = true }: CardScenario): CardModel => {
    const builder = aCard().withRank(rank).withSuit(suit);

    return faceUp ? builder.build() : builder.asFaceDown().build();
};

export const makeBoardDriver = (): BoardDriver => {
    // The board animates on timers (deal, clock), so every board test runs on a fake clock. Events are
    // fired synchronously: user-event's async wrapper waits on a real setTimeout that a fake clock never runs.
    vi.useFakeTimers();
    const scenario: { builder: ReturnType<typeof aGameState>; dealt: SessionModel | undefined } = {
        builder: aGameState(),
        dealt: undefined,
    };

    const rendered: { unmount: () => void } = { unmount: () => undefined };
    const outside: { game: GameContextValue | undefined } = { game: undefined };
    const pointer = { x: 100, y: 100 };
    const listenerSpies = {
        add: vi.spyOn(window, 'addEventListener'),
        remove: vi.spyOn(window, 'removeEventListener'),
    };
    const pointerHandlers = (spy: typeof listenerSpies.add): unknown[] =>
        spy.mock.calls.filter(([type]) => pointerEvents.has(type)).map(([, handler]) => handler);

    // Stands in for another part of the app (e.g. the HUD's undo shortcut) acting on the game.
    const ElsewhereInTheApp = (): undefined => {
        outside.game = useGame();

        return undefined;
    };

    const cardElement = ({ rank, suit }: CardName): HTMLElement =>
        screen.getByTestId(BoardTestIds.Card(buildCard({ rank, suit }).id));

    const dealtStockTop = (): CardModel => {
        const top = scenario.dealt === undefined ? undefined : topCard(scenario.dealt.game.stock);

        if (top === undefined)
            throw new Error('board driver: dealtStockTop needs given.dealtGame with a non-empty stock');

        return top;
    };

    const sessionUnderTest = (): SessionModel => {
        if (scenario.dealt !== undefined) return scenario.dealt;

        const game: GameStateModel = scenario.builder.build();

        return { ...makeSession({ seed: game.seed, drawMode: game.drawMode }), game };
    };

    return {
        given: {
            dealtGame: ({ seed, drawMode }) => {
                scenario.dealt = makeSession({ seed, drawMode });
            },
            column: ({ index, cards }) => {
                scenario.builder = scenario.builder.withColumn({ index, cards: cards.map(buildCard) });
            },
            waste: (cards) => {
                scenario.builder = scenario.builder.withWaste(cards.map(buildCard));
            },
            emptyStockWithWaste: () => {
                scenario.builder = scenario.builder
                    .withStock([])
                    .withWaste([buildCard({ rank: Rank.Five, suit: Suit.Clubs })]);
            },
            // All 52 cards face-up down the tableau — far more than a fresh deal puts there.
            readyToAutoCompleteAfterMoves: (moves) => {
                scenario.builder = scenario.builder.asReadyToAutoComplete().withMoves(moves);
            },
            stock: (cards) => {
                scenario.builder = scenario.builder.withStock(
                    cards.map((card) => buildCard({ ...card, faceUp: false })),
                );
            },
        },
        when: {
            created: async () => {
                const session = sessionUnderTest();
                const initialSession = (): SessionModel => session;
                rendered.unmount = render(
                    <GameProvider
                        createInitialSession={initialSession}
                        seedSource={fixedSeed}
                        now={fakeNow}
                        saveSession={discardSave}
                    >
                        <Board />
                        <ElsewhereInTheApp />
                    </GameProvider>,
                ).unmount;
            },
            dealt: () => {
                passTime(STACK_HOLD_MS);
                passTime(DEAL_TOTAL_MS);
            },
            unmounted: () => {
                rendered.unmount();
            },
            undoneElsewhere: () => {
                const game = outside.game;

                if (game === undefined) throw new Error('board driver: undoneElsewhere needs when.created first');

                act(() => {
                    game.undo();
                });
            },
        },
        pointer: {
            press: (card) => {
                fireEvent.pointerDown(cardElement(card), {
                    pointerId: POINTER_ID,
                    button: 0,
                    clientX: pointer.x,
                    clientY: pointer.y,
                });
            },
            moveBy: ({ dx, dy }) => {
                pointer.x += dx;
                pointer.y += dy;
                fireEvent.pointerMove(window, {
                    pointerId: POINTER_ID,
                    buttons: 1,
                    clientX: pointer.x,
                    clientY: pointer.y,
                });
            },
            // The mouse moves with no button held — what follows a pointerup the page never received.
            hoverBy: ({ dx, dy }) => {
                pointer.x += dx;
                pointer.y += dy;
                fireEvent.pointerMove(window, {
                    pointerId: POINTER_ID,
                    buttons: 0,
                    clientX: pointer.x,
                    clientY: pointer.y,
                });
            },
            release: () => {
                fireEvent.pointerUp(window, { pointerId: POINTER_ID, clientX: pointer.x, clientY: pointer.y });
            },
            cancel: () => {
                fireEvent.pointerCancel(window, { pointerId: POINTER_ID });
            },
        },
        click: {
            stock: async () => {
                fireEvent.click(screen.getByTestId(BoardTestIds.Stock));
            },
        },
        doubleClick: {
            card: async (card) => {
                fireEvent.doubleClick(cardElement(card));
            },
        },
        fire: {
            landed: (card) => {
                fireEvent.transitionEnd(cardElement(card), { propertyName: 'transform' });
            },
        },
        time: {
            pass: passTime,
        },
        assert: {
            cardCount: (count) => {
                expect(screen.getAllByTestId(BoardTestIds.AnyCard)).toHaveLength(count);
            },
            cardIn: ({ card, pile, pileIndex }) => {
                expect(cardElement(card)).toHaveAttribute('data-pile', pile);
                expect(cardElement(card)).toHaveAttribute('data-pile-index', String(pileIndex));
            },
            dealtStockTopNowOnWaste: () => {
                const element = screen.getByTestId(BoardTestIds.Card(dealtStockTop().id));
                expect(element).toHaveAttribute('data-pile', PileKind.Waste);
                expect(element).toHaveAttribute('data-face', 'up');
            },
            cardLabel: ({ card, label }) => {
                expect(cardElement(card)).toHaveAccessibleName(label);
            },
            cardFaceDownAndUnlabelled: (card) => {
                expect(cardElement(card)).toHaveAttribute('data-face', 'down');
                expect(cardElement(card)).toHaveAccessibleName('Face-down card');
                expect(within(cardElement(card)).queryByText(/[♠♥♦♣]/)).not.toBeInTheDocument();
            },
            stockLabel: (label) => {
                expect(screen.getByTestId(BoardTestIds.Stock)).toHaveAccessibleName(label);
            },
            dealPhase: (phase) => {
                expect(screen.getByTestId(BoardTestIds.Board)).toHaveAttribute('data-deal-phase', phase);
            },
            lifted: ({ card, isLifted }) => {
                expect(cardElement(card)).toHaveAttribute('data-lifted', String(isLifted));
            },
            dragging: ({ card, isDragging }) => {
                expect(cardElement(card)).toHaveAttribute('data-dragging', String(isDragging));
            },
            pointerListenersDetached: () => {
                const added = pointerHandlers(listenerSpies.add);

                expect(added).not.toHaveLength(0);
                expect(pointerHandlers(listenerSpies.remove)).toEqual(expect.arrayContaining(added));
            },
            dealtStockTopLifted: (isLifted) => {
                expect(screen.getByTestId(BoardTestIds.Card(dealtStockTop().id))).toHaveAttribute(
                    'data-lifted',
                    String(isLifted),
                );
            },
        },
    };
};
