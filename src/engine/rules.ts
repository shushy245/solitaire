import { CardModel, GameStateModel, Move, MoveKind, MoveOf, PileModel } from './model.ts';
import { canStackOnFoundation, canStackOnTableau, isMovableRun, isTopCard, topCard } from './selectors.ts';

type RuleMap = { [K in MoveKind]: (args: { state: GameStateModel; move: MoveOf<K> }) => boolean };

const ruleMap: RuleMap = {
    [MoveKind.Draw]: ({ state }) => state.stock.length > 0,
    [MoveKind.Recycle]: ({ state }) => state.stock.length === 0 && state.waste.length > 0,
    [MoveKind.WasteToTableau]: ({ state, move }) =>
        canMoveTopCard({
            source: state.waste,
            cardId: move.cardId,
            target: state.tableau[move.to],
            canStack: canStackOnTableau,
        }),
    [MoveKind.WasteToFoundation]: ({ state, move }) =>
        canMoveTopCard({
            source: state.waste,
            cardId: move.cardId,
            target: state.foundations[move.to],
            canStack: canStackOnFoundation,
        }),
    [MoveKind.TableauToFoundation]: ({ state, move }) =>
        canMoveTopCard({
            source: state.tableau[move.from],
            cardId: move.cardId,
            target: state.foundations[move.to],
            canStack: canStackOnFoundation,
        }),
    [MoveKind.FoundationToTableau]: ({ state, move }) =>
        canMoveTopCard({
            source: state.foundations[move.from],
            cardId: move.cardId,
            target: state.tableau[move.to],
            canStack: canStackOnTableau,
        }),
    [MoveKind.TableauToTableau]: ({ state, move }) => {
        const source = state.tableau[move.from];
        const target = state.tableau[move.to];

        if (source === undefined || target === undefined || move.from === move.to) return false;

        const run = source.slice(source.findIndex((card) => card.id === move.cardId));
        const head = run[0];

        if (head === undefined || head.id !== move.cardId) return false;

        return isMovableRun(run) && canStackOnTableau({ card: head, pile: target });
    },
};

const canMoveTopCard = ({
    source,
    cardId,
    target,
    canStack,
}: {
    source: PileModel | undefined;
    cardId: string;
    target: PileModel | undefined;
    canStack: (args: { card: CardModel; pile: PileModel }) => boolean;
}): boolean => {
    if (source === undefined || target === undefined || !isTopCard({ pile: source, cardId })) return false;

    const card = topCard(source);

    return card !== undefined && card.faceUp && canStack({ card, pile: target });
};

export const canApplyMove = <K extends MoveKind>({
    state,
    move,
}: {
    state: GameStateModel;
    move: MoveOf<K>;
}): boolean => ruleMap[move.kind]({ state, move });

const indices = (count: number): number[] => Array.from({ length: count }, (_, i) => i);

// Every move that canApplyMove accepts from this state — the source of truth for "what can I do?".
export const listLegalMoves = (state: GameStateModel): Move[] => {
    const tableauIndices = indices(state.tableau.length);
    const foundationIndices = indices(state.foundations.length);
    const wasteTop = topCard(state.waste);

    const fromWaste: Move[] =
        wasteTop === undefined
            ? []
            : [
                  ...tableauIndices.map((to) => ({ kind: MoveKind.WasteToTableau, cardId: wasteTop.id, to }) as const),
                  ...foundationIndices.map(
                      (to) => ({ kind: MoveKind.WasteToFoundation, cardId: wasteTop.id, to }) as const,
                  ),
              ];

    const fromTableau: Move[] = state.tableau.flatMap((column, from) => [
        ...column.flatMap((card) =>
            tableauIndices.map((to) => ({ kind: MoveKind.TableauToTableau, cardId: card.id, from, to }) as const),
        ),
        ...topCards(column).flatMap((card) =>
            foundationIndices.map((to) => ({ kind: MoveKind.TableauToFoundation, cardId: card.id, from, to }) as const),
        ),
    ]);

    const fromFoundations: Move[] = state.foundations.flatMap((pile, from) =>
        topCards(pile).flatMap((card) =>
            tableauIndices.map((to) => ({ kind: MoveKind.FoundationToTableau, cardId: card.id, from, to }) as const),
        ),
    );

    const candidates: Move[] = [
        { kind: MoveKind.Draw },
        { kind: MoveKind.Recycle },
        ...fromWaste,
        ...fromTableau,
        ...fromFoundations,
    ];

    return candidates.filter((move) => canApplyMove({ state, move }));
};

const topCards = (pile: PileModel): CardModel[] => {
    const top = topCard(pile);

    return top === undefined ? [] : [top];
};
