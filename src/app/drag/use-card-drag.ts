import { MutableRefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { GameStateModel, Move } from '~/engine/index.ts';

import { pileRefFromElement } from './drag-dom.utils.ts';
import {
    DragPickupModel,
    findDropMove,
    hasMovedBeyondClick,
    offsetRect,
    PileRectModel,
    pickUp,
    RectModel,
    unionRects,
    widenDropAreas,
} from './drag.utils.ts';

// startRect is the lead card's box at pick-up: the drop box is computed from it plus the pointer travel,
// never measured at release, when the card may still be easing toward the pointer. `elements` is
// resolved once, when the press turns into a drag.
type ActiveDrag = {
    pickup: DragPickupModel;
    pointerId: number;
    startX: number;
    startY: number;
    startRect: RectModel;
    elements: readonly HTMLElement[] | undefined;
};

type CardDragResult = {
    // Cards following the pointer right now.
    draggingIds: ReadonlySet<string>;
    handleCardPointerDown: (args: { cardId: string; event: React.PointerEvent }) => void;
};

const NONE: ReadonlySet<string> = new Set();

const toRect = (element: Element): RectModel => {
    const { left, top, right, bottom } = element.getBoundingClientRect();

    return { left, top, right, bottom };
};

const isDragging = (drag: ActiveDrag): boolean => drag.elements !== undefined;

const isSamePointer = ({ drag, event }: { drag: ActiveDrag; event: PointerEvent }): boolean =>
    event.pointerId === drag.pointerId;

const isPrimaryButton = (event: React.PointerEvent): boolean => event.button === 0;

// A move with no button held means the release happened where the page could not see it.
const isReleaseLost = (event: PointerEvent): boolean => event.buttons === 0;

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
    draggedIds: ReadonlySet<string>;
}): PileRectModel[] => {
    const groups = new Map<string, PileRectModel>();

    board.querySelectorAll('[data-pile]').forEach((element) => {
        const ref = pileRefFromElement(element);

        if (ref === undefined || draggedIds.has(element.getAttribute('data-card-id') ?? '')) return;

        const key = `${ref.pile}:${ref.pileIndex}`;
        const known = groups.get(key);
        groups.set(key, {
            ...ref,
            rect: known === undefined ? toRect(element) : unionRects([known.rect, toRect(element)]),
        });
    });

    return [...groups.values()];
};

// The browser follows a drag's pointerup with a click on the card under the pointer — the dragged card itself.
// That click is not a play: swallow it before it reaches the card, and stop waiting once the release's own
// task has passed (a release over bare felt fires no click at all).
const swallowClickAfterDrag = (): void => {
    const swallow = (event: MouseEvent): void => {
        event.stopPropagation();
    };

    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => {
        window.removeEventListener('click', swallow, { capture: true });
    }, 0);
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
// Released cards are handed to onRelease so the board keeps them lifted until they land; a drop that moves
// nothing calls onSnapBack (a click or a cancelled drag does not).
export const useCardDrag = ({
    game,
    isEnabled,
    dispatchMove,
    onRelease,
    onSnapBack,
    boardRef,
}: {
    game: GameStateModel;
    isEnabled: boolean;
    dispatchMove: (move: Move) => void;
    onRelease: (cardIds: readonly string[]) => void;
    onSnapBack: () => void;
    boardRef: MutableRefObject<HTMLElement | undefined>;
}): CardDragResult => {
    const [draggingIds, setDraggingIds] = useState<ReadonlySet<string>>(NONE);
    const active = useRef<ActiveDrag | undefined>(undefined);
    const latestGame = useRef(game);
    const detach = useRef<() => void>(() => undefined);

    // Pointer-up reads the newest game, never the one captured at pointer-down.
    useLayoutEffect(() => {
        latestGame.current = game;
    }, [game]);

    // Ends the press or drag: listeners off, offsets cleared, released cards handed back for landing.
    const endDrag = useCallback((): void => {
        const drag = active.current;

        detach.current();
        active.current = undefined;
        setDraggingIds(NONE);

        if (drag === undefined || drag.elements === undefined) return;

        clearDragOffset(drag.elements);
        onRelease(drag.pickup.cardIds);
    }, [onRelease]);

    const handleMove = useCallback(
        (event: PointerEvent): void => {
            const drag = active.current;
            const board = boardRef.current;

            if (drag === undefined || board === undefined || !isSamePointer({ drag, event })) return;
            if (isReleaseLost(event)) {
                endDrag();

                return;
            }

            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;

            if (!isDragging(drag) && !hasMovedBeyondClick({ dx, dy })) return;

            const elements = drag.elements ?? cardElements({ board, cardIds: drag.pickup.cardIds });

            if (!isDragging(drag)) {
                active.current = { ...drag, elements };
                setDraggingIds(new Set(drag.pickup.cardIds));
            }

            setDragOffset({ elements, dx, dy });
        },
        [boardRef, endDrag],
    );

    const handleUp = useCallback(
        (event: PointerEvent): void => {
            const drag = active.current;
            const board = boardRef.current;

            if (drag === undefined || !isSamePointer({ drag, event })) return;
            if (!isDragging(drag) || board === undefined) {
                endDrag();

                return;
            }

            const move = findDropMove({
                game: latestGame.current,
                pickup: drag.pickup,
                dragged: offsetRect({
                    rect: drag.startRect,
                    dx: event.clientX - drag.startX,
                    dy: event.clientY - drag.startY,
                }),
                piles: widenDropAreas({
                    piles: measurePiles({ board, draggedIds: new Set(drag.pickup.cardIds) }),
                    cardWidth: drag.startRect.right - drag.startRect.left,
                    boardBottom: toRect(board).bottom,
                    viewportHeight: window.innerHeight,
                }),
            });

            endDrag();
            swallowClickAfterDrag();
            if (move === undefined) onSnapBack();
            else dispatchMove(move);
        },
        [boardRef, dispatchMove, endDrag, onSnapBack],
    );

    const handleCancel = useCallback(
        (event: PointerEvent): void => {
            const drag = active.current;

            if (drag !== undefined && isSamePointer({ drag, event })) endDrag();
        },
        [endDrag],
    );

    const handleCardPointerDown = useCallback(
        ({ cardId, event }: { cardId: string; event: React.PointerEvent }): void => {
            const pickup =
                isEnabled && isPrimaryButton(event) ? pickUp({ game: latestGame.current, cardId }) : undefined;

            if (pickup === undefined || active.current !== undefined) return;

            active.current = {
                pickup,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startRect: toRect(event.currentTarget),
                elements: undefined,
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

    // Any change to the game mid-drag (undo, a new deal) or unmount ends the drag and drops the window
    // listeners: the picked-up cards may no longer be where the drag found them. Read through a ref so a
    // new endDrag identity never cancels a live drag on its own.
    const latestEndDrag = useRef(endDrag);

    useLayoutEffect(() => {
        latestEndDrag.current = endDrag;
    }, [endDrag]);

    useEffect(
        () => () => {
            if (active.current !== undefined) latestEndDrag.current();
        },
        [game],
    );

    return { draggingIds, handleCardPointerDown };
};
