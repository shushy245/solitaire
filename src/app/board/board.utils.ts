import { GameStateModel, hasStock, Rank, Suit, SuitColor, suitColorOf } from '~/engine/index.ts';

import { CardSlotModel, PileKind, stackOnStock } from './layout.utils.ts';

// Test IDs: the string value equals the access path.
export const BoardTestIds = {
    Board: 'BoardTestIds.Board',
    Stock: 'BoardTestIds.Stock',
    AnyCard: /^BoardTestIds\.Card\./,
    Card: (cardId: string): string => `BoardTestIds.Card.${cardId}`,
} as const;

export enum DealPhase {
    Stacked = 'stacked',
    Dealing = 'dealing',
    Settled = 'settled',
}

// Motion timings — mirrored by the transition durations in board.module.scss.
export const STACK_HOLD_MS = 60;
export const DEAL_STAGGER_MS = 35;
const MOVE_MS = 260;
const FLIP_MS = 300;
const TABLEAU_CARDS = 28;
export const DEAL_TOTAL_MS = TABLEAU_CARDS * DEAL_STAGGER_MS + MOVE_MS + FLIP_MS;

export const rankLabelMap: Record<Rank, string> = {
    [Rank.Ace]: 'A',
    [Rank.Two]: '2',
    [Rank.Three]: '3',
    [Rank.Four]: '4',
    [Rank.Five]: '5',
    [Rank.Six]: '6',
    [Rank.Seven]: '7',
    [Rank.Eight]: '8',
    [Rank.Nine]: '9',
    [Rank.Ten]: '10',
    [Rank.Jack]: 'J',
    [Rank.Queen]: 'Q',
    [Rank.King]: 'K',
};

const rankNameMap: Record<Rank, string> = {
    [Rank.Ace]: 'Ace',
    [Rank.Two]: 'Two',
    [Rank.Three]: 'Three',
    [Rank.Four]: 'Four',
    [Rank.Five]: 'Five',
    [Rank.Six]: 'Six',
    [Rank.Seven]: 'Seven',
    [Rank.Eight]: 'Eight',
    [Rank.Nine]: 'Nine',
    [Rank.Ten]: 'Ten',
    [Rank.Jack]: 'Jack',
    [Rank.Queen]: 'Queen',
    [Rank.King]: 'King',
};

export const suitGlyphMap: Record<Suit, string> = {
    [Suit.Clubs]: '♣',
    [Suit.Diamonds]: '♦',
    [Suit.Hearts]: '♥',
    [Suit.Spades]: '♠',
};

export const FACE_DOWN_LABEL = 'Face-down card';

export const cardLabel = ({ rank, suit }: { rank: Rank; suit: Suit }): string => `${rankNameMap[rank]} of ${suit}`;

export const isCourtCard = (rank: Rank): boolean => rank >= Rank.Jack;

export const isRedSuit = (suit: Suit): boolean => suitColorOf(suit) === SuitColor.Red;

type StyleMap = Readonly<Record<string, string>>;

const classFor = ({ styles, name }: { styles: StyleMap; name: string }): string => {
    const className = styles[name];

    if (className === undefined) throw new Error(`board: missing CSS class "${name}" in board.module.scss`);

    return className;
};

// The position classes CSS turns into a transform (see the @for loops in board.module.scss).
export const slotClassNames = ({
    slot,
    styles,
}: {
    slot: Omit<CardSlotModel, 'card' | 'pile' | 'pileIndex'>;
    styles: StyleMap;
}): string[] => [
    classFor({ styles, name: `col-${slot.column}` }),
    classFor({ styles, name: `row-${slot.row}` }),
    classFor({ styles, name: `down-${slot.downOffset}` }),
    classFor({ styles, name: `up-${slot.upOffset}` }),
    classFor({ styles, name: `fan-${slot.fan}` }),
    classFor({ styles, name: `z-${slot.z}` }),
];

export const dealDelayClassName = ({
    order,
    styles,
}: {
    order: number | undefined;
    styles: StyleMap;
}): string | undefined => (order === undefined ? undefined : classFor({ styles, name: `delay-${order}` }));

// The tallest column decides the table's height (see .board in board.module.scss).
export const boardHeightClassNames = ({
    slots,
    styles,
}: {
    slots: readonly CardSlotModel[];
    styles: StyleMap;
}): string[] => {
    const maxDown = Math.max(0, ...slots.map((slot) => slot.downOffset));
    const maxUp = Math.max(0, ...slots.map((slot) => slot.upOffset));

    return [classFor({ styles, name: `max-down-${maxDown}` }), classFor({ styles, name: `max-up-${maxUp}` })];
};

const shownSlotsMap: Record<DealPhase, (slots: readonly CardSlotModel[]) => readonly CardSlotModel[]> = {
    [DealPhase.Stacked]: stackOnStock,
    [DealPhase.Dealing]: (slots) => slots,
    [DealPhase.Settled]: (slots) => slots,
};

// Each card's real slot paired with where it is drawn: the same, except before the deal, when every
// card waits on the stock.
export const shownCardsFor = ({
    phase,
    slots,
}: {
    phase: DealPhase;
    slots: readonly CardSlotModel[];
}): { slot: CardSlotModel; shown: CardSlotModel }[] => {
    const shown = shownSlotsMap[phase](slots);

    return slots.map((slot, index) => ({ slot, shown: shown[index] ?? slot }));
};

export const isDealing = (phase: DealPhase): boolean => phase === DealPhase.Dealing;

export const stockLabelFor = (game: GameStateModel): string =>
    hasStock(game) ? 'Draw from the stock' : 'Recycle the waste into the stock';

export type PilePlaceholderModel = { key: string; pile: PileKind; pileIndex: number; column: number; row: number };

// The empty-pile outlines under the cards: waste, 4 foundations and 7 tableau columns (the stock is a button).
export const pilePlaceholders: readonly PilePlaceholderModel[] = [
    { key: 'waste', pile: PileKind.Waste, pileIndex: 0, column: 1, row: 0 },
    ...[0, 1, 2, 3].map((pileIndex) => ({
        key: `foundation-${pileIndex}`,
        pile: PileKind.Foundation,
        pileIndex,
        column: 3 + pileIndex,
        row: 0,
    })),
    ...[0, 1, 2, 3, 4, 5, 6].map((pileIndex) => ({
        key: `tableau-${pileIndex}`,
        pile: PileKind.Tableau,
        pileIndex,
        column: pileIndex,
        row: 1,
    })),
];

export const placeholderSlot = ({
    column,
    row,
}: {
    column: number;
    row: number;
}): Omit<CardSlotModel, 'card' | 'pile' | 'pileIndex'> => ({
    column,
    row,
    downOffset: 0,
    upOffset: 0,
    fan: 0,
    z: 0,
});
