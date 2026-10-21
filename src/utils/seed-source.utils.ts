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

// A deal the page address asks for by seed and draw mode.
export type RequestedDealModel = { readonly seed: number; readonly drawMode: DrawMode };

// ?draw= is external input too: 1 or 3, or it is ignored (turn 1).
const DrawParamSchema = z.enum(['1', '3']);

const drawParamMap: Record<z.infer<typeof DrawParamSchema>, DrawMode> = { '1': DrawMode.One, '3': DrawMode.Three };

export const drawModeFromSearch = (search: string): DrawMode => {
    const parsed = DrawParamSchema.safeParse(new URLSearchParams(search).get('draw') ?? undefined);

    return parsed.success ? drawParamMap[parsed.data] : DrawMode.One;
};

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
export const dealFromSearch = (search: string): RequestedDealModel | undefined => {
    const seed = seedFromSearch(search);

    return seed === undefined ? undefined : { seed, drawMode: drawModeFromSearch(search) };
};
