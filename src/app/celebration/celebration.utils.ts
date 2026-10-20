import { CardModel, GameStateModel } from '~/engine/index.ts';

import { formatElapsed } from '../hud/hud.utils.ts';
import { BoundsModel, LaunchModel, launchOrder } from './cascade.utils.ts';

export type WinOverlayProps = { elapsedMs: number; score: number; onNewGame: () => void };

export type WinCascadeProps = { game: GameStateModel };

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

// Each foundation card leaves from where it sits on screen; a card that is not on screen is not launched.
export const planLaunches = ({
    game,
    rectOf,
}: {
    game: GameStateModel;
    rectOf: (cardId: string) => RectModel | undefined;
}): { launches: LaunchModel[]; cardSize: { width: number; height: number } | undefined } => {
    const measured = launchOrder(game.foundations).flatMap((cardId) => {
        const rect = rectOf(cardId);

        return rect === undefined ? [] : [{ cardId, rect }];
    });
    const [first] = measured;

    return {
        launches: measured.map(({ cardId, rect }) => ({ cardId, from: { x: rect.left, y: rect.top } })),
        cardSize: first === undefined ? undefined : { width: first.rect.width, height: first.rect.height },
    };
};

export const viewportBounds = ({
    width,
    height,
    cardSize,
}: {
    width: number;
    height: number;
    cardSize: { width: number; height: number };
}): BoundsModel => ({ width, height, cardWidth: cardSize.width, cardHeight: cardSize.height });
