import { persistenceDriver } from './persistence.driver.ts';
import { HudTestIds } from '../../../src/app/hud/hud.test-ids.ts';
import { CelebrationTestIds } from '../../../src/app/celebration/celebration.test-ids.ts';

export const celebrationDriver = {
    given: {
        gameReadyToAutoComplete: (): void => {
            persistenceDriver.given.visitWithGameReadyToAutoComplete();
        },
    },
    when: {
        autoCompleted: (): void => {
            persistenceDriver.when.autoCompleted();
        },
        newGameChosen: (): void => {
            cy.findByTestId(CelebrationTestIds.NewGame).click();
        },
    },
    assert: {
        winShown: (): void => {
            cy.findByTestId(CelebrationTestIds.Overlay).should('be.visible').and('contain.text', 'You won!');
            cy.findByTestId(CelebrationTestIds.NewGame).should('have.focus');
            cy.findByTestId(CelebrationTestIds.Cascade).should('exist');
        },
        freshDealOnTable: (): void => {
            cy.findByTestId(CelebrationTestIds.Overlay).should('not.exist');
            cy.findByTestId(HudTestIds.Moves).should('contain.text', '0 moves');
        },
    },
};
