import { listLegalMoves } from './rules.ts';
import { isPointlessMove } from './click-move.ts';
import { GameStateModel, Move, MoveKind, MoveOf } from './model.ts';

type FoundationMove = MoveOf<MoveKind.WasteToFoundation | MoveKind.TableauToFoundation>;

const foundationKinds: ReadonlySet<MoveKind> = new Set([MoveKind.WasteToFoundation, MoveKind.TableauToFoundation]);

const isFoundationMove = (move: Move): move is FoundationMove => foundationKinds.has(move.kind);

// An Ace can go to any empty foundation; that is one hint, not four.
const isRepeatFoundationHint = ({ move, index, moves }: { move: Move; index: number; moves: readonly Move[] }) =>
    isFoundationMove(move) &&
    moves.slice(0, index).some((earlier) => isFoundationMove(earlier) && earlier.cardId === move.cardId);

// How useful each kind of move is as a hint; lower is shown first, a kind missing here is never shown.
const hintRankMap: Partial<Record<MoveKind, number>> = {
    [MoveKind.WasteToFoundation]: 0,
    [MoveKind.TableauToFoundation]: 0,
    [MoveKind.TableauToTableau]: 1,
    [MoveKind.WasteToTableau]: 2,
    [MoveKind.Draw]: 3,
    [MoveKind.Recycle]: 3,
};

// The moves worth suggesting, most useful first: up to a foundation, then a column move that turns a card over or
// empties its column, then the waste onto a column, then the stock — always last, so cycling the hints ends on it.
// Never a card back off a foundation, never a run shifted to an equal place. Empty when nothing plays and nothing
// is left to draw.
export const listHints = (state: GameStateModel): Move[] =>
    listLegalMoves(state)
        .filter((move) => !isPointlessMove({ state, move }))
        .filter((move, index, moves) => !isRepeatFoundationHint({ move, index, moves }))
        .flatMap((move) => {
            const rank = hintRankMap[move.kind];

            return rank === undefined ? [] : [{ move, rank }];
        })
        .sort((a, b) => a.rank - b.rank)
        .map(({ move }) => move);
