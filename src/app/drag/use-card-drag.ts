import { MutableRefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { GameStateModel, Move } from '~/engine/index.ts';

import { pileRefFromElement } from './drag-dom.utils.ts';
import {
    DragPickupModel,
    findDropTarget,
    hasMovedBeyondClick,
    legalDropMove,
    offsetRect,
    PileRectModel,
    pickUp,
    RectModel,
    unionRects,
} from './drag.utils.ts';

// startRect is the lead card's box at pick-up: the drop box is computed from it plus the pointer travel,
// never measured at release, when the card may still be easing toward the pointer.
type ActiveDrag = {
    pickup: DragPickupModel;
    pointerId: number;
    startX: number;
    startY: number;
    startRect: RectModel;
    isDragging: boolean;
};

type CardDragResult = {
    // Cards following the pointer right now.
    draggingIds: ReadonlySet<string>;
    // Cards released and flying to their target (or back) — kept lifted until they land.
    releasedIds: ReadonlySet<string>;
    handleCardPointerDown: (args: { cardId: string; event: React.PointerEvent }) => void;
    handleReleasedLanded: (cardId: string) => void;
};

const NONE: ReadonlySet<string> = new Set();

const toRect = (element: Element): RectModel => {
    const { left, top, right, bottom } = element.getBoundingClientRect();

    return { left, top, right, bottom };
};

const cardElements = ({ board, cardIds }: { board: HTMLElement; cardIds: readonly string[] }): HTMLElement[] =>
    cardIds.flatMap((id) => {
        const element = board.querySelector(`[data-card-id="${id}"]`);

        return element instanceof HTMLElement ? [element] : [];
    });

// Every pile's on-screen area: its outline plus the cards in it, minus the cards being dragged.
const measurePiles = ({
    board,
    draggedIds,
}: {
    board: HTMLElement;
    draggedIds: readonly string[];
}): PileRectModel[] => {
    const groups = [...board.querySelectorAll('[data-pile]')]
        .filter((element) => !draggedIds.includes(element.getAttribute('data-card-id') ?? ''))
        .reduce<Map<string, { ref: NonNullable<ReturnType<typeof pileRefFromElement>>; rects: RectModel[] }>>(
            (acc, element) => {
                const ref = pileRefFromElement(element);

                if (ref === undefined) return acc;

                const key = `${ref.pile}:${ref.pileIndex}`;
                const group = acc.get(key) ?? { ref, rects: [] };

                return new Map(acc).set(key, { ref, rects: [...group.rects, toRect(element)] });
            },
            new Map(),
        );

    return [...groups.values()].map(({ ref, rects }) => ({ ...ref, rect: unionRects(rects) }));
};

const setDragOffset = ({ elements, dx, dy }: { elements: readonly HTMLElement[]; dx: number; dy: number }): void => {
    elements.forEach((element) => {
        element.style.setProperty('--drag-x', `${dx}px`);
        element.style.setProperty('--drag-y', `${dy}px`);
    });
};

const clearDragOffset = (elements: readonly HTMLElement[]): void => {
    elements.forEach((element) => {
        element.style.removeProperty('--drag-x');
        element.style.removeProperty('--drag-y');
    });
};

// Pointer-driven drag of a card or run. The offset is written straight to the cards' CSS variables on
// every pointermove (no React render per frame); on release the offset is cleared in the same task as
// the move is dispatched, so the CSS transition flies the cards from where they were dropped.
export const useCardDrag = ({
    game,
    dealNumber,
    isEnabled,
    dispatchMove,
    boardRef,
}: {
    game: GameStateModel;
    dealNumber: number;
    isEnabled: boolean;
    dispatchMove: (move: Move) => void;
    boardRef: MutableRefObject<HTMLElement | undefined>;
}): CardDragResult => {
    const [draggingIds, setDraggingIds] = useState<ReadonlySet<string>>(NONE);
    const [releasedIds, setReleasedIds] = useState<ReadonlySet<string>>(NONE);
    const active = useRef<ActiveDrag | undefined>(undefined);
    const latestGame = useRef(game);
    const detach = useRef<() => void>(() => undefined);

    // Pointer-up reads the newest game, never the one captured at pointer-down.
    useLayoutEffect(() => {
        latestGame.current = game;
    }, [game]);

    const draggedElements = useCallback((): HTMLElement[] => {
        const board = boardRef.current;
        const drag = active.current;

        return board === undefined || drag === undefined ? [] : cardElements({ board, cardIds: drag.pickup.cardIds });
    }, [boardRef]);

    const endDrag = useCallback((): void => {
        const drag = active.current;

        detach.current();
        clearDragOffset(draggedElements());
        active.current = undefined;
        setDraggingIds(NONE);
        setReleasedIds(drag !== undefined && drag.isDragging ? new Set(drag.pickup.cardIds) : NONE);
    }, [draggedElements]);

    const handleMove = useCallback(
        (event: PointerEvent): void => {
            const drag = active.current;

            if (drag === undefined || event.pointerId !== drag.pointerId) return;

            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;

            if (!drag.isDragging && !hasMovedBeyondClick({ dx, dy })) return;
            if (!drag.isDragging) {
                active.current = { ...drag, isDragging: true };
                setDraggingIds(new Set(drag.pickup.cardIds));
            }

            setDragOffset({ elements: draggedElements(), dx, dy });
        },
        [draggedElements],
    );

    const handleUp = useCallback(
        (event: PointerEvent): void => {
            const drag = active.current;
            const board = boardRef.current;

            if (drag === undefined || event.pointerId !== drag.pointerId) return;
            if (!drag.isDragging || board === undefined) {
                endDrag();

                return;
            }

            const target = findDropTarget({
                dragged: offsetRect({
                    rect: drag.startRect,
                    dx: event.clientX - drag.startX,
                    dy: event.clientY - drag.startY,
                }),
                piles: measurePiles({ board, draggedIds: drag.pickup.cardIds }),
                source: drag.pickup.source,
            });
            const move =
                target === undefined
                    ? undefined
                    : legalDropMove({ game: latestGame.current, pickup: drag.pickup, target });

            endDrag();
            if (move !== undefined) dispatchMove(move);
        },
        [boardRef, dispatchMove, draggedElements, endDrag],
    );

    const handleCancel = useCallback(
        (event: PointerEvent): void => {
            if (active.current !== undefined && event.pointerId === active.current.pointerId) endDrag();
        },
        [endDrag],
    );

    const handleCardPointerDown = useCallback(
        ({ cardId, event }: { cardId: string; event: React.PointerEvent }): void => {
            const pickup = isEnabled && event.button === 0 ? pickUp({ game: latestGame.current, cardId }) : undefined;

            if (pickup === undefined || active.current !== undefined) return;

            active.current = {
                pickup,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startRect: toRect(event.currentTarget),
                isDragging: false,
            };
            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
            window.addEventListener('pointercancel', handleCancel);
            detach.current = () => {
                window.removeEventListener('pointermove', handleMove);
                window.removeEventListener('pointerup', handleUp);
                window.removeEventListener('pointercancel', handleCancel);
            };
        },
        [isEnabled, handleMove, handleUp, handleCancel],
    );

    // A new deal or unmount mid-drag ends the drag and drops the window listeners.
    useEffect(
        () => () => {
            if (active.current !== undefined) endDrag();
        },
        [dealNumber, endDrag],
    );

    const handleReleasedLanded = useCallback((cardId: string) => {
        setReleasedIds((latest) => (latest.has(cardId) ? new Set([...latest].filter((id) => id !== cardId)) : latest));
    }, []);

    return { draggingIds, releasedIds, handleCardPointerDown, handleReleasedLanded };
};
