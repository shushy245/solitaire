import { BoardTestIds } from '../../../src/app/board/board.test-ids.ts';

// Cards are only interactive, and hints and notices only shown, once the deal animation has landed.
export const waitForSettledDeal = (): void => {
    cy.findByTestId(BoardTestIds.Board).should('have.attr', 'data-deal-phase', 'settled');
};

// Every card's place and face, as one comparable list.
export const readTable = (): Cypress.Chainable<string[]> =>
    cy
        .get('[data-testid^="BoardTestIds.Card."]')
        .then((cards) =>
            [...cards]
                .map(
                    (card) =>
                        `${card.dataset.testid ?? ''} ${card.dataset.pile ?? ''}:${card.dataset.pileIndex ?? ''}:${card.dataset.face ?? ''}`,
                )
                .sort(),
        );
