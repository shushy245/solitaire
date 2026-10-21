import { z } from 'zod';

import { DrawMode } from '~/engine/index.ts';

// ?seed= is external input: plain decimal digits in the 32-bit range, or it is ignored.
const SeedParamSchema = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(
        z
            .number()
            .int()
            .max(2 ** 32 - 1),
    );

export const seedFromSearch = (search: string): number | undefined => {
    const parsed = SeedParamSchema.safeParse(new URLSearchParams(search).get('seed') ?? undefined);

    return parsed.success ? parsed.data : undefined;
};

const TURN_THREE_PARAM = '3';

// draw=3 replays a seed as turn 3; anything else, or nothing, is turn 1.
export const drawModeFromSearch = (search: string): DrawMode =>
    new URLSearchParams(search).get('draw') === TURN_THREE_PARAM ? DrawMode.Three : DrawMode.One;

// Once its deal is on the table the seed has done its job; left in the address, every reload would deal it
// again instead of resuming the game in progress.
export const searchWithoutSeed = (search: string): string => {
    const params = new URLSearchParams(search);
    params.delete('seed');
    params.delete('draw');
    const rest = params.toString();

    return rest === '' ? '' : `?${rest}`;
};

// The deal the page address asks for, if it names a seed.
export const dealFromSearch = (search: string): { seed: number; drawMode: DrawMode } | undefined => {
    const seed = seedFromSearch(search);

    return seed === undefined ? undefined : { seed, drawMode: drawModeFromSearch(search) };
};
