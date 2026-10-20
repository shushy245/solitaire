import { beforeEach, describe, it } from 'vitest';

import { DEAL_TOTAL_MS, DealPhase, STACK_HOLD_MS } from './board.utils.ts';
import { DealAnimationDriver, makeDealAnimationDriver } from './use-deal-animation.driver.tsx';

describe('useDealAnimation', () => {
    let driver: DealAnimationDriver;

    beforeEach(() => {
        driver = makeDealAnimationDriver();
        driver.given.fakeClock();
    });

    it('a new deal mid-animation restarts from the stack and ignores the old deal timer', () => {
        driver.when.mounted(1);
        driver.time.pass(STACK_HOLD_MS);
        driver.assert.phase(DealPhase.Dealing);

        driver.when.redealt(2);

        driver.assert.phase(DealPhase.Stacked);
        driver.time.pass(DEAL_TOTAL_MS - 1);
        driver.assert.phase(DealPhase.Dealing);
    });

    it('settles a redeal on its own schedule', () => {
        driver.when.mounted(1);
        driver.time.pass(STACK_HOLD_MS + 10);

        driver.when.redealt(2);
        driver.time.pass(STACK_HOLD_MS);
        driver.time.pass(DEAL_TOTAL_MS);

        driver.assert.phase(DealPhase.Settled);
    });
});
