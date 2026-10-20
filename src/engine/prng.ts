// mulberry32 as a pure step function: the generator's state is the seed it returns, so the engine
// stays deterministic and replayable — the same seed always deals the same game.
export const nextRandom = (seed: number): { value: number; seed: number } => {
    const next = (seed + 0x6d2b79f5) | 0;
    const mixed = Math.imul(next ^ (next >>> 15), 1 | next);
    const remixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;

    return { value: ((remixed ^ (remixed >>> 14)) >>> 0) / 0x100000000, seed: next };
};

export const randomSequence = ({ seed, length }: { seed: number; length: number }): number[] =>
    Array.from({ length }).reduce<{ values: number[]; seed: number }>(
        (acc) => {
            const { value, seed: next } = nextRandom(acc.seed);

            return { values: [...acc.values, value], seed: next };
        },
        { values: [], seed },
    ).values;
