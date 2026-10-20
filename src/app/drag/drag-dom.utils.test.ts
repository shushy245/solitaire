import { describe, expect, it } from 'vitest';

import { PileKind } from '../board/layout.utils.ts';
import { pileRefFromElement } from './drag-dom.utils.ts';

const elementWith = (attributes: Record<string, string>) => {
    const element = document.createElement('span');
    Object.entries(attributes).forEach(([name, value]) => {
        element.setAttribute(name, value);
    });

    return element;
};

describe('pileRefFromElement', () => {
    it('reads the pile and its index', () => {
        expect(pileRefFromElement(elementWith({ 'data-pile': 'tableau', 'data-pile-index': '3' }))).toEqual({
            pile: PileKind.Tableau,
            pileIndex: 3,
        });
    });

    it('ignores an element with a missing or malformed index or an unknown pile', () => {
        const malformed = [
            elementWith({ 'data-pile': 'tableau' }),
            elementWith({ 'data-pile': 'tableau', 'data-pile-index': '' }),
            elementWith({ 'data-pile': 'tableau', 'data-pile-index': '-1' }),
            elementWith({ 'data-pile': 'sideboard', 'data-pile-index': '0' }),
        ];

        expect(malformed.map(pileRefFromElement).filter((ref) => ref !== undefined)).toEqual([]);
    });
});
