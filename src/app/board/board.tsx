import { memo, useCallback, useMemo, useRef } from 'react';

import { makeDrawMove, MoveKind } from '~/engine/index.ts';

import { useGame } from '../game-provider.tsx';
import { BoardTestIds } from './board.test-ids.ts';
import { SoundKind } from '../sound/sound.utils.ts';
import { useSound } from '../sound/sound-provider.tsx';
import { useCardDrag } from '../drag/use-card-drag.ts';
import { useLiftedCards } from './use-lifted-cards.ts';
import { useDealAnimation } from './use-deal-animation.ts';
import { isDealUnstarted } from '../session/session.utils.ts';
import { joinClassNames } from '../../utils/join-class-names.ts';
import { CardSlotModel, dealOrder, layoutCards, PileKind } from './layout.utils.ts';
import {
    boardHeightClassNames,
    cardLabel,
    dealDelayClassName,
    FACE_DOWN_LABEL,
    isCourtCard,
    isDealing,
    isSettled,
    isRedSuit,
    pilePlaceholders,
    placeholderSlot,
    rankLabelMap,
    shownCardsFor,
    slotClassNames,
    stockLabelFor,
    stockSlot,
    suitGlyphMap,
} from './board.utils.ts';

import styles from './board.module.scss';

export const Board = (): JSX.Element => {
    const { session, dispatchMove, sendToFoundation } = useGame();
    const { game } = session;
    const slots = useMemo(() => layoutCards(game), [game]);
    const order = useMemo(() => dealOrder(slots), [slots]);
    const dealPhase = useDealAnimation({ dealKey: session.dealNumber, isFreshDeal: isDealUnstarted(session) });
    const { lifted, liftUntilLanded, handleLanded } = useLiftedCards(slots);
    const { play } = useSound();
    const handleSnapBack = useCallback((): void => {
        play(SoundKind.SnapBack);
    }, [play]);
    const cards = shownCardsFor({ phase: dealPhase, slots });
    const boardElement = useRef<HTMLElement | undefined>(undefined);
    const { draggingIds, handleCardPointerDown } = useCardDrag({
        game,
        isEnabled: isSettled(dealPhase),
        dispatchMove,
        onRelease: liftUntilLanded,
        onSnapBack: handleSnapBack,
        boardRef: boardElement,
    });

    // React hands refs null on unmount; the board keeps undefined for "not mounted".
    const handleBoardRef: React.RefCallback<HTMLElement> = useCallback((element) => {
        boardElement.current = element ?? undefined;
    }, []);

    // A draw names the stock's top card, so a stale second click is rejected by the engine.
    const handleStockClick = (): void => {
        dispatchMove(makeDrawMove(game) ?? { kind: MoveKind.Recycle });
    };

    return (
        <section
            ref={handleBoardRef}
            aria-label="Card table"
            className={joinClassNames(styles.board, ...boardHeightClassNames({ slots, styles }))}
            data-testid={BoardTestIds.Board}
            data-deal-phase={dealPhase}
        >
            <button
                type="button"
                aria-label={stockLabelFor(game)}
                className={joinClassNames(
                    styles.slot,
                    styles.stockButton,
                    ...slotClassNames({ slot: placeholderSlot(stockSlot), styles }),
                )}
                data-testid={BoardTestIds.Stock}
                onClick={handleStockClick}
            >
                <span aria-hidden className={styles.recycleMark}>
                    {`↻`}
                </span>
            </button>
            {pilePlaceholders.map((placeholder) => (
                <span
                    key={placeholder.key}
                    aria-hidden
                    className={joinClassNames(
                        styles.slot,
                        styles.placeholder,
                        ...slotClassNames({ slot: placeholderSlot(placeholder), styles }),
                    )}
                    data-pile={placeholder.pile}
                    data-pile-index={placeholder.pileIndex}
                />
            ))}
            {cards.map(({ slot, shown }) => (
                <Card
                    key={slot.card.id}
                    slot={slot}
                    shownSlot={shown}
                    isLifted={lifted.has(slot.card.id) || (isDealing(dealPhase) && order.has(slot.card.id))}
                    isDragging={draggingIds.has(slot.card.id)}
                    isInteractive={isSettled(dealPhase)}
                    delayClassName={
                        isDealing(dealPhase)
                            ? dealDelayClassName({ order: order.get(slot.card.id), styles })
                            : undefined
                    }
                    onSendToFoundation={sendToFoundation}
                    onLanded={handleLanded}
                    onPointerDown={handleCardPointerDown}
                />
            ))}
        </section>
    );
};

