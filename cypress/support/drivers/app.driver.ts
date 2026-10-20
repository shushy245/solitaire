import { AppTestIds } from '../../../src/app.utils.ts';

export const appDriver = {
    given: {
        visit: (): void => {
            cy.visit('/');
        },
    },
    assert: {
        titleVisible: (): void => {
            cy.findByTestId(AppTestIds.Title).should('be.visible').and('have.text', 'Solitaire');
        },
    },
};
