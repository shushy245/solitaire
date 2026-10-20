import { nextRandom } from '~/engine/prng.ts';

// The first `length` values the engine PRNG yields from `seed` — test-only, for pinning determinism.
export const randomSequence = ({ seed, length }: { seed: number; length: number }): number[] => {
    const values: number[] = [];

    Array.from({ length }).reduce<number>((current) => {
        const { value, seed: next } = nextRandom(current);
        values.push(value);

        return next;
    }, seed);

    return values;
};
