import { PileRefModel } from './drag.utils.ts';
import { PileKind } from '../board/layout.utils.ts';

const pileKinds: readonly string[] = Object.values(PileKind);

const isPileKind = (value: string): value is PileKind => pileKinds.includes(value);

// Reads the pile an element belongs to from its data-pile / data-pile-index attributes (DOM boundary).
export const pileRefFromElement = (element: Element): PileRefModel | undefined => {
    const pile = element.getAttribute('data-pile') ?? '';
    const pileIndex = Number(element.getAttribute('data-pile-index'));

    if (!isPileKind(pile) || !Number.isInteger(pileIndex)) return undefined;

    return { pile, pileIndex };
};
