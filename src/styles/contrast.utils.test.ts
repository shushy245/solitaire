import { describe, expect, it } from 'vitest';

import { compositeOver, contrastRatio, readColorTokens, relativeLuminance } from './contrast.utils.ts';

import globalScss from './global.scss?raw';

const tokens = readColorTokens(globalScss);
const token = (name: string): string => {
    const value = tokens.get(name);

    if (value === undefined) throw new Error(`contrast test: token ${name} missing from global.scss`);

    return value;
};
const felt = token('--baize');
const PREVIOUS_FELT = '#0d4a43';

describe('contrastRatio', () => {
    it('is 21 for black on white and 1 for a colour on itself', () => {
        expect(contrastRatio({ a: '#000000', b: '#ffffff' })).toBeCloseTo(21);
        expect(contrastRatio({ a: '#136a55', b: '#136a55' })).toBeCloseTo(1);
    });

    it('composites a translucent colour over its background before comparing', () => {
        expect(compositeOver({ color: 'rgb(255 255 255 / 0.5)', background: '#000000' })).toBe('#808080');
    });
});

describe('the felt palette', () => {
    it('is brighter than the original felt', () => {
        expect(relativeLuminance(felt)).toBeGreaterThan(relativeLuminance(PREVIOUS_FELT));
    });

    it('keeps text at 4.5:1 or better on the felt, muted text included', () => {
        expect(contrastRatio({ a: token('--text'), b: felt })).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio({ a: token('--text-muted'), b: felt })).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps control outlines and focus rings at 3:1 or better on the felt', () => {
        const controlLine = compositeOver({ color: token('--control-line'), background: felt });

        expect(contrastRatio({ a: controlLine, b: felt })).toBeGreaterThanOrEqual(3);
        expect(contrastRatio({ a: token('--brass'), b: felt })).toBeGreaterThanOrEqual(3);
    });

    it('keeps empty pile outlines, which are drop targets, at 3:1 or better', () => {
        const slotLine = compositeOver({ color: token('--slot-line'), background: felt });

        expect(contrastRatio({ a: slotLine, b: felt })).toBeGreaterThanOrEqual(3);
    });

    it('keeps button text at 4.5:1 or better while the button is hovered', () => {
        const hovered = compositeOver({ color: token('--control-hover'), background: felt });

        expect(contrastRatio({ a: token('--text'), b: hovered })).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps a hint ring at 3:1 or better on the felt, where it shows around a card or pile', () => {
        expect(contrastRatio({ a: token('--hint'), b: felt })).toBeGreaterThanOrEqual(3);
    });

    it('keeps card faces and their ink readable', () => {
        expect(contrastRatio({ a: token('--card-ivory'), b: felt })).toBeGreaterThanOrEqual(3);
        expect(contrastRatio({ a: token('--ink'), b: token('--card-ivory') })).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio({ a: token('--ink-red'), b: token('--card-ivory') })).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio({ a: token('--ink'), b: token('--brass') })).toBeGreaterThanOrEqual(4.5);
    });
});
