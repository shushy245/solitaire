import { applyMove } from './apply.ts';
import { listLegalMoves } from './rules.ts';
import { canStackOnFoundation, topCard } from './selectors.ts';
import { GameStateModel, Move, MoveKind, MoveOf } from './model.ts';
import { isOntoEmptyColumn, isPointlessMove, isRevealingMove } from './click-move.ts';

type FoundationMove = MoveOf<MoveKind.WasteToFoundation | MoveKind.TableauToFoundation>;

const foundationKinds: ReadonlySet<MoveKind> = new Set([MoveKind.WasteToFoundation, MoveKind.TableauToFoundation]);

const isFoundationMove = (move: Move): move is FoundationMove => foundationKinds.has(move.kind);

const isOntoEmptyPile = ({ state, move }: { state: GameStateModel; move: Move }): boolean =>
    isFoundationMove(move) || isOntoEmptyColumn({ state, move });

const cardIdOf = (move: Move): string | undefined => ('cardId' in move ? move.cardId : undefined);

// An Ace fits every empty foundation and a King every empty column; that is one hint, not one per empty pile.
const isRepeatHint = ({
    state,
    move,
    index,
    moves,
}: {
    state: GameStateModel;
    move: Move;
    index: number;
    moves: readonly Move[];
}): boolean =>
    isOntoEmptyPile({ state, move }) &&
    moves
        .slice(0, index)
        .some(
            (earlier) =>
                cardIdOf(earlier) === cardIdOf(move) &&
                earlier.kind === move.kind &&
                isOntoEmptyPile({ state, move: earlier }),
        );

// A column move that leaves a card on top of its column which can then go home — the one run split worth making.
const isFreeingMove = ({ state, move }: { state: GameStateModel; move: Move }): boolean => {
    if (move.kind !== MoveKind.TableauToTableau) return false;

    const after = applyMove({ state, move });
    const freed = topCard(after.tableau[move.from] ?? []);

    return freed !== undefined && after.foundations.some((pile) => canStackOnFoundation({ card: freed, pile }));
};

const isWorthHinting = ({ state, move }: { state: GameStateModel; move: Move }): boolean =>
    !isPointlessMove({ state, move }) || isFreeingMove({ state, move });

const isUncoveringMove = ({ state, move }: { state: GameStateModel; move: Move }): boolean =>
    isRevealingMove({ state, move }) || isFreeingMove({ state, move });

// How useful a move is as a hint; lower is shown first, undefined is never shown. A column move ranks high when it
// turns a card over, low when it only empties its column.
const hintRankMap: { [K in MoveKind]: (args: { state: GameStateModel; move: Move }) => number | undefined } = {
    [MoveKind.WasteToFoundation]: () => 0,
    [MoveKind.TableauToFoundation]: () => 0,
    [MoveKind.TableauToTableau]: ({ state, move }) => (isUncoveringMove({ state, move }) ? 1 : 3),
    [MoveKind.WasteToTableau]: () => 2,
    [MoveKind.FoundationToTableau]: () => undefined,
    [MoveKind.Draw]: () => 4,
    [MoveKind.Recycle]: () => 4,
};

// The moves worth suggesting, most useful first: up to a foundation, then a column move that turns a card over or
// frees one for its foundation, then the waste onto a column, then a column move that empties its column, then the
// stock — always last, so cycling the hints ends on it. Never a card back off a foundation, never a run shifted to an
// equal place for nothing. Empty when nothing plays and nothing is left to draw.
export const listHints = (state: GameStateModel): Move[] =>
    listLegalMoves(state)
        .filter((move) => isWorthHinting({ state, move }))
        .filter((move, index, moves) => !isRepeatHint({ state, move, index, moves }))
        .flatMap((move) => {
            const rank = hintRankMap[move.kind]({ state, move });

            return rank === undefined ? [] : [{ move, rank }];
        })
        .sort((a, b) => a.rank - b.rank)
        .map(({ move }) => move);
