import { CardModel } from '~/engine/index.ts';
import { getCanvasContext } from '~/utils/get-canvas-context.ts';

import { BoundsModel } from './cascade.utils.ts';
import { cornerRatioOf, RectModel } from './celebration.utils.ts';
import { isRedSuit, rankLabelMap, suitGlyphMap } from '../board/board.utils.ts';

// The card colours come from the palette tokens in global.scss, so the cascade matches the table's cards.
export type CardPaintModel = {
    readonly ivory: string;
    readonly edge: string;
    readonly ink: string;
    readonly inkRed: string;
    readonly fontFamily: string;
    readonly cornerRatio: number;
};

const RANK_FONT_RATIO = 0.22;
const INSET_RATIO = 0.1;

export const readCardPaint = (): CardPaintModel => {
    const root = getComputedStyle(document.documentElement);
    const token = (name: string): string => root.getPropertyValue(name).trim();

    return {
        ivory: token('--card-ivory'),
        edge: token('--card-edge'),
        ink: token('--ink'),
        inkRed: token('--ink-red'),
        fontFamily: getComputedStyle(document.body).fontFamily,
        cornerRatio: readCornerRatio(),
    };
};

// --radius is a calc() over the card width, so it is read off a rendered card, not the token.
const readCornerRatio = (): number => {
    const [card] = document.querySelectorAll('[data-card-id]');

    if (card === undefined) return 0;

    return cornerRatioOf({
        radius: getComputedStyle(card).borderTopLeftRadius,
        width: card.getBoundingClientRect().width,
    });
};

// The empty foundation slot the board draws under each pile (it carries no card id).
export const measureFoundationRect = (foundation: number): RectModel | undefined => {
    const [element] = document.querySelectorAll(
        `[data-pile="foundation"][data-pile-index="${foundation}"]:not([data-card-id])`,
    );

    return element === undefined ? undefined : element.getBoundingClientRect();
};

// Sized in device pixels so the cards stay sharp on high-density screens; drawing stays in CSS pixels and is
// clipped to the band from `paintTop` down, so trails never cover the scoreboard. Resizing the bitmap clears it.
export const prepareCanvas = ({
    canvas,
    bounds,
    paintTop,
}: {
    canvas: HTMLCanvasElement;
    bounds: BoundsModel;
    paintTop: number;
}): CanvasRenderingContext2D | undefined => {
    const ratio = window.devicePixelRatio;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    const context = getCanvasContext(canvas);

    if (context === undefined) return undefined;

    context.scale(ratio, ratio);
    context.beginPath();
    context.rect(0, paintTop, bounds.width, bounds.height - paintTop);
    context.clip();

    return context;
};

// Never cleared between frames: each card leaves the classic trail of copies behind it.
export const paintCard = ({
    context,
    card,
    at,
    paint,
}: {
    context: CanvasRenderingContext2D;
    card: CardModel;
    at: RectModel;
    paint: CardPaintModel;
}): void => {
    const inset = at.width * INSET_RATIO;
    context.fillStyle = paint.ivory;
    context.strokeStyle = paint.edge;
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(at.left, at.top, at.width, at.height, at.width * paint.cornerRatio);
    context.fill();
    context.stroke();
    context.fillStyle = isRedSuit(card.suit) ? paint.inkRed : paint.ink;
    context.font = `600 ${Math.round(at.width * RANK_FONT_RATIO)}px ${paint.fontFamily}`;
    context.textBaseline = 'top';
    context.fillText(`${rankLabelMap[card.rank]}${suitGlyphMap[card.suit]}`, at.left + inset, at.top + inset);
};
