import { waitForSettledDeal } from './deal.ts';
import { HudTestIds } from '../../../src/app/hud/hud.test-ids.ts';
import { HINT_SHOWN_MS } from '../../../src/app/hint/hint-timing.ts';
import { BoardTestIds } from '../../../src/app/board/board.test-ids.ts';

// The ring may go out a little early or late in a real browser; it must not vanish at once nor linger.
const RING_SLACK_MS = 500;

// The ring is a box-shadow on the card's ::after layer — read from the browser's own computed style.
const ringOf = ({ win, element }: { win: Cypress.AUTWindow; element: JQuery }): string => {
    const card = element[0];

    if (card === undefined) throw new Error('hint e2e: card not found');

    return win.getComputedStyle(card, '::after').boxShadow;
};

// Retries until the card's ring is painted (or out), so a ring mid-repaint is waited for, not reported.
const assertRing = ({ cardId, isPainted }: { cardId: string; isPainted: boolean }): void => {
    cy.window().then((win) => {
        cy.findByTestId(BoardTestIds.Card(cardId)).should((element) => {
            const isRingPainted = ringOf({ win, element }) !== 'none';

            if (isRingPainted !== isPainted)
                throw new Error(
                    `hint e2e: ${cardId} ring painted=${String(isRingPainted)}, expected ${String(isPainted)}`,
                );
        });
    });
};

const shared = { pressedAt: 0 };

export const hintDriver = {
    given: {
        // Seed 1, turn 1: the first hint is the Jack of diamonds onto the Queen of clubs, the second the
        // Four of hearts onto the Five of clubs.
        dealWithTwoColumnHints: (): void => {
            cy.visit('/?seed=1');
            waitForSettledDeal();
        },
    },
    when: {
        hintButtonPressed: (): void => {
            cy.findByTestId(HudTestIds.Hint).click();
            cy.then(() => {
                shared.pressedAt = Date.now();
            });
        },
        hintKeyPressed: (): void => {
            cy.get('body').type('h');
            cy.then(() => {
                shared.pressedAt = Date.now();
            });
        },
    },
    assert: {
        ringed: (cardIds: string[]): void => {
            cardIds.forEach((cardId) => {
                cy.findByTestId(BoardTestIds.Card(cardId)).should('have.attr', 'data-hinted', 'true');
                assertRing({ cardId, isPainted: true });
            });
        },
        notRinged: (cardIds: string[]): void => {
            cardIds.forEach((cardId) => {
                cy.findByTestId(BoardTestIds.Card(cardId)).should('have.attr', 'data-hinted', 'false');
            });
        },
        ringGoesOutAfterAboutTwoSeconds: (cardId: string): void => {
            cy.findByTestId(BoardTestIds.Card(cardId), { timeout: HINT_SHOWN_MS + RING_SLACK_MS * 2 })
                .should('have.attr', 'data-hinted', 'false')
                .then(() => {
                    const shownMs = Date.now() - shared.pressedAt;

                    if (shownMs < HINT_SHOWN_MS - RING_SLACK_MS)
                        throw new Error(
                            `hint e2e: the ring went out after ${shownMs}ms, expected about ${HINT_SHOWN_MS}ms`,
                        );
                });
            assertRing({ cardId, isPainted: false });
        },
        noMovesLeftSaid: (): void => {
            cy.findByTestId(HudTestIds.HintStatus).should('contain.text', 'No moves left');
        },
    },
};
