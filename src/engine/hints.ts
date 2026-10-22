import { applyMove } from './apply.ts';
import { listLegalMoves } from './rules.ts';
import { GameStateModel, Move, MoveKind, MoveOf } from './model.ts';
import { isFreeingMove, isOntoEmptyColumn, isPointlessMoveGiven, isRevealingMove } from './click-move.ts';

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

// A card taken down off a foundation is worth it only as a base: once it lies on the column, a column card can go
// onto it and turn a card over or free one for home, or the waste can play onto it.
const isEnablingMove = ({ state, move }: { state: GameStateModel; move: Move }): boolean => {
    if (move.kind !== MoveKind.FoundationToTableau) return false;

    const after = applyMove({ state, move });

    return listLegalMoves(after).some(
        (next) =>
            'to' in next &&
            next.to === move.to &&
            (next.kind === MoveKind.WasteToTableau ||
                isUncoveringMove({
                    state: after,
                    move: next,
                    isFreeing: (candidate) => isFreeingMove({ state: after, move: candidate }),
                })),
    );
};

type FreeingCheck = (move: Move) => boolean;

// isFreeingMove applies the move to find out, and both the pointless filter and the ranking ask it of one move — so
// it is worked out once per move.
const freeingCheckFor = (state: GameStateModel): FreeingCheck => {
    const known = new Map<Move, boolean>();

    return (move) => {
        const remembered = known.get(move);

        if (remembered !== undefined) return remembered;

        const answer = isFreeingMove({ state, move });
        known.set(move, answer);

        return answer;
    };
};

type HintArgs = { state: GameStateModel; move: Move; isFreeing: FreeingCheck };

const isUncoveringMove = ({ state, move, isFreeing }: HintArgs): boolean =>
    isRevealingMove({ state, move }) || isFreeing(move);

// How useful a move is as a hint; lower is shown first, undefined is never shown. A column move ranks high when it
// turns a card over or frees one for its foundation, low when it only empties its column.
const hintRankMap: { [K in MoveKind]: (args: HintArgs) => number | undefined } = {
    [MoveKind.WasteToFoundation]: () => 0,
    [MoveKind.TableauToFoundation]: () => 0,
    [MoveKind.TableauToTableau]: (args) => (isUncoveringMove(args) ? 1 : 3),
    [MoveKind.WasteToTableau]: () => 2,
    [MoveKind.FoundationToTableau]: ({ state, move }) => (isEnablingMove({ state, move }) ? 3 : undefined),
    [MoveKind.Draw]: () => 4,
    [MoveKind.Recycle]: () => 4,
};

// A move home for a card the player took down off a foundation on purpose — never suggested back to them.
export const isReturnOfKeptCard = ({ move, keptOnTable }: { move: Move; keptOnTable: ReadonlySet<string> }): boolean =>
    isFoundationMove(move) && keptOnTable.has(move.cardId);

// The moves worth suggesting, most useful first: up to a foundation, then a column move that turns a card over or
// frees one for its foundation, then the waste onto a column, then a column move that empties its column, then the
// stock — always last, so cycling the hints ends on it. Never a card back off a foundation, never a pointless move.
// Empty when nothing plays and nothing is left to draw.
export const listHints = (state: GameStateModel): Move[] => {
    const isFreeing = freeingCheckFor(state);

    return listLegalMoves(state)
        .filter((move) => !isPointlessMoveGiven({ state, move, isFreeing }))
        .filter((move, index, moves) => !isRepeatHint({ state, move, index, moves }))
        .flatMap((move) => {
            const rank = hintRankMap[move.kind]({ state, move, isFreeing });

            return rank === undefined ? [] : [{ move, rank }];
        })
        .sort((a, b) => a.rank - b.rank)
        .map(({ move }) => move);
};
