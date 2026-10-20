import { nextRandom } from './prng.ts';
import { CardModel, Rank, Suit } from './model.ts';

const ranks: readonly Rank[] = Object.values(Rank).filter((value) => typeof value === 'number');

export const makeCardId = ({ suit, rank }: { suit: Suit; rank: Rank }): string => `${suit}-${rank}`;

export const createDeck = (): CardModel[] =>
    Object.values(Suit).flatMap((suit) =>
        ranks.map((rank) => ({ id: makeCardId({ suit, rank }), suit, rank, faceUp: false })),
    );

// Fisher–Yates driven by the seeded PRNG. Swaps happen on a local copy; the input is never touched.
// T excludes undefined so a missing element can only mean an out-of-range index.
export const shuffle = <T extends NonNullable<unknown>>({
    items,
    seed,
}: {
    items: readonly T[];
    seed: number;
}): T[] => {
    const result = [...items];
    const swapIndices = Array.from({ length: Math.max(result.length - 1, 0) }, (_, k) => result.length - 1 - k);

    swapIndices.reduce((currentSeed, i) => {
        const { value, seed: next } = nextRandom(currentSeed);
        const j = Math.floor(value * (i + 1));
        const a = result[i];
        const b = result[j];

        if (a === undefined || b === undefined) {
            throw new Error(`shuffle: swap index out of bounds — i=${i}, j=${j}, length=${result.length}`);
        }

        result[i] = b;
        result[j] = a;

        return next;
    }, seed);

    return result;
};
