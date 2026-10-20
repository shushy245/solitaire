import { CardModel, GameStateModel, MoveKind, MoveOf, PileModel } from './model.ts';
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
