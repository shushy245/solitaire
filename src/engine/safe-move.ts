import { suitColorOf, topCard } from './selectors.ts';
import { findFoundationTarget } from './auto-complete.ts';
import { CardModel, GameStateModel, MoveKind, MoveOf, PileModel, Rank, Suit } from './model.ts';

type SafeMove = MoveOf<MoveKind.WasteToFoundation | MoveKind.TableauToFoundation>;

const isFoundationOf = ({ pile, suit }: { pile: PileModel; suit: Suit }): boolean => {
    const top = topCard(pile);

    return top !== undefined && top.suit === suit;
};

// How many cards of `suit` are home.
const countHomeOf = ({ state, suit }: { state: GameStateModel; suit: Suit }): number => {
    const pile = state.foundations.find((foundation) => isFoundationOf({ pile: foundation, suit }));

    return pile === undefined ? 0 : pile.length;
};

const oppositeSuitsOf = (card: CardModel): Suit[] =>
    Object.values(Suit).filter((suit) => suitColorOf(suit) !== suitColorOf(card.suit));

// A card nothing left on the table could need as a base: an Ace, a Two, or a card whose opposite-colour cards one
// rank lower are both home already (only those could be laid on it in a column).
const isSafeToSend = ({ state, card }: { state: GameStateModel; card: CardModel }): boolean =>
    card.rank <= Rank.Two || oppositeSuitsOf(card).every((suit) => countHomeOf({ state, suit }) >= card.rank - 1);

const wasteMove = (state: GameStateModel): SafeMove[] => {
    const card = topCard(state.waste);
    const to = card === undefined ? undefined : findFoundationTarget({ state, card });

    if (card === undefined || to === undefined || !isSafeToSend({ state, card })) return [];

    return [{ kind: MoveKind.WasteToFoundation, cardId: card.id, to }];
};

const columnMoves = (state: GameStateModel): SafeMove[] =>
    state.tableau.flatMap((column, from) => {
        const card = topCard(column);
        const to = card === undefined || !card.faceUp ? undefined : findFoundationTarget({ state, card });

        if (card === undefined || to === undefined || !isSafeToSend({ state, card })) return [];

        return [{ kind: MoveKind.TableauToFoundation, cardId: card.id, from, to }];
    });

// The next card that can go home by itself — the waste top first, then the columns left to right. Only top cards
// move, never a card already home.
export const nextSafeMove = (state: GameStateModel): SafeMove | undefined =>
    [...wasteMove(state), ...columnMoves(state)][0];
