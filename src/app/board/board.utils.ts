import {
    findClickMove,
    GameStateModel,
    hasStock,
    PileModel,
    Rank,
    Suit,
    SuitColor,
    suitColorOf,
} from '~/engine/index.ts';

import {
    CardSlotModel,
    FOUNDATION_FIRST_COLUMN,
    PileKind,
    stackOnStock,
    STOCK_COLUMN,
    TABLEAU_ROW,
    tallestColumn,
    TOP_ROW,
    WASTE_COLUMN,
} from './layout.utils.ts';

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

// The parts of a slot that decide where something is drawn.
type SlotPositionModel = Pick<CardSlotModel, 'column' | 'row' | 'downOffset' | 'upOffset' | 'fan' | 'z'>;

const classFor = ({ styles, name }: { styles: StyleMap; name: string }): string => {
    const className = styles[name];

    if (className === undefined) throw new Error(`board: missing CSS class "${name}" in board.module.scss`);

    return className;
};

// The position classes CSS turns into a transform (see the @for loops in board.module.scss).
export const slotClassNames = ({ slot, styles }: { slot: SlotPositionModel; styles: StyleMap }): string[] => [
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

// The column reaching furthest down decides the table's height (see .board in board.module.scss).
export const boardHeightClassNames = ({
    slots,
    styles,
}: {
    slots: readonly CardSlotModel[];
    styles: StyleMap;
}): string[] => {
    const { downOffset, upOffset } = tallestColumn(slots);

    return [classFor({ styles, name: `max-down-${downOffset}` }), classFor({ styles, name: `max-up-${upOffset}` })];
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

// The page order of the card elements never changes: a moved element loses its transform transition, so a
// card that changed piles would jump to its slot instead of flying. Stacking comes from z, never page order.
export const inStableOrder = <T extends { slot: CardSlotModel }>(cards: readonly T[]): T[] =>
    [...cards].sort((a, b) => a.slot.card.id.localeCompare(b.slot.card.id));

// The card a click played, and the one it left showing under the pointer (the card beneath it in its pile).
export type LastPlayModel = { cardId: string; uncoveredId: string | undefined };

const cardBelow = ({ pile, cardId }: { pile: PileModel; cardId: string }): string | undefined => {
    const below = pile[pile.findIndex((card) => card.id === cardId) - 1];

    return below === undefined ? undefined : below.id;
};

export const makeLastPlay = ({ state, cardId }: { state: GameStateModel; cardId: string }): LastPlayModel => ({
    cardId,
    uncoveredId: [state.waste, ...state.tableau].map((pile) => cardBelow({ pile, cardId })).find(isDefined),
});

const isDefined = (cardId: string | undefined): cardId is string => cardId !== undefined;

// The browser counts quick clicks near one spot in `detail`, even across cards. A repeat on the card the previous
// click just played, or on the card that play left under the pointer, is the second half of a double-click; a quick
// click on any other card is a play.
export const isRepeatClick = ({
    cardId,
    detail,
    lastPlay,
}: {
    cardId: string;
    detail: number;
    lastPlay: LastPlayModel | undefined;
}): boolean => detail > 1 && lastPlay !== undefined && (lastPlay.cardId === cardId || lastPlay.uncoveredId === cardId);

// A card on a foundation: a click never plays it (it comes down only by drag), so it neither plays nor shakes.
export const isHomeCard = ({ state, cardId }: { state: GameStateModel; cardId: string }): boolean =>
    state.foundations.some((pile) => pile.some((card) => card.id === cardId));

export const hasClickMove = (args: { state: GameStateModel; cardId: string }): boolean =>
    findClickMove(args) !== undefined;

// A card shaking because it was clicked with no move — only in the game it was clicked in.
export type ShakeModel = { cardId: string; game: GameStateModel };

export const isShakingCard = ({
    shake,
    cardId,
    game,
}: {
    shake: ShakeModel | undefined;
    cardId: string;
    game: GameStateModel;
}): boolean => shake !== undefined && shake.cardId === cardId && shake.game === game;

export const isDealing = (phase: DealPhase): boolean => phase === DealPhase.Dealing;

// Cards only respond once the deal has settled — mid-deal they sit over the stock and other piles.
export const isSettled = (phase: DealPhase): boolean => phase === DealPhase.Settled;

export const stockSlot = { column: STOCK_COLUMN, row: TOP_ROW };

export const stockLabelFor = (game: GameStateModel): string =>
    hasStock(game) ? 'Draw from the stock' : 'Recycle the waste into the stock';

export type PilePlaceholderModel = { key: string; pile: PileKind; pileIndex: number; column: number; row: number };

// The empty-pile outlines under the cards: waste, 4 foundations and 7 tableau columns (the stock is a button).
export const pilePlaceholders: readonly PilePlaceholderModel[] = [
    { key: 'waste', pile: PileKind.Waste, pileIndex: 0, column: WASTE_COLUMN, row: TOP_ROW },
    ...[0, 1, 2, 3].map((pileIndex) => ({
        key: `foundation-${pileIndex}`,
        pile: PileKind.Foundation,
        pileIndex,
        column: FOUNDATION_FIRST_COLUMN + pileIndex,
        row: TOP_ROW,
    })),
    ...[0, 1, 2, 3, 4, 5, 6].map((pileIndex) => ({
        key: `tableau-${pileIndex}`,
        pile: PileKind.Tableau,
        pileIndex,
        column: pileIndex,
        row: TABLEAU_ROW,
    })),
];

export const placeholderSlot = ({ column, row }: { column: number; row: number }): SlotPositionModel => ({
    column,
    row,
    downOffset: 0,
    upOffset: 0,
    fan: 0,
    z: 0,
});
