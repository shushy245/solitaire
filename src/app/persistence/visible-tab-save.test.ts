import { beforeEach, describe, it } from 'vitest';

import { aSession } from '~/testkit/builders/index.ts';

import { makeVisibleTabSaveDriver, VisibleTabSaveDriver } from './visible-tab-save.driver.ts';

describe('visible-tab save', () => {
    let driver: VisibleTabSaveDriver;

    beforeEach(() => {
        driver = makeVisibleTabSaveDriver();
    });

    it('saves while the page is visible', () => {
        const session = aSession().build();

        driver.when.saved(session);

        driver.assert.written([session]);
    });

    // Another tab's game must survive this tab's clock ticking in the background.
    it('saves nothing while the page is hidden', () => {
        driver.given.pageHidden();

        driver.when.saved(aSession().build());

        driver.assert.written([]);
    });

    it('saves the latest session once the page is shown again — visibility is read at each save', () => {
        const shownTick = aSession().build();
        driver.given.pageHidden();
        driver.when.saved(aSession().build());

        driver.when.pageShown();
        driver.when.saved(shownTick);

        driver.assert.written([shownTick]);
    });
});
