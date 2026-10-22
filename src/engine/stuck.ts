import { applyMove } from './apply.ts';
import { listLegalMoves, makeDrawMove } from './rules.ts';
import { CardModel, GameStateModel, MoveKind, PileModel } from './model.ts';
import { canRecycle, canStackOnFoundation, canStackOnTableau, isFaceDown, isWon, topCard } from './selectors.ts';

// The search gives up past this many table positions and answers "not stuck" — a missed announcement, never a false
// one. Measured over 6,400 positions from random play: 99.9% search at most 128; the rare tables with long face-up
// runs that split many ways reach thousands at ~0.1ms each, and the cap keeps a move's check near 100ms at worst.
const MAX_POSITIONS = 1000;

const countFaceDown = (state: GameStateModel): number =>
    state.tableau.reduce((sum, column) => sum + column.filter(isFaceDown).length, 0);

const countHome = (state: GameStateModel): number => state.foundations.reduce((sum, pile) => sum + pile.length, 0);

const countDeck = (state: GameStateModel): number => state.stock.length + state.waste.length;

// Only cards taken down off foundations since `earlier`: no card turned over, no deck card played, fewer cards home.
// Face-down and deck counts only ever fall, so every position between the two had the same face-down cards and deck.
export const isTakeDownOf = ({ earlier, later }: { earlier: GameStateModel; later: GameStateModel }): boolean =>
    countFaceDown(later) === countFaceDown(earlier) &&
    countDeck(later) === countDeck(earlier) &&
    countHome(later) < countHome(earlier);

// Progress on the table, measured against where the search started — never move by move, so a card taken down
// off a foundation and put back is not progress.
const isTableProgress = ({ from, to }: { from: GameStateModel; to: GameStateModel }): boolean =>
    countFaceDown(to) < countFaceDown(from) || countHome(to) > countHome(from);

// The deck's next position with nothing played: a draw, else a recycle, else none (the deck is spent).
const turnDeck = (state: GameStateModel): GameStateModel | undefined => {
    const draw = makeDrawMove(state);

    if (draw !== undefined) return applyMove({ state, move: draw });

    return canRecycle(state) ? applyMove({ state, move: { kind: MoveKind.Recycle } }) : undefined;
};

// Every card that can lie on top of the waste while the deck is drawn and recycled with nothing played — in turn 3
// only the cards each draw of three leaves on top. Two passes round the deck (each card is drawn once a pass, and
// a pass ends with a recycle) visit every position however far into the cycle the deck starts.
const reachableWasteTops = (state: GameStateModel): CardModel[] => {
    const passSteps = state.stock.length + state.waste.length + 1;
    const positions = Array.from({ length: 2 * passSteps }).reduce<GameStateModel[]>(
        (visited) => {
            const last = visited[visited.length - 1];
            const next = last === undefined ? undefined : turnDeck(last);

            return next === undefined ? visited : [...visited, next];
        },
        [state],
    );

    return positions.flatMap((position) => {
        const top = topCard(position.waste);

        return top === undefined ? [] : [top];
    });
};

const canPlaySomewhere = ({ card, state }: { card: CardModel; state: GameStateModel }): boolean =>
    state.tableau.some((pile) => canStackOnTableau({ card, pile })) ||
    state.foundations.some((pile) => canStackOnFoundation({ card, pile }));

const pileKey = (pile: PileModel): string => pile.map((card) => (card.faceUp ? card.id : `~${card.id}`)).join(',');

// Two table positions are the same when every column and foundation holds the same cards.
const tableKey = (state: GameStateModel): string => [...state.foundations, ...state.tableau].map(pileKey).join('|');

// The table positions one table move away (the deck is set aside, so only table moves are legal).
const nextTables = (table: GameStateModel): GameStateModel[] =>
    listLegalMoves(table).map((move) => applyMove({ state: table, move }));

export enum StuckVerdict {
    Stuck = 'stuck',
    NotStuck = 'not-stuck',
    // The positions to search ran past the limit before an answer.
    GaveUp = 'gave-up',
}

// Whether any sequence of moves from here can turn a card over, play a card out of the deck or send one more card
// home. The deck and the table meet only when a waste card is played, so the deck is cycled once for every card it
// can show, then every table position reachable without progress (column shifts, cards down off a foundation and
// back) is searched for progress or a place one of those cards would go — giving up past `maxPositions`.
export const judgeStuck = ({ start, maxPositions }: { start: GameStateModel; maxPositions: number }): StuckVerdict => {
    if (isWon(start)) return StuckVerdict.NotStuck;

    const deckCards = reachableWasteTops(start);
    const startTable: GameStateModel = { ...start, stock: [], waste: [], wasteFan: 0 };
    const seen = new Set([tableKey(startTable)]);
    const frontier: GameStateModel[] = [startTable];
    const isProgressAt = (table: GameStateModel): boolean =>
        isTableProgress({ from: startTable, to: table }) ||
        deckCards.some((card) => canPlaySomewhere({ card, state: table }));

    for (const table of frontier) {
        if (isProgressAt(table)) return StuckVerdict.NotStuck;
        if (seen.size > maxPositions) return StuckVerdict.GaveUp;

        nextTables(table).forEach((next) => {
            const key = tableKey(next);

            if (seen.has(key)) return;

            seen.add(key);
            frontier.push(next);
        });
    }

    return StuckVerdict.Stuck;
};

// True when no progress is possible, so the game can never be won. A search that gives up answers "not stuck" — a
// missed announcement, never a false one. Not a solver: a lost deal that still has progress to make is not stuck.
export const isStuck = (start: GameStateModel): boolean =>
    judgeStuck({ start, maxPositions: MAX_POSITIONS }) === StuckVerdict.Stuck;
