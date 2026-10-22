import { readTable, waitForSettledDeal } from './deal.ts';
import { HudTestIds } from '../../../src/app/hud/hud.test-ids.ts';
import { BoardTestIds } from '../../../src/app/board/board.test-ids.ts';
import { SAVED_GAME_KEY, SAVED_STATS_KEY } from '../../../src/app/persistence/storage-keys.utils.ts';

// The fixtures are saves exactly as the app writes them.
const SWEEP_TIMEOUT_MS = 10_000;

export const persistenceDriver = {
    given: {
        freshVisit: (): void => {
            cy.visit('/');
            waitForSettledDeal();
        },
        visitOfSeed: (seed: number): void => {
            cy.visit(`/?seed=${seed}`);
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
        addressHasNoSeed: (): void => {
            cy.location('search').should('not.contain', 'seed');
        },
        record: ({ played, won }: { played: string; won: string }): void => {
            cy.findByTestId(HudTestIds.RecordEntry('played')).should('have.text', played);
            cy.findByTestId(HudTestIds.RecordEntry('won')).should('have.text', won);
        },
    },
};
