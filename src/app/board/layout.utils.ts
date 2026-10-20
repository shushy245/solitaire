import { CardModel, GameStateModel, PileModel } from '~/engine/index.ts';

export enum PileKind {
    Stock = 'stock',
    Waste = 'waste',
    Foundation = 'foundation',
    Tableau = 'tableau',
}

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
};

const FOUNDATION_FIRST_COLUMN = 3;

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
        row: 0,
        downOffset: 0,
        upOffset: 0,
        fan: 0,
        z: depth + 1,
    }));

// The top `wasteFan` waste cards spread rightwards (fan 0, 1, 2); the rest sit squared under the first.
const wasteSlots = (game: GameStateModel): CardSlotModel[] => {
    const firstFanned = game.waste.length - Math.min(game.wasteFan, game.waste.length);

    return stackSlots({ pile: game.waste, kind: PileKind.Waste, pileIndex: 0, column: 1 }).map((slot, depth) => ({
        ...slot,
        fan: Math.max(0, depth - firstFanned),
    }));
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
            row: 1,
            downOffset,
            upOffset: beneath.length - downOffset,
            fan: 0,
            z: depth + 1,
        };
    });

export const layoutCards = (game: GameStateModel): CardSlotModel[] => [
    ...stackSlots({ pile: game.stock, kind: PileKind.Stock, pileIndex: 0, column: 0 }),
    ...wasteSlots(game),
    ...game.foundations.flatMap((pile, pileIndex) =>
        stackSlots({ pile, kind: PileKind.Foundation, pileIndex, column: FOUNDATION_FIRST_COLUMN + pileIndex }),
    ),
    ...game.tableau.flatMap((pile, pileIndex) => tableauSlots({ pile, pileIndex })),
];

const slotKey = (slot: CardSlotModel): string =>
    `${slot.column}:${slot.row}:${slot.downOffset}:${slot.upOffset}:${slot.fan}:${slot.card.faceUp}`;

// Cards whose on-table position or face changed — these are lifted above everything while they fly.
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

const isTableauSlot = (slot: CardSlotModel): boolean => slot.pile === PileKind.Tableau;

const depthOf = (slot: CardSlotModel): number => slot.downOffset + slot.upOffset;

// The order a dealer lays tableau cards: one card to every column, then the next row, left to right.
export const dealOrder = (slots: readonly CardSlotModel[]): Map<string, number> =>
    new Map(
        slots
            .filter(isTableauSlot)
            .sort((a, b) => depthOf(a) - depthOf(b) || a.column - b.column)
            .map((slot, index) => [slot.card.id, index]),
    );

// Every card squared face-down on the stock — the picture before the deal animation starts.
export const stackOnStock = (slots: readonly CardSlotModel[]): CardSlotModel[] =>
    slots.map((slot, index) => ({
        ...slot,
        card: { ...slot.card, faceUp: false },
        column: 0,
        row: 0,
        downOffset: 0,
        upOffset: 0,
        fan: 0,
        z: index + 1,
    }));
