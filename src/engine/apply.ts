import { replaceAt } from './setters.ts';
import { canApplyMove } from './rules.ts';
import { isFaceDown, topCard } from './selectors.ts';
import { clampScore, REVEAL_BONUS, scoreMove } from './scoring.ts';
import { DrawMode, GameStateModel, MoveKind, MoveOf, PileModel } from './model.ts';

const drawCountMap: Record<DrawMode, number> = { [DrawMode.One]: 1, [DrawMode.Three]: 3 };

// Each transition only relocates cards; it runs after canApplyMove has accepted the move.
type TransitionMap = { [K in MoveKind]: (args: { state: GameStateModel; move: MoveOf<K> }) => GameStateModel };

const transitionMap: TransitionMap = {
    [MoveKind.Draw]: ({ state }) => {
        const count = Math.min(drawCountMap[state.drawMode], state.stock.length);
        const drawn = state.stock
            .slice(state.stock.length - count)
            .reverse()
            .map((card) => ({ ...card, faceUp: true }));

        return {
            ...state,
            stock: state.stock.slice(0, state.stock.length - count),
            waste: [...state.waste, ...drawn],
            wasteFan: count,
        };
    },
    [MoveKind.Recycle]: ({ state }) => ({
        ...state,
        stock: [...state.waste].reverse().map((card) => ({ ...card, faceUp: false })),
        waste: [],
        wasteFan: 0,
        recycles: state.recycles + 1,
    }),
    [MoveKind.WasteToTableau]: ({ state, move }) => ({
        ...takeFromWaste(state),
        tableau: placeOn({ piles: state.tableau, index: move.to, cards: state.waste.slice(-1) }),
    }),
    [MoveKind.WasteToFoundation]: ({ state, move }) => ({
        ...takeFromWaste(state),
        foundations: placeOn({ piles: state.foundations, index: move.to, cards: state.waste.slice(-1) }),
    }),
    [MoveKind.TableauToTableau]: ({ state, move }) => {
        const source = pileAt({ piles: state.tableau, index: move.from });
        const runStart = source.findIndex((card) => card.id === move.cardId);
        const lifted = replaceAt({ items: state.tableau, index: move.from, value: source.slice(0, runStart) });

        return { ...state, tableau: placeOn({ piles: lifted, index: move.to, cards: source.slice(runStart) }) };
    },
    [MoveKind.TableauToFoundation]: ({ state, move }) => {
        const source = pileAt({ piles: state.tableau, index: move.from });

        return {
            ...state,
            tableau: replaceAt({ items: state.tableau, index: move.from, value: source.slice(0, -1) }),
            foundations: placeOn({ piles: state.foundations, index: move.to, cards: source.slice(-1) }),
        };
    },
    [MoveKind.FoundationToTableau]: ({ state, move }) => {
        const source = pileAt({ piles: state.foundations, index: move.from });

        return {
            ...state,
            foundations: replaceAt({ items: state.foundations, index: move.from, value: source.slice(0, -1) }),
            tableau: placeOn({ piles: state.tableau, index: move.to, cards: source.slice(-1) }),
        };
    },
};

// Playing the top waste card shrinks the turn-3 fan by one, but a non-empty waste always shows one.
const takeFromWaste = (state: GameStateModel): GameStateModel => {
    const waste = state.waste.slice(0, -1);

    return { ...state, waste, wasteFan: waste.length === 0 ? 0 : Math.max(1, state.wasteFan - 1) };
};

const pileAt = ({ piles, index }: { piles: readonly PileModel[]; index: number }): PileModel => {
    const pile = piles[index];

    if (pile === undefined) throw new Error(`applyMove: no pile at index ${index} — pile count=${piles.length}`);

    return pile;
};

const placeOn = ({
    piles,
    index,
    cards,
}: {
    piles: readonly PileModel[];
    index: number;
    cards: PileModel;
}): PileModel[] => replaceAt({ items: piles, index, value: [...pileAt({ piles, index }), ...cards] });

// Any tableau column left with a face-down top card turns it face-up.
const revealTableauTops = (tableau: readonly PileModel[]): { tableau: PileModel[]; revealed: number } => {
    const revealed = tableau.filter(hasFaceDownTop).length;

    return { tableau: tableau.map((column) => (hasFaceDownTop(column) ? revealTop(column) : column)), revealed };
};

const hasFaceDownTop = (column: PileModel): boolean => {
    const top = topCard(column);

    return top !== undefined && isFaceDown(top);
};

const revealTop = (column: PileModel): PileModel =>
    column.map((card, i) => (i === column.length - 1 ? { ...card, faceUp: true } : card));

// Applies a legal move and returns the next state; an illegal move returns the same state object.
export const applyMove = <K extends MoveKind>({
    state,
    move,
}: {
    state: GameStateModel;
    move: MoveOf<K>;
}): GameStateModel => {
    if (!canApplyMove({ state, move })) return state;

    const moved = transitionMap[move.kind]({ state, move });
    const { tableau, revealed } = revealTableauTops(moved.tableau);

    return {
        ...moved,
        tableau,
        score: clampScore(state.score + scoreMove({ state, move }) + revealed * REVEAL_BONUS),
        moves: state.moves + 1,
    };
};
