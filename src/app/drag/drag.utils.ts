import { canApplyMove, GameStateModel, isTopCard, Move, MoveKind, runFrom } from '~/engine/index.ts';

import { PileKind } from '../board/layout.utils.ts';

export type PileRefModel = { pile: PileKind; pileIndex: number };

export type RectModel = { left: number; top: number; right: number; bottom: number };

export type PileRectModel = PileRefModel & { rect: RectModel };

// What a pointer-down lifted: the pile it came from and the cards moving together, bottom first.
export type DragPickupModel = { source: PileRefModel; cardIds: string[] };

// Pointer travel (px) below which a press is a click (which plays the card), not a drag.
const CLICK_RADIUS = 5;

export const hasMovedBeyondClick = ({ dx, dy }: { dx: number; dy: number }): boolean =>
    Math.hypot(dx, dy) > CLICK_RADIUS;

// A face-up tableau card lifts with every card above it; the waste and foundations give only their top card.
export const pickUp = ({ game, cardId }: { game: GameStateModel; cardId: string }): DragPickupModel | undefined => {
    if (isTopCard({ pile: game.waste, cardId }))
        return { source: { pile: PileKind.Waste, pileIndex: 0 }, cardIds: [cardId] };

    const foundation = game.foundations.findIndex((pile) => isTopCard({ pile, cardId }));

    if (foundation !== -1) return { source: { pile: PileKind.Foundation, pileIndex: foundation }, cardIds: [cardId] };

    const column = game.tableau.findIndex((pile) => pile.some((card) => card.id === cardId));
    const cards = game.tableau[column] ?? [];
    const run = runFrom({ pile: cards, cardId });
    const head = run[0];

    if (head === undefined || !head.faceUp) return undefined;

    return { source: { pile: PileKind.Tableau, pileIndex: column }, cardIds: run.map((card) => card.id) };
};

type MoveBuilder = (args: { cardId: string; from: number; to: number }) => Move;

// Which move a drop makes, by where the cards came from and where they landed; missing pairs are never moves.
const dropMoveMap: Record<PileKind, Partial<Record<PileKind, MoveBuilder>>> = {
    [PileKind.Stock]: {},
    [PileKind.Waste]: {
        [PileKind.Tableau]: ({ cardId, to }) => ({ kind: MoveKind.WasteToTableau, cardId, to }),
        [PileKind.Foundation]: ({ cardId, to }) => ({ kind: MoveKind.WasteToFoundation, cardId, to }),
    },
    [PileKind.Tableau]: {
        [PileKind.Tableau]: ({ cardId, from, to }) => ({ kind: MoveKind.TableauToTableau, cardId, from, to }),
        [PileKind.Foundation]: ({ cardId, from, to }) => ({ kind: MoveKind.TableauToFoundation, cardId, from, to }),
    },
    [PileKind.Foundation]: {
        [PileKind.Tableau]: ({ cardId, from, to }) => ({ kind: MoveKind.FoundationToTableau, cardId, from, to }),
    },
};

// The move a drop makes, only when the engine accepts it — otherwise the cards snap back.
export const legalDropMove = ({
    game,
    pickup,
    target,
}: {
    game: GameStateModel;
    pickup: DragPickupModel;
    target: PileRefModel;
}): Move | undefined => {
    const build = dropMoveMap[pickup.source.pile][target.pile];
    const cardId = pickup.cardIds[0];

    if (build === undefined || cardId === undefined) return undefined;

    const move = build({ cardId, from: pickup.source.pileIndex, to: target.pileIndex });

    return canApplyMove({ state: game, move }) ? move : undefined;
};

const overlapArea = ({ a, b }: { a: RectModel; b: RectModel }): number =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const isSamePile = ({ a, b }: { a: PileRefModel; b: PileRefModel }): boolean =>
    a.pile === b.pile && a.pileIndex === b.pileIndex;

// How far past its edges a pile still catches a drop, as a share of the card width. More than the gap between
// columns (~0.13 of a card), so neighbouring areas overlap — MIN_DROP_SHARE keeps that overlap from stealing drops.
export const DROP_PADDING_RATIO = 0.25;