type CardProps = {
    // Where the card really is (drives data attributes and its accessible name) …
    slot: CardSlotModel;
    // … and where it is drawn right now (differs only before the deal).
    shownSlot: CardSlotModel;
    isLifted: boolean;
    isDragging: boolean;
    isInteractive: boolean;
    delayClassName: string | undefined;
    onSendToFoundation: (cardId: string) => void;
    onLanded: (cardId: string) => void;
    onPointerDown: (args: { cardId: string; event: React.PointerEvent }) => void;
};

// Memoised: the board re-renders on every clock tick, but a card only when its own props change.
const Card = memo(function Card({
    slot,
    shownSlot,
    isLifted,
    isDragging,
    isInteractive,
    delayClassName,
    onSendToFoundation,
    onLanded,
    onPointerDown,
}: CardProps): JSX.Element {
    const { card } = slot;
    const isShownFaceUp = shownSlot.card.faceUp;

    const handleDoubleClick = (): void => {
        if (isInteractive) onSendToFoundation(card.id);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
        onPointerDown({ cardId: card.id, event });
    };

    const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>): void => {
        if (event.target === event.currentTarget && event.propertyName === 'transform') onLanded(card.id);
    };

    return (
        <div
            role="img"
            aria-label={card.faceUp ? cardLabel(card) : FACE_DOWN_LABEL}
            className={joinClassNames(
                styles.card,
                ...slotClassNames({ slot: shownSlot, styles }),
                !isShownFaceUp && styles.faceDown,
                (shownSlot.pile === PileKind.Stock || !isInteractive) && styles.passive,
                isLifted && styles.lifted,
                isDragging && styles.dragging,
                shownSlot.isBuried && styles.buried,
                delayClassName,
            )}
            data-testid={BoardTestIds.Card(card.id)}
            data-pile={slot.pile}
            data-pile-index={slot.pileIndex}
            data-face={card.faceUp ? 'up' : 'down'}
            data-lifted={isLifted}
            data-dragging={isDragging}
            data-card-id={card.id}
            onDoubleClick={handleDoubleClick}
            onPointerDown={handlePointerDown}
            onTransitionEnd={handleTransitionEnd}
        >
            <div className={styles.inner}>
                {isShownFaceUp && <CardFront card={card} />}
                <div className={styles.back} />
            </div>
        </div>
    );
});

const CardFront = ({ card }: { card: CardSlotModel['card'] }): JSX.Element => {
    const rank = rankLabelMap[card.rank];
    const glyph = suitGlyphMap[card.suit];

    return (
        <div aria-hidden className={joinClassNames(styles.front, isRedSuit(card.suit) && styles.red)}>
            <span className={styles.index}>
                <span className={styles.rank}>{rank}</span>
                <span className={styles.suit}>{glyph}</span>
            </span>
            <span className={joinClassNames(styles.center, isCourtCard(card.rank) && styles.court)}>
                {isCourtCard(card.rank) ? rank : glyph}
            </span>
            <span className={joinClassNames(styles.index, styles.indexFlipped)}>
                <span className={styles.rank}>{rank}</span>
                <span className={styles.suit}>{glyph}</span>
            </span>
        </div>
    );
};
