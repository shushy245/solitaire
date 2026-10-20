import { createDeck, shuffle } from './deck.ts';
import { CardModel, DrawMode, FOUNDATION_COUNT, GameStateModel, PileModel, TABLEAU_COUNT } from './model.ts';

// Column i takes i + 1 cards from the front of the shuffled deck; the rest becomes the stock.
export const dealGame = ({ seed, drawMode }: { seed: number; drawMode: DrawMode }): GameStateModel => {
    const deck = shuffle({ items: createDeck(), seed });
    const tableauSize = (TABLEAU_COUNT * (TABLEAU_COUNT + 1)) / 2;

    return {
        seed,
        drawMode,
        stock: deck.slice(tableauSize),
        waste: [],
        wasteFan: 0,
        foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
        tableau: Array.from({ length: TABLEAU_COUNT }, (_, column) => dealColumn({ deck, column })),
        score: 0,
        moves: 0,
        recycles: 0,
    };
};

const dealColumn = ({ deck, column }: { deck: readonly CardModel[]; column: number }): PileModel => {
    const start = (column * (column + 1)) / 2;
    const cards = deck.slice(start, start + column + 1);

    return cards.map((card, i) => (i === cards.length - 1 ? { ...card, faceUp: true } : card));
};
