import { CardModel, CARDS_PER_SUIT, GameStateModel, PileModel, Rank, Suit, SuitColor } from './model.ts';

const suitColorMap: Record<Suit, SuitColor> = {
    [Suit.Clubs]: SuitColor.Black,
    [Suit.Spades]: SuitColor.Black,
    [Suit.Diamonds]: SuitColor.Red,
    [Suit.Hearts]: SuitColor.Red,
};

export const suitColorOf = (suit: Suit): SuitColor => suitColorMap[suit];

export const topCard = (pile: PileModel): CardModel | undefined => pile[pile.length - 1];

export const isTopCard = ({ pile, cardId }: { pile: PileModel; cardId: string }): boolean => {
    const top = topCard(pile);

    return top !== undefined && top.id === cardId;
};

export const isEmptyPile = (pile: PileModel): boolean => pile.length === 0;

export const isFaceDown = (card: CardModel): boolean => !card.faceUp;

const isOppositeColor = ({ a, b }: { a: CardModel; b: CardModel }): boolean =>
    suitColorOf(a.suit) !== suitColorOf(b.suit);

const isOneRankBelow = ({ card, above }: { card: CardModel; above: CardModel }): boolean =>
    card.rank === above.rank - 1;

// Tableau building: a King onto an empty column, otherwise opposite colour and one rank lower.
export const canStackOnTableau = ({ card, pile }: { card: CardModel; pile: PileModel }): boolean => {
    const top = topCard(pile);

    if (top === undefined) return card.rank === Rank.King;

    return top.faceUp && isOppositeColor({ a: card, b: top }) && isOneRankBelow({ card, above: top });
};

// Foundation building: an Ace onto an empty foundation, otherwise same suit and one rank higher.
export const canStackOnFoundation = ({ card, pile }: { card: CardModel; pile: PileModel }): boolean => {
    const top = topCard(pile);

    if (top === undefined) return card.rank === Rank.Ace;

    return top.suit === card.suit && card.rank === top.rank + 1;
};

// A movable tableau run: every card face-up, each one opposite colour and one rank below the one under it.
export const isMovableRun = (run: PileModel): boolean =>
    run.every((card, i) => {
        const below = run[i - 1];

        return (
            card.faceUp &&
            (below === undefined || (isOppositeColor({ a: card, b: below }) && isOneRankBelow({ card, above: below })))
        );
    });

// The cards from the named one to the top of the pile; empty when the card is not in it.
export const runFrom = ({ pile, cardId }: { pile: PileModel; cardId: string }): PileModel => {
    const start = pile.findIndex((card) => card.id === cardId);

    return start === -1 ? [] : pile.slice(start);
};

const isCompleteFoundation = (pile: PileModel): boolean => pile.length === CARDS_PER_SUIT;

export const isWon = (state: GameStateModel): boolean => state.foundations.every(isCompleteFoundation);

export const hasStock = (state: GameStateModel): boolean => !isEmptyPile(state.stock);

export const hasWaste = (state: GameStateModel): boolean => !isEmptyPile(state.waste);

export const canRecycle = (state: GameStateModel): boolean => !hasStock(state) && hasWaste(state);

export const isAllFaceUp = (pile: PileModel): boolean => pile.every((card) => card.faceUp);

export const isLowerRank = ({ card, than }: { card: CardModel; than: CardModel }): boolean => card.rank < than.rank;
