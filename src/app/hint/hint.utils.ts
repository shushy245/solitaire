import { GameStateModel, listHints, Move, MoveKind, PileModel, topCard } from '~/engine/index.ts';

import { PileKind } from '../board/layout.utils.ts';
import { PileRefModel } from '../drag/drag.utils.ts';

export enum HintKind {
    Showing = 'showing',
    NoMoves = 'no-moves',
}

// The hint last asked for, always tied to the game it was worked out for: a move made since makes it stale.
// The move is kept with its place in the list, so lighting it never works the list out again.
export type HintModel =
    | { kind: HintKind.Showing; game: GameStateModel; index: number; move: Move }
    | { kind: HintKind.NoMoves; game: GameStateModel };

// What a hint lights up: the cards that would move, the card they land on (in `cardIds` too), or — when they land on
// an empty pile — that pile; the stock for a draw or a recycle.
export type HighlightModel = { cardIds: ReadonlySet<string>; pile: PileRefModel | undefined; isStock: boolean };

// How long a hint stays lit.
export const HINT_SHOWN_MS = 2000;

export const isShowingHint = (hint: HintModel | undefined): hint is HintModel & { kind: HintKind.Showing } =>
    hint !== undefined && hint.kind === HintKind.Showing;

const isSameGame = ({ hint, game }: { hint: HintModel; game: GameStateModel }): boolean => hint.game === game;

// The one staleness rule: a hint is shown only while it is visible and the game is the one it was worked out for.
export const isCurrentHint = ({
    hint,
    isVisible,
    game,
}: {
    hint: HintModel | undefined;
    isVisible: boolean;
    game: GameStateModel;
}): boolean => isVisible && hint !== undefined && isSameGame({ hint, game });

// The hint after `previous`: the next one for the same game (wrapping round), the first for a changed game. A stuck
// game has none — its deck can still be drawn, but nothing it turns up will ever play.
export const nextHint = ({
    previous,
    game,
    isGameStuck,
}: {
    previous: HintModel | undefined;
    game: GameStateModel;
    isGameStuck: boolean;
}): HintModel => {
    const hints = isGameStuck ? [] : listHints(game);
    const index =
        isShowingHint(previous) && isSameGame({ hint: previous, game }) ? (previous.index + 1) % hints.length : 0;
    const move = hints[index];

    return move === undefined ? { kind: HintKind.NoMoves, game } : { kind: HintKind.Showing, game, index, move };
};

// The kind of pile each hinted move lands on; a draw or a recycle lands on no pile (it is the stock's own move).
const targetPileKindMap: Partial<Record<MoveKind, PileKind>> = {
    [MoveKind.WasteToTableau]: PileKind.Tableau,
    [MoveKind.TableauToTableau]: PileKind.Tableau,
    [MoveKind.WasteToFoundation]: PileKind.Foundation,
    [MoveKind.TableauToFoundation]: PileKind.Foundation,
};

const targetPileOf = (move: Move): PileRefModel | undefined => {
    const pile = targetPileKindMap[move.kind];

    return pile === undefined || !('to' in move) ? undefined : { pile, pileIndex: move.to };
};

const pileAt = ({ game, pile }: { game: GameStateModel; pile: PileRefModel }): PileModel =>
    (pile.pile === PileKind.Tableau ? game.tableau : game.foundations)[pile.pileIndex] ?? [];

// The moving card plus every card above it (a run moves together); a waste or foundation card moves alone.
const movingCardIds = ({ game, move }: { game: GameStateModel; move: Move }): string[] => {
    if (!('cardId' in move) || move.kind === MoveKind.Draw) return [];
    if (move.kind !== MoveKind.TableauToTableau) return [move.cardId];

    const column = game.tableau[move.from] ?? [];

    return column.slice(column.findIndex((card) => card.id === move.cardId)).map((card) => card.id);
};

const stockKinds: ReadonlySet<MoveKind> = new Set([MoveKind.Draw, MoveKind.Recycle]);

const isStockMove = (move: Move): boolean => stockKinds.has(move.kind);

export const highlightOf = ({ game, move }: { game: GameStateModel; move: Move }): HighlightModel => {
    const target = targetPileOf(move);
    const landing = target === undefined ? undefined : topCard(pileAt({ game, pile: target }));
    const cardIds = movingCardIds({ game, move });

    return {
        cardIds: new Set(landing === undefined ? cardIds : [...cardIds, landing.id]),
        pile: landing === undefined ? target : undefined,
        isStock: isStockMove(move),
    };
};

// What to light up now: nothing once the hint has faded, nor once the game has moved on from it.
export const shownHighlight = (args: {
    hint: HintModel | undefined;
    isVisible: boolean;
    game: GameStateModel;
}): HighlightModel | undefined => {
    const { hint, game } = args;

    if (!isCurrentHint(args) || !isShowingHint(hint)) return undefined;

    return highlightOf({ game, move: hint.move });
};

const isNoMovesHint = (hint: HintModel | undefined): boolean => hint !== undefined && hint.kind === HintKind.NoMoves;

export const isNoMovesShown = (args: {
    hint: HintModel | undefined;
    isVisible: boolean;
    game: GameStateModel;
}): boolean => isCurrentHint(args) && isNoMovesHint(args.hint);

export const isHintedCard = ({
    highlight,
    cardId,
}: {
    highlight: HighlightModel | undefined;
    cardId: string;
}): boolean => highlight !== undefined && highlight.cardIds.has(cardId);

export const isHintedPile = ({
    highlight,
    pile,
}: {
    highlight: HighlightModel | undefined;
    pile: PileRefModel;
}): boolean =>
    highlight !== undefined &&
    highlight.pile !== undefined &&
    highlight.pile.pile === pile.pile &&
    highlight.pile.pileIndex === pile.pileIndex;

export const isHintedStock = (highlight: HighlightModel | undefined): boolean =>
    highlight !== undefined && highlight.isStock;

const hasModifier = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey || event.altKey;

const isHKey = (event: KeyboardEvent): boolean => event.key.toLowerCase() === 'h';

export const isHintShortcut = (event: KeyboardEvent): boolean => isHKey(event) && !event.repeat && !hasModifier(event);

export type HintContextValue = {
    // What to light up right now; undefined when no hint is showing.
    highlight: HighlightModel | undefined;
    // True while the latest hint request found nothing to suggest (shown for as long as a hint would be).
    isNoMoves: boolean;
    // Hints are off while the cards are dealt or sent home, and once the game is won.
    canHint: boolean;
    // True while hints are on and the game can make no more progress (`isStuck`).
    isGameOver: boolean;
    showHint: () => void;
    // The board tells the provider when the table is laid out, so a request mid-deal is refused, not wasted.
    reportTableReady: (isReady: boolean) => void;
};
