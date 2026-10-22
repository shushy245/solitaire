import { CardModel, GameStateModel } from '~/engine/index.ts';

import { formatElapsed } from '../hud/hud.utils.ts';
import { BoundsModel, LaunchModel, launchOrder } from './cascade.utils.ts';

export type WinOverlayProps = { elapsedMs: number; score: number; onNewGame: () => void };

export type WinCascadeProps = { game: GameStateModel };

// The canvas as sized for the current window, and its drawing context (none where the browser cannot draw).
export type FittedCanvasModel = {
    readonly bounds: BoundsModel;
    readonly context: CanvasRenderingContext2D | undefined;
};

export type RectModel = {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
};

export const winSummary = ({ elapsedMs, score }: { elapsedMs: number; score: number }): string =>
    `${formatElapsed(elapsedMs)} · ${score} points`;

export const cardsById = (game: GameStateModel): ReadonlyMap<string, CardModel> =>
    new Map(game.foundations.flat().map((card) => [card.id, card]));

export enum LaunchPlanKind {
    Nothing = 'nothing',
    Ready = 'ready',
}

export type SizeModel = { readonly width: number; readonly height: number };

// Ready: cards to launch, the size to draw them, and the top of the band they may be painted in (the
// foundation row — the scoreboard above it stays clear).
export type LaunchPlanModel =
    | { readonly kind: LaunchPlanKind.Nothing }
    | {
          readonly kind: LaunchPlanKind.Ready;
          readonly launches: readonly LaunchModel[];
          readonly cardSize: SizeModel;
          readonly paintTop: number;
      };

// Each card leaves from its foundation's slot — measured from the slot, which never moves, rather than the card,
// which may still be gliding home with the winning move. A foundation not on screen launches nothing.
export const planLaunches = ({
    game,
    foundationRect,
}: {
    game: GameStateModel;
    foundationRect: (foundation: number) => RectModel | undefined;
}): LaunchPlanModel => {
    const slots = game.foundations.map((_, foundation) => foundationRect(foundation));
    const launches = launchOrder(game.foundations).flatMap((cardId) => {
        const rect = slots[game.foundations.findIndex((pile) => pile.some((card) => card.id === cardId))];

        return rect === undefined ? [] : [{ cardId, from: { x: rect.left, y: rect.top } }];
    });
    const measured = slots.filter((rect) => rect !== undefined);
    const [first] = measured;

    if (first === undefined || launches.length === 0) return { kind: LaunchPlanKind.Nothing };

    return {
        kind: LaunchPlanKind.Ready,
        launches,
        cardSize: { width: first.width, height: first.height },
        paintTop: Math.min(...measured.map((rect) => rect.top)),
    };
};

export const viewportBounds = ({
    width,
    height,
    cardSize,
}: {
    width: number;
    height: number;
    cardSize: SizeModel;
}): BoundsModel => ({ width, height, cardWidth: cardSize.width, cardHeight: cardSize.height });

const isMeasured = (value: number): boolean => Number.isFinite(value) && value > 0;

// A card's computed border radius (e.g. "10.4px") as a share of its width, so the cascade rounds its cards like the
// table's. An element that could not be measured gets square corners rather than a guessed curve.
export const cornerRatioOf = ({ radius, width }: { radius: string; width: number }): number => {
    const px = Number.parseFloat(radius);

    return isMeasured(px) && isMeasured(width) ? px / width : 0;
};
