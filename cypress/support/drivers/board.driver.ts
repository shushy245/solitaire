import { BoardTestIds } from '../../../src/app/board/board.test-ids.ts';

// buttons: 1 while pressed, as a real browser reports — a move with no button held ends the drag.
const POINTER = { pointerId: 1, button: 0, buttons: 1, eventConstructor: 'PointerEvent' };

const centerOf = (element: JQuery) => {
    const rect = element[0]?.getBoundingClientRect();

    if (rect === undefined) throw new Error('board e2e driver: element has no box');

    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

export const boardDriver = {
    given: {
        // Seed 1's deal opens with the Jack of diamonds (column 2) playable onto the black Queen in column 5.
        dealWithOpeningColumnMove: (): void => {
            cy.visit('/?seed=1');
            cy.findByTestId(BoardTestIds.Board).should('have.attr', 'data-deal-phase', 'settled');
        },
    },
    drag: {
        cardOntoCard: ({ cardId, ontoCardId }: { cardId: string; ontoCardId: string }): void => {
            cy.findByTestId(BoardTestIds.Card(ontoCardId)).then((target) => {
                const to = centerOf(target);

                cy.findByTestId(BoardTestIds.Card(cardId)).then((source) => {
                    const from = centerOf(source);

                    cy.wrap(source).trigger('pointerdown', { ...POINTER, clientX: from.x, clientY: from.y });
                    cy.document().trigger('pointermove', { ...POINTER, clientX: from.x + 10, clientY: from.y + 10 });
                    cy.document().trigger('pointermove', { ...POINTER, clientX: to.x, clientY: to.y + 20 });
                    cy.document().trigger('pointerup', { ...POINTER, buttons: 0, clientX: to.x, clientY: to.y + 20 });
                });
            });
        },
    },
    assert: {
        cardInTableauColumn: ({ cardId, column }: { cardId: string; column: number }): void => {
            cy.findByTestId(BoardTestIds.Card(cardId))
                .should('have.attr', 'data-pile', 'tableau')
                .and('have.attr', 'data-pile-index', String(column));
        },
    },
};
