export enum Suit {
    Clubs = 'clubs',
    Diamonds = 'diamonds',
    Hearts = 'hearts',
    Spades = 'spades',
}

export enum SuitColor {
    Red = 'red',
    Black = 'black',
}

export enum Rank {
    Ace = 1,
    Two,
    Three,
    Four,
    Five,
    Six,
    Seven,
    Eight,
    Nine,
    Ten,
    Jack,
    Queen,
    King,
}

export enum DrawMode {
    One = 'one',
    Three = 'three',
}

export type CardModel = {
    readonly id: string;
    readonly suit: Suit;
    readonly rank: Rank;
    readonly faceUp: boolean;
};

// Every pile lists its cards bottom → top: the last element is the top card.
export type PileModel = readonly CardModel[];

export type GameStateModel = {
    readonly seed: number;
    readonly drawMode: DrawMode;
    readonly stock: PileModel;
    readonly waste: PileModel;
    // How many waste cards are fanned out face-up (turn-3 shows the latest draw, shrinking as it is played).
    readonly wasteFan: number;
    readonly foundations: readonly PileModel[];
    readonly tableau: readonly PileModel[];
    readonly score: number;
    readonly moves: number;
    readonly recycles: number;
};

export enum MoveKind {
    Draw = 'draw',
    Recycle = 'recycle',
    WasteToTableau = 'waste-to-tableau',
    WasteToFoundation = 'waste-to-foundation',
    TableauToTableau = 'tableau-to-tableau',
    TableauToFoundation = 'tableau-to-foundation',
    FoundationToTableau = 'foundation-to-tableau',
}

// Every card-moving move names the card it moves (a draw names the stock's top card), so a stale move
// computed against an older state — e.g. a double-fired click — is rejected instead of moving whatever
// now sits in that position. Recycle needs no name: it is only legal with an empty stock, which a
// recycle refills, so a repeated recycle is rejected by its own rule.
type MovePayloadMap = {
    [MoveKind.Draw]: { readonly cardId: string };
    [MoveKind.Recycle]: object;
    [MoveKind.WasteToTableau]: { readonly cardId: string; readonly to: number };
    [MoveKind.WasteToFoundation]: { readonly cardId: string; readonly to: number };
    [MoveKind.TableauToTableau]: { readonly cardId: string; readonly from: number; readonly to: number };
    [MoveKind.TableauToFoundation]: { readonly cardId: string; readonly from: number; readonly to: number };
    [MoveKind.FoundationToTableau]: { readonly cardId: string; readonly from: number; readonly to: number };
};

export type MoveOf<K extends MoveKind> = { [P in K]: { readonly kind: P } & MovePayloadMap[P] }[K];

export type Move = MoveOf<MoveKind>;

export const FOUNDATION_COUNT = 4;
export const CARDS_PER_SUIT = 13;
export const TABLEAU_COUNT = 7;
export const DECK_SIZE = FOUNDATION_COUNT * CARDS_PER_SUIT;
// Column i is dealt i + 1 cards.
export const DEALT_TABLEAU_CARDS = (TABLEAU_COUNT * (TABLEAU_COUNT + 1)) / 2;
// Turn 3 draws three, so at most three waste cards ever show.
export const MAX_WASTE_FAN = 3;
