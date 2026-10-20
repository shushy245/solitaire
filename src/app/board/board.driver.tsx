import { expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { aCard, aGameState } from '~/testkit/builders/index.ts';
import { CardModel, DrawMode, GameStateModel, Rank, Suit, topCard } from '~/engine/index.ts';

import { Board } from './board.tsx';
import { PileKind } from './layout.utils.ts';
import { GameProvider } from '../game-provider.tsx';
import { makeSession, SessionModel } from '../session/session.utils.ts';
import { BoardTestIds, DEAL_TOTAL_MS, DealPhase, STACK_HOLD_MS } from './board.utils.ts';

type CardName = { rank: Rank; suit: Suit };
type CardScenario = CardName & { faceUp?: boolean };

export type BoardDriver = {
    given: {
        dealtGame: (args: { seed: number; drawMode: DrawMode }) => void;
        column: (args: { index: number; cards: readonly CardScenario[] }) => void;
        waste: (cards: readonly CardName[]) => void;
        emptyStockWithWaste: () => void;
    };
    when: { created: () => Promise<void>; dealt: () => void };
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
    };
};

const fixedSeed = (): number => 1;

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
        },
        when: {
            created: async () => {
                const session = sessionUnderTest();
                const initialSession = (): SessionModel => session;
                render(
                    <GameProvider createInitialSession={initialSession} seedSource={fixedSeed}>
                        <Board />
                    </GameProvider>,
                );
            },
            dealt: () => {
                passTime(STACK_HOLD_MS);
                passTime(DEAL_TOTAL_MS);
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
            dealtStockTopLifted: (isLifted) => {
                expect(screen.getByTestId(BoardTestIds.Card(dealtStockTop().id))).toHaveAttribute(
                    'data-lifted',
                    String(isLifted),
                );
            },
        },
    };
};
