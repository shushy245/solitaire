import { HudTestIds } from '../../../src/app/hud/hud.test-ids.ts';
import { BoardTestIds } from '../../../src/app/board/board.test-ids.ts';

// The keys and on-disk format the app saves under; the fixtures are saves exactly as the app writes them.
const SAVED_GAME_KEY = 'solitaire.game';
const SAVED_STATS_KEY = 'solitaire.stats';
const SWEEP_TIMEOUT_MS = 10_000;

const waitForSettledDeal = (): void => {
    cy.findByTestId(BoardTestIds.Board).should('have.attr', 'data-deal-phase', 'settled');
};

// Every card's place and face, as one comparable list.
const readTable = (): Cypress.Chainable<string[]> =>
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

export const persistenceDriver = {
    given: {
        freshVisit: (): void => {
            cy.visit('/');
            waitForSettledDeal();
        },
        // A save one auto-complete away from a win, and a record already holding one win out of four.
        visitWithGameReadyToAutoComplete: (): void => {
            cy.fixture('ready-to-auto-complete.save.json').then((game: unknown) => {
                cy.fixture('one-win.stats.json').then((stats: unknown) => {
                    cy.visit('/', {
                        onBeforeLoad: (win) => {
                            win.localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(game));
                            win.localStorage.setItem(SAVED_STATS_KEY, JSON.stringify(stats));
                        },
                    });
                });
            });
            waitForSettledDeal();
        },
    },
    when: {
        stockClicked: (): void => {
            cy.findByTestId(BoardTestIds.Stock).click();
            cy.findByTestId(HudTestIds.Moves).should('contain.text', '1');
        },
        tableRemembered: (): void => {
            readTable().as('tableBeforeReload');
        },
        reloaded: (): void => {
            cy.reload();
            waitForSettledDeal();
        },
        autoCompleted: (): void => {
            cy.findByTestId(HudTestIds.AutoComplete).click();
            // 52 steps of 90ms outlast Cypress's default 4s wait.
            cy.get('[data-pile="foundation"][data-testid^="BoardTestIds.Card."]', { timeout: SWEEP_TIMEOUT_MS }).should(
                'have.length',
                52,
            );
        },
        statsOpened: (): void => {
            cy.findByTestId(HudTestIds.RecordToggle).click();
        },
    },
    assert: {
        tableAsRemembered: (): void => {
            cy.get<string[]>('@tableBeforeReload').then((before) => {
                readTable().should('deep.equal', before);
            });
            cy.findByTestId(HudTestIds.Moves).should('contain.text', '1 move');
        },
        record: ({ played, won }: { played: string; won: string }): void => {
            cy.findByTestId(HudTestIds.RecordEntry('played')).should('have.text', played);
            cy.findByTestId(HudTestIds.RecordEntry('won')).should('have.text', won);
        },
    },
};
