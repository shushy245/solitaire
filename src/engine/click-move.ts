import { listLegalMoves } from './rules.ts';
import { isEmptyPile, isFaceDown } from './selectors.ts';
import { GameStateModel, Move, MoveKind, MoveOf } from './model.ts';

type ToTableauMove = MoveOf<MoveKind.WasteToTableau | MoveKind.TableauToTableau | MoveKind.FoundationToTableau>;

const toTableauKinds: ReadonlySet<MoveKind> = new Set([
    MoveKind.WasteToTableau,
    MoveKind.TableauToTableau,
    MoveKind.FoundationToTableau,
]);

const isToTableau = (move: Move): move is ToTableauMove => toTableauKinds.has(move.kind);

const isOntoEmptyColumn = ({ state, move }: { state: GameStateModel; move: Move }): boolean =>
    isToTableau(move) && isEmptyPile(state.tableau[move.to] ?? []);

// The card a column-to-column move leaves showing: the one under the moved card, if any.
const cardUnder = ({ state, move }: { state: GameStateModel; move: MoveOf<MoveKind.TableauToTableau> }) => {
    const column = state.tableau[move.from] ?? [];

    return column[column.findIndex((card) => card.id === move.cardId) - 1];
};

// A legal move that changes nothing worth having. In real play a face-up card always lies on its own run, so
// moving off a face-up card only shifts the run to an equal place (and a click would ping-pong it); a run that
// already heads its column, moved to another empty one, is the same shift.
export const isPointlessMove = ({ state, move }: { state: GameStateModel; move: Move }): boolean => {
    if (move.kind !== MoveKind.TableauToTableau) return false;

    const under = cardUnder({ state, move });

    return under === undefined ? isOntoEmptyColumn({ state, move }) : !isFaceDown(under);
};

// How eagerly a click plays each kind of move; a kind missing here is never played by a click. Lower goes first.
const clickRankMap: Partial<Record<MoveKind, number>> = {
    [MoveKind.WasteToFoundation]: 0,
    [MoveKind.TableauToFoundation]: 0,
    [MoveKind.WasteToTableau]: 1,
    [MoveKind.TableauToTableau]: 1,
};

// An empty column is the last resort: it is worth more held back for a King than filled by a click.
const EMPTY_COLUMN_PENALTY = 1;

const clickRankOf = ({ state, move }: { state: GameStateModel; move: Move }): number | undefined => {
    const rank = clickRankMap[move.kind];

    if (rank === undefined) return undefined;

    return isOntoEmptyColumn({ state, move }) ? rank + EMPTY_COLUMN_PENALTY : rank;
};

// The obvious move for a click on `cardId`: up to its foundation, else (with the run above it) onto the first
// column that takes it, a column with cards before an empty one. Never back down off a foundation, never a
// pointless move, and nothing for a card with no move, a face-down card or the stock.
export const findClickMove = ({ state, cardId }: { state: GameStateModel; cardId: string }): Move | undefined => {
    const best = listLegalMoves(state)
        .filter((move) => 'cardId' in move && move.cardId === cardId && !isPointlessMove({ state, move }))
        .flatMap((move) => {
            const rank = clickRankOf({ state, move });

            return rank === undefined ? [] : [{ move, rank }];
        })
        .sort((a, b) => a.rank - b.rank)[0];

    return best === undefined ? undefined : best.move;
};
