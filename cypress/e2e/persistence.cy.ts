import { persistenceDriver } from '../support/drivers/persistence.driver.ts';

describe('resuming after a reload in a real browser', () => {
    it('brings back the game exactly as it was left', () => {
        persistenceDriver.given.freshVisit();
        persistenceDriver.when.stockClicked();
        persistenceDriver.when.tableRemembered();

        persistenceDriver.when.reloaded();

        persistenceDriver.assert.tableAsRemembered();
    });

    it('resumes a replayed ?seed= deal on reload instead of dealing it again', () => {
        persistenceDriver.given.visitOfSeed(1);
        persistenceDriver.when.stockClicked();
        persistenceDriver.when.tableRemembered();

        persistenceDriver.when.reloaded();

        persistenceDriver.assert.addressHasNoSeed();
        persistenceDriver.assert.tableAsRemembered();
    });

    it('keeps a win in the record across a reload', () => {
        persistenceDriver.given.visitWithGameReadyToAutoComplete();
        persistenceDriver.when.autoCompleted();

        persistenceDriver.when.reloaded();
        persistenceDriver.when.statsOpened();

        persistenceDriver.assert.record({ played: '4', won: '2' });
    });
});