// The least share of the dragged card's area a pile must catch to take the drop: a deliberate drop half over a
// pile lands, a graze of a neighbour's padded edge (≈0.12 of the card when dropped dead centre on the next
// column) does not. Raising DROP_PADDING_RATIO past ~0.37 voids that margin.
export const MIN_DROP_SHARE = 0.25;

const isTableauPile = (pile: PileRefModel): boolean => pile.pile === PileKind.Tableau;

const areaOf = (rect: RectModel): number => (rect.right - rect.left) * (rect.bottom - rect.top);

// Every pile's drop area is wider than what it shows, so a sloppy drop still lands: padded on every side, and a
// tableau column reaches down to the floor — the table's bottom or the window's foot, whichever is lower (the
// table ends below its longest column, but the felt goes on).
export const widenDropAreas = ({
    piles,
    cardWidth,
    boardBottom,
    viewportHeight,
}: {
    piles: readonly PileRectModel[];
    cardWidth: number;
    boardBottom: number;
    viewportHeight: number;
}): PileRectModel[] => {
    const padding = cardWidth * DROP_PADDING_RATIO;
    const floor = Math.max(boardBottom, viewportHeight);

    return piles.map((pile) => {
        const bottom = pile.rect.bottom + padding;

        return {
            ...pile,
            rect: {
                left: pile.rect.left - padding,
                top: pile.rect.top - padding,
                right: pile.rect.right + padding,
                bottom: isTableauPile(pile) ? Math.max(bottom, floor) : bottom,
            },
        };
    });
};

type TouchedPileModel = { pile: PileRefModel; area: number };

const hasOverlap = ({ area }: TouchedPileModel): boolean => area > 0;

// Most overlap first; on a tie the source pile first, so an exactly-centred drop between home and a
// neighbour is a change of mind rather than whichever pile comes first in the page.
const byOverlapThenSource =
    (source: PileRefModel) =>
    (a: TouchedPileModel, b: TouchedPileModel): number =>
        b.area - a.area || Number(isSamePile({ a: b.pile, b: source })) - Number(isSamePile({ a: a.pile, b: source }));

// The move a drop makes: onto the most-overlapped pile that takes the cards and catches enough of the card,
// so a legal pile wins over an illegal one it overlaps less. None on bare felt, and none when the source pile
// is overlapped more than any pile that would take the cards — a drop mostly back home is a change of mind, even
// if it grazes a neighbour.
export const findDropMove = ({
    game,
    pickup,
    dragged,
    piles,
}: {
    game: GameStateModel;
    pickup: DragPickupModel;
    dragged: RectModel;
    piles: readonly PileRectModel[];
}): Move | undefined => {
    const touched = piles
        .map((pile) => ({
            pile: { pile: pile.pile, pileIndex: pile.pileIndex },
            area: overlapArea({ a: dragged, b: pile.rect }),
        }))
        .filter(hasOverlap)
        .sort(byOverlapThenSource(pickup.source));
    const sourceRank = touched.findIndex((candidate) => isSamePile({ a: candidate.pile, b: pickup.source }));
    // Only piles overlapped more than the source can win.
    const rivals = sourceRank === -1 ? touched : touched.slice(0, sourceRank);
    const isEnoughOverlap = ({ area }: TouchedPileModel): boolean => area >= areaOf(dragged) * MIN_DROP_SHARE;
    const landing = rivals.find(
        (candidate) =>
            isEnoughOverlap(candidate) && legalDropMove({ game, pickup, target: candidate.pile }) !== undefined,
    );

    return landing === undefined ? undefined : legalDropMove({ game, pickup, target: landing.pile });
};

export const unionRects = (rects: readonly RectModel[]): RectModel => ({
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
});

export const offsetRect = ({ rect, dx, dy }: { rect: RectModel; dx: number; dy: number }): RectModel => ({
    left: rect.left + dx,
    top: rect.top + dy,
    right: rect.right + dx,
    bottom: rect.bottom + dy,
});
