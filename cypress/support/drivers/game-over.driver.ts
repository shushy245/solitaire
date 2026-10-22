import { HudTestIds } from '../../../src/app/hud/hud.test-ids.ts';
import { BoardTestIds } from '../../../src/app/board/board.test-ids.ts';
import { GameOverTestIds } from '../../../src/app/game-over/game-over.test-ids.ts';

const waitForSettledDeal = (): void => {
    cy.findByTestId(BoardTestIds.Board).should('have.attr', 'data-deal-phase', 'settled');
};

export const gameOverDriver = {
    given: {
        // Seed 22, turn 3: no progress is possible from the deal itself.
        dealStuckFromTheStart: (): void => {
            cy.visit('/?seed=22&draw=3');
            waitForSettledDeal();
        },
        // Seed 148, turn 3: playing the Eight of clubs onto the Nine of diamonds leaves no progress possible.
        dealOneMoveFromStuck: (): void => {
            cy.visit('/?seed=148&draw=3');
            waitForSettledDeal();
        },
    },
    when: {
        lastMovePlayed: (): void => {
            cy.findByTestId(BoardTestIds.Card('clubs-8')).click();
        },
        undoChosen: (): void => {
            cy.findByTestId(GameOverTestIds.Undo).click();
        },
        newGameChosen: (): void => {
            cy.findByTestId(GameOverTestIds.NewGame).click();
        },
    },
    assert: {
        panelShown: (): void => {
            cy.findByRole('region', { name: 'No more moves' }).should('be.visible');
        },
        panelGone: (): void => {
            cy.findByTestId(GameOverTestIds.Panel).should('not.exist');
        },
        undoEnabled: (): void => {
            cy.findByTestId(GameOverTestIds.Undo).should('be.enabled');
        },
        lastMoveTakenBack: (): void => {
            cy.findByTestId(BoardTestIds.Card('clubs-8'))
                .should('have.attr', 'data-pile', 'tableau')
                .and('have.attr', 'data-pile-index', '4');
            cy.findByTestId(HudTestIds.Moves).should('contain.text', '0 moves');
        },
        freshDealInTurnThree: (): void => {
            waitForSettledDeal();
            cy.findByTestId(HudTestIds.Moves).should('contain.text', '0 moves');
            cy.findByTestId(HudTestIds.Mode('three')).should('have.attr', 'aria-pressed', 'true');
        },
    },
};
