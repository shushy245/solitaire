import { persistenceDriver } from './persistence.driver.ts';
import { HudTestIds } from '../../../src/app/hud/hud.test-ids.ts';
import { getCanvasContext } from '../../../src/utils/get-canvas-context.ts';
import { CelebrationTestIds } from '../../../src/app/celebration/celebration.test-ids.ts';

// Any pixel with some opacity.
const hasPaint = (data: Uint8ClampedArray): boolean => data.some((alpha, i) => i % 4 === 3 && alpha !== 0);

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
        // Some card has been painted, and nothing above the foundation row (the scoreboard stays clear).
        // Throwing inside should() makes Cypress retry until the cascade has painted, or time out.
        cascadePainted: (): void => {
            cy.get('[data-pile="foundation"][data-pile-index="0"]:not([data-card-id])').then((slot) => {
                const paintTop = slot[0]?.getBoundingClientRect().top ?? 0;

                cy.window().then((win) => {
                    cy.findByTestId(CelebrationTestIds.Cascade).should((element) => {
                        const canvas = element[0];

                        if (!(canvas instanceof win.HTMLCanvasElement))
                            throw new Error('celebration e2e: not a canvas');

                        const context = getCanvasContext(canvas);

                        if (context === undefined)
                            throw new Error('celebration e2e: the cascade canvas cannot be read');

                        const bandTop = Math.floor(paintTop * (canvas.width / canvas.clientWidth));
                        const band = context.getImageData(0, bandTop, canvas.width, canvas.height - bandTop).data;
                        const above = context.getImageData(0, 0, canvas.width, Math.max(bandTop - 1, 1)).data;

                        if (!hasPaint(band)) throw new Error('celebration e2e: no card painted on the table yet');
                        if (hasPaint(above)) throw new Error('celebration e2e: paint above the foundation row');
                    });
                });
            });
        },
        freshDealOnTable: (): void => {
            cy.findByTestId(CelebrationTestIds.Overlay).should('not.exist');
            cy.findByTestId(HudTestIds.Moves).should('contain.text', '0 moves');
        },
    },
};
