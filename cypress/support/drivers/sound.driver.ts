import { waitForSettledDeal } from './deal.ts';
import { HudTestIds } from '../../../src/app/hud/hud.test-ids.ts';
import { BoardTestIds } from '../../../src/app/board/board.test-ids.ts';
import { AudioLog, installFakeAudioContext } from '../fake-audio-context.ts';

const audio: AudioLog = { contexts: 0, starts: 0 };

export const soundDriver = {
    given: {
        visitWithFakeAudio: (): void => {
            audio.contexts = 0;
            audio.starts = 0;
            cy.visit('/?seed=1', {
                onBeforeLoad: (win) => {
                    installFakeAudioContext(win, audio);
                },
            });
            waitForSettledDeal();
        },
    },
    when: {
        stockClicked: (): void => {
            cy.findByTestId(BoardTestIds.Stock).click();
        },
        soundToggled: (): void => {
            cy.findByTestId(HudTestIds.SoundToggle).click();
        },
        startsRemembered: (): void => {
            cy.wrap(audio).its('starts').as('startsBefore');
        },
        reloaded: (): void => {
            cy.reload();
            waitForSettledDeal();
        },
    },
    assert: {
        noAudioYet: (): void => {
            cy.wrap(audio).its('contexts').should('equal', 0);
            cy.wrap(audio).its('starts').should('equal', 0);
        },
        soundsStarted: (): void => {
            cy.wrap(audio).its('contexts').should('equal', 1);
            cy.wrap(audio).its('starts').should('be.greaterThan', 0);
        },
        noNewSounds: (): void => {
            cy.get<number>('@startsBefore').then((before) => {
                cy.wrap(audio).its('starts').should('equal', before);
            });
        },
        soundShownOn: (isOn: boolean): void => {
            cy.findByTestId(HudTestIds.SoundToggle).should('have.attr', 'aria-pressed', String(isOn));
        },
    },
};
