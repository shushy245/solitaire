import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { makeHookProbe } from '~/testkit/hook-probe.tsx';
import { aCard, aGameState } from '~/testkit/builders/index.ts';
import { FakeSoundPlayer } from '~/testkit/fakes/fake-sound.ts';
import { discardSave, fakeNow, fixedSeed } from '~/testkit/provider-fakes.ts';
import { CardModel, DrawMode, GameStateModel, Rank, Suit, topCard } from '~/engine/index.ts';

import { Board } from './board.tsx';
import { PileKind } from './layout.utils.ts';
import { BoardTestIds } from './board.test-ids.ts';
import { SoundKind } from '../sound/sound.utils.ts';
import { SoundProvider } from '../sound/sound-provider.tsx';
import { GameProvider, useGame } from '../game-provider.tsx';
import { HintProvider, useHint } from '../hint/hint-provider.tsx';
import { DEAL_TOTAL_MS, DealPhase, STACK_HOLD_MS } from './board.utils.ts';
import { DealProgress, makeSession, SessionModel } from '../session/session.utils.ts';

type CardName = { rank: Rank; suit: Suit };
type CardScenario = CardName & { faceUp?: boolean };

export type BoardDriver = {
    given: {
        dealtGame: (args: { seed: number; drawMode: DrawMode }) => void;
        column: (args: { index: number; cards: readonly CardScenario[] }) => void;
        waste: (cards: readonly CardName[]) => void;
        foundation: (args: { index: number; cards: readonly CardName[] }) => void;
        emptyStockWithWaste: () => void;
        stock: (cards: readonly CardName[]) => void;
        readyToAutoCompleteAfterMoves: (moves: number) => void;
    };
    when: {
        created: () => Promise<void>;
        dealt: () => void;
        unmounted: () => void;
        undoneElsewhere: () => void;
        autoCompleteStartedElsewhere: () => void;
        hintRequestedElsewhere: () => void;
    };
    pointer: {
        press: (card: CardName) => void;
        moveBy: (args: { dx: number; dy: number }) => void;
        hoverBy: (args: { dx: number; dy: number }) => void;
        release: () => void;
        cancel: () => void;
    };
    click: {
        stock: () => Promise<void>;
        card: (card: CardName) => Promise<void>;
        // A click soon after another nearby: the browser counts it as the second of a double-click (detail 2).
        cardRightAfterAnother: (card: CardName) => Promise<void>;
    };
    // The browser's sequence for a double-click: two clicks (the second with detail 2), then dblclick.
    doubleClick: { card: (card: CardName) => Promise<void> };
    fire: { landed: (card: CardName) => void; shakeEnded: (card: CardName) => void };
    remember: { cardOrder: () => void };
    time: { pass: (ms: number) => void };
    assert: {
        cardCount: (count: number) => void;
        cardIn: (args: { card: CardName; pile: PileKind; pileIndex: number }) => void;
        dealtStockTopNowOnWaste: () => void;
        dealtStockTopStillOnStock: () => void;
        cardLabel: (args: { card: CardName; label: string }) => void;
        cardFaceDownAndUnlabelled: (args: { card: CardName; label: string }) => void;
        stockLabel: (label: string) => void;
        dealPhase: (phase: DealPhase) => void;
        lifted: (args: { card: CardName; isLifted: boolean }) => void;
        dealtStockTopLifted: (isLifted: boolean) => void;
        dragging: (args: { card: CardName; isDragging: boolean }) => void;
        shaking: (args: { card: CardName; isShaking: boolean }) => void;
        pointerListenersDetached: () => void;
        snapBackSounds: (count: number) => void;
        cardOrderUnchanged: () => void;
        hinted: (args: { card: CardName; isHinted: boolean }) => void;
        pileHinted: (args: { pile: PileKind; pileIndex: number; isHinted: boolean }) => void;
        stockHinted: (isHinted: boolean) => void;
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
    const scenario: {
        builder: ReturnType<typeof aGameState>;
        dealt: SessionModel | undefined;
        progress: DealProgress;
    } = { builder: aGameState(), dealt: undefined, progress: DealProgress.Unstarted };

    const rendered: { unmount: () => void } = { unmount: () => undefined };
    const sound = new FakeSoundPlayer();
    const pointer = { x: 100, y: 100 };
    const listenerSpies = {
        add: vi.spyOn(window, 'addEventListener'),
        remove: vi.spyOn(window, 'removeEventListener'),
    };
    const pointerHandlers = (spy: typeof listenerSpies.add): unknown[] =>
        spy.mock.calls.filter(([type]) => pointerEvents.has(type)).map(([, handler]) => handler);

    // Stands in for another part of the app (e.g. the HUD's undo shortcut) acting on the game.
    const elsewhereGame = makeHookProbe({ useValue: useGame, driver: 'board' });
    const elsewhereHint = makeHookProbe({ useValue: useHint, driver: 'board' });

    const remembered: { cardOrder: readonly (string | null)[] } = { cardOrder: [] };
    const renderedCardOrder = (): (string | null)[] =>
        screen.getAllByTestId(BoardTestIds.AnyCard).map((element) => element.getAttribute('data-card-id'));

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

        return { ...makeSession({ seed: game.seed, drawMode: game.drawMode }), game, progress: scenario.progress };
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
            foundation: ({ index, cards }) => {
                scenario.builder = scenario.builder.withFoundation({ index, cards: cards.map(buildCard) });
            },
            emptyStockWithWaste: () => {
                scenario.builder = scenario.builder
                    .withStock([])
                    .withWaste([buildCard({ rank: Rank.Five, suit: Suit.Clubs })]);
            },
            // All 52 cards face-up down the tableau — far more than a fresh deal puts there.
            readyToAutoCompleteAfterMoves: (moves) => {
                scenario.builder = scenario.builder.asReadyToAutoComplete().withMoves(moves);
                scenario.progress = DealProgress.Started;
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
                    <SoundProvider player={sound} initiallyMuted={false} saveMuted={discardSave}>
                        <GameProvider
                            createInitialSession={initialSession}
                            seedSource={fixedSeed}
                            now={fakeNow}
                            saveSession={discardSave}
                        >
                            <HintProvider>
                                <Board />
                                <elsewhereGame.Probe />
                                <elsewhereHint.Probe />
                            </HintProvider>
                        </GameProvider>
                    </SoundProvider>,
                ).unmount;
            },
            dealt: () => {
                passTime(STACK_HOLD_MS);
                passTime(DEAL_TOTAL_MS);
            },
            unmounted: () => {
                rendered.unmount();
            },
            autoCompleteStartedElsewhere: () => {
                const game = elsewhereGame.read();

                act(() => {
                    game.startAutoComplete();
                });
            },
            hintRequestedElsewhere: () => {
                const hint = elsewhereHint.read();

                act(() => {
                    hint.showHint();
                });
            },
            undoneElsewhere: () => {
                const game = elsewhereGame.read();

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
            card: async (card) => {
                fireEvent.click(cardElement(card), { detail: 1 });
            },
            cardRightAfterAnother: async (card) => {
                fireEvent.click(cardElement(card), { detail: 2 });
            },
        },
        doubleClick: {
            card: async (card) => {
                fireEvent.click(cardElement(card), { detail: 1 });
                fireEvent.click(cardElement(card), { detail: 2 });
                fireEvent.doubleClick(cardElement(card), { detail: 2 });
            },
        },
        fire: {
            landed: (card) => {
                fireEvent.transitionEnd(cardElement(card), { propertyName: 'transform' });
            },
            shakeEnded: (card) => {
                const inner = cardElement(card).firstElementChild ?? undefined;

                if (inner === undefined)
                    throw new Error('board driver: shakeEnded found no card face to end the shake on');
                fireEvent.animationEnd(inner);
            },
        },
        remember: {
            cardOrder: () => {
                remembered.cardOrder = renderedCardOrder();
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
            dealtStockTopStillOnStock: () => {
                expect(screen.getByTestId(BoardTestIds.Card(dealtStockTop().id))).toHaveAttribute(
                    'data-pile',
                    PileKind.Stock,
                );
            },
            cardLabel: ({ card, label }) => {
                expect(cardElement(card)).toHaveAccessibleName(label);
            },
            cardFaceDownAndUnlabelled: ({ card, label }) => {
                expect(cardElement(card)).toHaveAttribute('data-face', 'down');
                expect(cardElement(card)).toHaveAccessibleName(label);
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
            shaking: ({ card, isShaking }) => {
                expect(cardElement(card)).toHaveAttribute('data-shaking', String(isShaking));
            },
            dragging: ({ card, isDragging }) => {
                expect(cardElement(card)).toHaveAttribute('data-dragging', String(isDragging));
            },
            hinted: ({ card, isHinted }) => {
                expect(cardElement(card)).toHaveAttribute('data-hinted', String(isHinted));
            },
            pileHinted: ({ pile, pileIndex, isHinted }) => {
                expect(screen.getByTestId(BoardTestIds.Placeholder({ pile, pileIndex }))).toHaveAttribute(
                    'data-hinted',
                    String(isHinted),
                );
            },
            stockHinted: (isHinted) => {
                expect(screen.getByTestId(BoardTestIds.Stock)).toHaveAttribute('data-hinted', String(isHinted));
            },
            // A card element moved within the DOM loses its transform transition, so it would jump, not fly.
            cardOrderUnchanged: () => {
                expect(renderedCardOrder()).toEqual(remembered.cardOrder);
            },
            snapBackSounds: (count) => {
                expect(sound.played.filter((played) => played === SoundKind.SnapBack)).toHaveLength(count);
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
