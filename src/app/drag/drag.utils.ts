import { canApplyMove, GameStateModel, isTopCard, Move, MoveKind } from '~/engine/index.ts';

import { PileKind } from '../board/layout.utils.ts';

export type PileRefModel = { pile: PileKind; pileIndex: number };

export type RectModel = { left: number; top: number; right: number; bottom: number };

export type PileRectModel = PileRefModel & { rect: RectModel };

// What a pointer-down lifted: the pile it came from and the cards moving together, bottom first.
export type DragPickupModel = { source: PileRefModel; cardIds: string[] };

// Pointer travel (px) below which a press is a click — keeps double-click working on draggable cards.
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
    const run = cards.slice(cards.findIndex((card) => card.id === cardId));
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

// The pile the dragged card overlaps most, other than the one it came from; none on bare felt.
export const findDropTarget = ({
    dragged,
    piles,
    source,
}: {
    dragged: RectModel;
    piles: readonly PileRectModel[];
    source: PileRefModel;
}): PileRefModel | undefined => {
    const best = piles
        .filter((pile) => !isSamePile({ a: pile, b: source }))
        .map((pile) => ({ pile, area: overlapArea({ a: dragged, b: pile.rect }) }))
        .reduce<{ pile: PileRectModel; area: number } | undefined>(
            (top, candidate) => (candidate.area > (top === undefined ? 0 : top.area) ? candidate : top),
            undefined,
        );

    return best === undefined ? undefined : { pile: best.pile.pile, pileIndex: best.pile.pileIndex };
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
