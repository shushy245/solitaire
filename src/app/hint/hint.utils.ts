import { GameStateModel, listHints, Move, MoveKind, PileModel, topCard } from '~/engine/index.ts';

import { PileKind } from '../board/layout.utils.ts';
import { PileRefModel } from '../drag/drag.utils.ts';

export enum HintKind {
    Showing = 'showing',
    NoMoves = 'no-moves',
}

// The hint last asked for, always tied to the game it was worked out for: a move made since makes it stale.
export type HintModel =
    { kind: HintKind.Showing; game: GameStateModel; index: number } | { kind: HintKind.NoMoves; game: GameStateModel };

// What a hint lights up: the cards that would move, the card they land on (in `cardIds` too), or — when they land on
// an empty pile — that pile; the stock for a draw or a recycle.
export type HighlightModel = { cardIds: ReadonlySet<string>; pile: PileRefModel | undefined; isStock: boolean };

// How long a hint stays lit.
export const HINT_SHOWN_MS = 2000;

export const isShowingHint = (hint: HintModel | undefined): hint is HintModel & { kind: HintKind.Showing } =>
    hint !== undefined && hint.kind === HintKind.Showing;

export const isNoMovesHint = (hint: HintModel | undefined): boolean =>
    hint !== undefined && hint.kind === HintKind.NoMoves;

const isSameGame = ({ hint, game }: { hint: HintModel; game: GameStateModel }): boolean => hint.game === game;

// The hint after `previous`: the next one for the same game (wrapping round), the first for a changed game.
export const nextHint = ({ previous, game }: { previous: HintModel | undefined; game: GameStateModel }): HintModel => {
    const count = listHints(game).length;

    if (count === 0) return { kind: HintKind.NoMoves, game };

    const index = isShowingHint(previous) && isSameGame({ hint: previous, game }) ? (previous.index + 1) % count : 0;

    return { kind: HintKind.Showing, game, index };
};

// The kind of pile each move lands on; a draw or a recycle lands on no pile (it is the stock's own move).
const targetPileKindMap: Partial<Record<MoveKind, PileKind>> = {
    [MoveKind.WasteToTableau]: PileKind.Tableau,
    [MoveKind.TableauToTableau]: PileKind.Tableau,
    [MoveKind.FoundationToTableau]: PileKind.Tableau,
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

export const highlightOf = ({ game, move }: { game: GameStateModel; move: Move }): HighlightModel => {
    const target = targetPileOf(move);
    const landing = target === undefined ? undefined : topCard(pileAt({ game, pile: target }));
    const cardIds = movingCardIds({ game, move });

    return {
        cardIds: new Set(landing === undefined ? cardIds : [...cardIds, landing.id]),
        pile: landing === undefined ? target : undefined,
        isStock: target === undefined,
    };
};

// What to light up now: nothing once the hint has faded, nor once the game has moved on from it.
export const shownHighlight = ({
    hint,
    isVisible,
    game,
}: {
    hint: HintModel | undefined;
    isVisible: boolean;
    game: GameStateModel;
}): HighlightModel | undefined => {
    if (!isVisible || !isShowingHint(hint) || !isSameGame({ hint, game })) return undefined;

    const move = listHints(game)[hint.index];

    return move === undefined ? undefined : highlightOf({ game, move });
};

const hasModifier = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey || event.altKey;

const isHKey = (event: KeyboardEvent): boolean => event.key.toLowerCase() === 'h';

export const isHintShortcut = (event: KeyboardEvent): boolean => isHKey(event) && !event.repeat && !hasModifier(event);
