import { useMemo } from 'react';

import { makeDrawMove, MoveKind } from '~/engine/index.ts';

import { useGame } from '../game-provider.tsx';
import { useLiftedCards } from './use-lifted-cards.ts';
import { useDealAnimation } from './use-deal-animation.ts';
import { joinClassNames } from '../../utils/join-class-names.ts';
import { CardSlotModel, dealOrder, layoutCards, PileKind } from './layout.utils.ts';
import {
    BoardTestIds,
    boardHeightClassNames,
    cardLabel,
    dealDelayClassName,
    FACE_DOWN_LABEL,
    isCourtCard,
    isDealing,
    isRedSuit,
    pilePlaceholders,
    placeholderSlot,
    rankLabelMap,
    shownCardsFor,
    slotClassNames,
    stockLabelFor,
    suitGlyphMap,
} from './board.utils.ts';

import styles from './board.module.scss';

export const Board = (): JSX.Element => {
    const { session, dispatchMove, sendToFoundation } = useGame();
    const { game } = session;
    const slots = useMemo(() => layoutCards(game), [game]);
    const order = useMemo(() => dealOrder(slots), [slots]);
    const dealPhase = useDealAnimation(game.seed);
    const { lifted, handleLanded } = useLiftedCards(slots);
    const cards = shownCardsFor({ phase: dealPhase, slots });

    // A draw names the stock's top card, so a stale second click is rejected by the engine.
    const handleStockClick = (): void => {
        dispatchMove(makeDrawMove(game) ?? { kind: MoveKind.Recycle });
    };

    return (
        <section
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
                    ...slotClassNames({ slot: placeholderSlot({ column: 0, row: 0 }), styles }),
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
                    isLifted={lifted.has(slot.card.id)}
                    delayClassName={
                        isDealing(dealPhase)
                            ? dealDelayClassName({ order: order.get(slot.card.id), styles })
                            : undefined
                    }
                    onSendToFoundation={sendToFoundation}
                    onLanded={handleLanded}
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
    delayClassName: string | undefined;
    onSendToFoundation: (cardId: string) => void;
    onLanded: (cardId: string) => void;
};

const Card = ({ slot, shownSlot, isLifted, delayClassName, onSendToFoundation, onLanded }: CardProps): JSX.Element => {
    const { card } = slot;
    const isShownFaceUp = shownSlot.card.faceUp;

    const handleDoubleClick = (): void => {
        onSendToFoundation(card.id);
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
                shownSlot.pile === PileKind.Stock && styles.inStock,
                isLifted && styles.lifted,
                delayClassName,
            )}
            data-testid={BoardTestIds.Card(card.id)}
            data-pile={slot.pile}
            data-pile-index={slot.pileIndex}
            data-face={card.faceUp ? 'up' : 'down'}
            data-lifted={isLifted}
            onDoubleClick={handleDoubleClick}
            onTransitionEnd={handleTransitionEnd}
        >
            <div className={styles.inner}>
                {isShownFaceUp && <CardFront card={card} />}
                <div className={styles.back} />
            </div>
        </div>
    );
};

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
