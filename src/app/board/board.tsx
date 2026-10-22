import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { makeDrawMove, MoveKind } from '~/engine/index.ts';

import { useGame } from '../game-provider.tsx';
import { BoardTestIds } from './board.test-ids.ts';
import { SoundKind } from '../sound/sound.utils.ts';
import { useHint } from '../hint/hint-provider.tsx';
import { useSound } from '../sound/sound-provider.tsx';
import { useCardDrag } from '../drag/use-card-drag.ts';
import { useLiftedCards } from './use-lifted-cards.ts';
import { useDealAnimation } from './use-deal-animation.ts';
import { joinClassNames } from '../../utils/join-class-names.ts';
import { isAutoCompleting, isDealUnstarted } from '../session/session.utils.ts';
import { isHintedCard, isHintedPile, isHintedStock } from '../hint/hint.utils.ts';
import { CardSlotModel, dealOrder, layoutCards, PileKind } from './layout.utils.ts';
import {
    boardHeightClassNames,
    cardLabel,
    CardProps,
    dealDelayClassName,
    hasClickMove,
    isHomeCard,
    isRepeatClick,
    LastPlayModel,
    makeLastPlay,
    isShakingCard,
    ShakeModel,
    inStableOrder,
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
    TABLE_FOCUS_ID,
} from './board.utils.ts';

import styles from './board.module.scss';

export const Board = (): JSX.Element => {
    const { session, dispatchMove, playCard } = useGame();
    const { game } = session;
    const slots = useMemo(() => layoutCards(game), [game]);
    const order = useMemo(() => dealOrder(slots), [slots]);
    const dealPhase = useDealAnimation({ dealKey: session.dealNumber, isFreshDeal: isDealUnstarted(session) });
    const { lifted, liftUntilLanded, handleLanded } = useLiftedCards(slots);
    const { play } = useSound();
    const handleSnapBack = useCallback((): void => {
        play(SoundKind.SnapBack);
    }, [play]);
    const canPlayCards = isSettled(dealPhase) && !isAutoCompleting(session);
    const { highlight, reportTableReady } = useHint();
    const isTableReady = isSettled(dealPhase);

    // Mid-deal the cards are still flying to their places: a hint asked for then is refused, not lit in passing.
    useEffect(() => {
        reportTableReady({ dealNumber: session.dealNumber, isReady: isTableReady });
    }, [isTableReady, session.dealNumber, reportTableReady]);
    const cards = inStableOrder(shownCardsFor({ phase: dealPhase, slots }));
    const boardElement = useRef<HTMLElement | undefined>(undefined);
    const { draggingIds, handleCardPointerDown, isDragClick } = useCardDrag({
        game,
        // No pick-up while dealing, nor while auto-complete moves the cards itself (a drop would be ignored).
        isEnabled: canPlayCards,
        dispatchMove,
        onRelease: liftUntilLanded,
        onSnapBack: handleSnapBack,
        boardRef: boardElement,
    });

    const [shake, setShake] = useState<ShakeModel | undefined>(undefined);
    // The card the latest click played, so the second click of a double-click on it does not play it on again.
    const lastPlay = useRef<LastPlayModel | undefined>(undefined);

    // A click plays the card's obvious move (resolved again by the reducer against the latest game); a card with
    // nothing to do shakes instead. The click a drag's release fires is not a play.
    const handleCardClick = useCallback(
        ({ cardId, detail }: { cardId: string; detail: number }): void => {
            if (!canPlayCards || isDragClick()) return;
            if (isRepeatClick({ cardId, detail, lastPlay: lastPlay.current })) return;
            if (isHomeCard({ state: game, cardId })) return;
            if (hasClickMove({ state: game, cardId })) {
                lastPlay.current = makeLastPlay({ state: game, cardId });
                playCard(cardId);

                return;
            }

            lastPlay.current = undefined;
            play(SoundKind.SnapBack);
            setShake({ cardId, game });
        },
        [canPlayCards, isDragClick, game, playCard, play],
    );

    const handleShakeEnd = useCallback((): void => {
        setShake(undefined);
    }, []);

    // React hands refs null on unmount; the board keeps undefined for "not mounted".
    const handleBoardRef: React.RefCallback<HTMLElement> = useCallback((element) => {
        boardElement.current = element ?? undefined;
    }, []);

    // A draw names the stock's top card, so a stale second click is rejected by the engine. Like the cards, the
    // stock waits for the deal to settle: a draw mid-deal would start the clock before the table is even laid out.
    const handleStockClick = (): void => {
        if (!isSettled(dealPhase)) return;

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
                id={TABLE_FOCUS_ID}
                aria-label={stockLabelFor(game)}
                aria-disabled={!isSettled(dealPhase)}
                className={joinClassNames(
                    styles.slot,
                    styles.stockButton,
                    isHintedStock(highlight) && styles.hinted,
                    ...slotClassNames({ slot: placeholderSlot(stockSlot), styles }),
                )}
                data-testid={BoardTestIds.Stock}
                data-hinted={isHintedStock(highlight)}
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
                        isHintedPile({ highlight, pile: placeholder }) && styles.hinted,
                        ...slotClassNames({ slot: placeholderSlot(placeholder), styles }),
                    )}
                    data-testid={BoardTestIds.Placeholder(placeholder)}
                    data-hinted={isHintedPile({ highlight, pile: placeholder })}
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
                    isShaking={isShakingCard({ shake, cardId: slot.card.id, game })}
                    isHinted={isHintedCard({ highlight, cardId: slot.card.id })}
                    onClick={handleCardClick}
                    onShakeEnd={handleShakeEnd}
                    onLanded={handleLanded}
                    onPointerDown={handleCardPointerDown}
                />
            ))}
        </section>
    );
};

// Memoised: the board re-renders on every clock tick, but a card only when its own props change.
const Card = memo(function Card({
    slot,
    shownSlot,
    isLifted,
    isDragging,
    isInteractive,
    delayClassName,
    isShaking,
    isHinted,
    onClick,
    onShakeEnd,
    onLanded,
    onPointerDown,
}: CardProps): JSX.Element {
    const { card } = slot;
    const isShownFaceUp = shownSlot.card.faceUp;

    // A face-down card has nothing to play, so a click on it is not a miss to shake at.
    const handleClick = (event: React.MouseEvent<HTMLDivElement>): void => {
        if (isInteractive && card.faceUp) onClick({ cardId: card.id, detail: event.detail });
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
            aria-label={cardLabel(slot)}
            className={joinClassNames(
                styles.card,
                ...slotClassNames({ slot: shownSlot, styles }),
                !isShownFaceUp && styles.faceDown,
                (shownSlot.pile === PileKind.Stock || !isInteractive) && styles.passive,
                isLifted && styles.lifted,
                isDragging && styles.dragging,
                isShaking && styles.shaking,
                isHinted && styles.hinted,
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
            data-shaking={isShaking}
            data-hinted={isHinted}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onTransitionEnd={handleTransitionEnd}
        >
            <div className={styles.inner} onAnimationEnd={onShakeEnd}>
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
