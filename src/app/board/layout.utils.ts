import { CardModel, GameStateModel, PileModel } from '~/engine/index.ts';

export enum PileKind {
    Stock = 'stock',
    Waste = 'waste',
    Foundation = 'foundation',
    Tableau = 'tableau',
}

// Anything that names a pile — a card's slot, a drop target.
export const isTableauPile = ({ pile }: { pile: PileKind }): boolean => pile === PileKind.Tableau;

// Where a card sits, in table units — CSS turns these into pixels, so the layout stays CSS-responsive.
export type CardSlotModel = {
    card: CardModel;
    pile: PileKind;
    pileIndex: number;
    column: number;
    row: number;
    downOffset: number;
    upOffset: number;
    fan: number;
    z: number;
    // Deep inside a squared pile (stock, waste, foundation): hidden by the cards above, so it casts no shadow.
    isBuried: boolean;
};

const VISIBLE_STACK_DEPTH = 2;

const isBuriedIn = ({ depth, size }: { depth: number; size: number }): boolean => depth < size - VISIBLE_STACK_DEPTH;

// The table's columns — the one home of where each pile sits (board placeholders read these too).
export const STOCK_COLUMN = 0;
export const WASTE_COLUMN = 1;
export const FOUNDATION_FIRST_COLUMN = 3;
export const TOP_ROW = 0;
export const TABLEAU_ROW = 1;

// Vertical spacing per covered card, as a fraction of card height — mirrored by --down-y/--up-y in board.module.scss.
const DOWN_SPACING = 0.08;
const UP_SPACING = 0.25;

const stackSlots = ({
    pile,
    kind,
    pileIndex,
    column,
}: {
    pile: PileModel;
    kind: PileKind;
    pileIndex: number;
    column: number;
}): CardSlotModel[] =>
    pile.map((card, depth) => ({
        card,
        pile: kind,
        pileIndex,
        column,
        row: TOP_ROW,
        downOffset: 0,
        upOffset: 0,
        fan: 0,
        z: depth + 1,
        isBuried: isBuriedIn({ depth, size: pile.length }),
    }));

// The top `wasteFan` waste cards spread rightwards (fan 0, 1, 2); the rest sit squared under the first.
const wasteSlots = (game: GameStateModel): CardSlotModel[] => {
    const firstFanned = game.waste.length - Math.min(game.wasteFan, game.waste.length);

    return stackSlots({ pile: game.waste, kind: PileKind.Waste, pileIndex: 0, column: WASTE_COLUMN }).map(
        (slot, depth) => ({
            ...slot,
            fan: Math.max(0, depth - firstFanned),
        }),
    );
};

const tableauSlots = ({ pile, pileIndex }: { pile: PileModel; pileIndex: number }): CardSlotModel[] =>
    pile.map((card, depth) => {
        const beneath = pile.slice(0, depth);
        const downOffset = beneath.filter((c) => !c.faceUp).length;

        return {
            card,
            pile: PileKind.Tableau,
            pileIndex,
            column: pileIndex,
            row: TABLEAU_ROW,
            downOffset,
            upOffset: beneath.length - downOffset,
            fan: 0,
            z: depth + 1,
            isBuried: false,
        };
    });

export const layoutCards = (game: GameStateModel): CardSlotModel[] => [
    ...stackSlots({ pile: game.stock, kind: PileKind.Stock, pileIndex: 0, column: STOCK_COLUMN }),
    ...wasteSlots(game),
    ...game.foundations.flatMap((pile, pileIndex) =>
        stackSlots({ pile, kind: PileKind.Foundation, pileIndex, column: FOUNDATION_FIRST_COLUMN + pileIndex }),
    ),
    ...game.tableau.flatMap((pile, pileIndex) => tableauSlots({ pile, pileIndex })),
];

const slotKey = (slot: CardSlotModel): string =>
    `${slot.column}:${slot.row}:${slot.downOffset}:${slot.upOffset}:${slot.fan}`;

// Cards whose on-table position changed — these are lifted above everything while they fly. A card
// turned over in place does not fly, so it is not lifted.
export const movedCardIds = ({
    previous,
    next,
}: {
    previous: readonly CardSlotModel[];
    next: readonly CardSlotModel[];
}): Set<string> => {
    const previousKeys = new Map(previous.map((slot) => [slot.card.id, slotKey(slot)]));

    return new Set(next.filter((slot) => previousKeys.get(slot.card.id) !== slotKey(slot)).map((slot) => slot.card.id));
};

const depthOf = (slot: CardSlotModel): number => slot.downOffset + slot.upOffset;

// The order a dealer lays tableau cards: one card to every column, then the next row, left to right.
export const dealOrder = (slots: readonly CardSlotModel[]): Map<string, number> =>
    new Map(
        slots
            .filter(isTableauPile)
            .sort((a, b) => depthOf(a) - depthOf(b) || a.column - b.column)
            .map((slot, index) => [slot.card.id, index]),
    );

// Every card squared face-down on the stock — the picture before the deal animation starts.
export const stackOnStock = (slots: readonly CardSlotModel[]): CardSlotModel[] =>
    slots.map((slot, index) => ({
        ...slot,
        card: { ...slot.card, faceUp: false },
        pile: PileKind.Stock,
        column: STOCK_COLUMN,
        row: TOP_ROW,
        downOffset: 0,
        upOffset: 0,
        fan: 0,
        z: index + 1,
    }));

const reach = ({ downOffset, upOffset }: { downOffset: number; upOffset: number }): number =>
    downOffset * DOWN_SPACING + upOffset * UP_SPACING;

// The covered-card offsets of the card reaching furthest down the table — it decides the table's height.
export const tallestColumn = (slots: readonly CardSlotModel[]): { downOffset: number; upOffset: number } =>
    slots.reduce<{ downOffset: number; upOffset: number }>(
        (tallest, slot) =>
            reach(slot) > reach(tallest) ? { downOffset: slot.downOffset, upOffset: slot.upOffset } : tallest,
        { downOffset: 0, upOffset: 0 },
    );
