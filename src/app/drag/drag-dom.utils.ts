import { z } from 'zod';

import { PileRefModel } from './drag.utils.ts';
import { PileKind } from '../board/layout.utils.ts';

// data-pile / data-pile-index are read back from the DOM, so they are parsed at this boundary.
const PileAttributesSchema = z.object({
    pile: z.enum(PileKind),
    pileIndex: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int()),
});

export const pileRefFromElement = (element: Element): PileRefModel | undefined => {
    const parsed = PileAttributesSchema.safeParse({
        pile: element.getAttribute('data-pile') ?? undefined,
        pileIndex: element.getAttribute('data-pile-index') ?? undefined,
    });

    return parsed.success ? parsed.data : undefined;
};
