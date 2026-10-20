import { z } from 'zod';

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
