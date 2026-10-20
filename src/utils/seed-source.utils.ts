import { z } from 'zod';

// ?seed= is external input: a whole number in the 32-bit range, or it is ignored.
const SeedParamSchema = z.coerce
    .number()
    .int()
    .min(0)
    .max(2 ** 32 - 1);

export const seedFromSearch = (search: string): number | undefined => {
    const raw = new URLSearchParams(search).get('seed') ?? '';
    const parsed = SeedParamSchema.safeParse(raw);

    return raw === '' || !parsed.success ? undefined : parsed.data;
};

// Deals the requested seed first (replay a deal), then fresh random seeds for every new game.
export const makeSeedSource = ({
    firstSeed,
    generateSeed,
}: {
    firstSeed: number | undefined;
    generateSeed: () => number;
}): (() => number) => {
    const pending = firstSeed === undefined ? [] : [firstSeed];

    return () => pending.shift() ?? generateSeed();
};
