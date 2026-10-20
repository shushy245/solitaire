import { canStackOnFoundation, isWon, topCard } from './selectors.ts';
import { CardModel, GameStateModel, MoveKind, MoveOf } from './model.ts';

// Auto-complete is offered once nothing is hidden and nothing is left to draw: from there every card
// can be sent up in rank order, so the game is guaranteed to finish.
export const isAutoCompletable = (state: GameStateModel): boolean =>
    state.stock.length === 0 &&
    state.waste.length === 0 &&
    state.tableau.every((column) => column.every((card) => card.faceUp)) &&
    !isWon(state);

// The foundation a card may go onto: the one building its suit, or the first empty one for an Ace.
export const findFoundationTarget = ({
    state,
    card,
}: {
    state: GameStateModel;
    card: CardModel;
}): number | undefined => {
    const index = state.foundations.findIndex((pile) => canStackOnFoundation({ card, pile }));

    return index === -1 ? undefined : index;
};

// The lowest-ranked tableau top that can go up. In an auto-completable state one always exists: the
// lowest remaining card of all is some column's top, and every lower card of its suit is already up.
export const nextAutoMove = (state: GameStateModel): MoveOf<MoveKind.TableauToFoundation> | undefined => {
    if (!isAutoCompletable(state)) return undefined;

    const candidates = state.tableau.flatMap((column, from) => {
        const card = topCard(column);
        const to = card === undefined ? undefined : findFoundationTarget({ state, card });

        return card === undefined || to === undefined ? [] : [{ card, from, to }];
    });
    const lowest = candidates.reduce<(typeof candidates)[number] | undefined>(
        (best, candidate) => (best === undefined || candidate.card.rank < best.card.rank ? candidate : best),
        undefined,
    );

    if (lowest === undefined) return undefined;

    return { kind: MoveKind.TableauToFoundation, cardId: lowest.card.id, from: lowest.from, to: lowest.to };
};
