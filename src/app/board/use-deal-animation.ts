import { useEffect, useState } from 'react';

import { DEAL_TOTAL_MS, DealPhase, STACK_HOLD_MS } from './board.utils.ts';

const nextPhaseMap: Record<DealPhase, { next: DealPhase; afterMs: number } | undefined> = {
    [DealPhase.Stacked]: { next: DealPhase.Dealing, afterMs: STACK_HOLD_MS },
    [DealPhase.Dealing]: { next: DealPhase.Settled, afterMs: DEAL_TOTAL_MS },
    [DealPhase.Settled]: undefined,
};

// Stacked (every card on the stock) → Dealing (cards fly out, staggered) → Settled. A new deal key —
// a new game — restarts from Stacked, and the previous deal's pending timer is cancelled. A game that is
// already under way when the table first appears (resumed after a reload) is shown where it was left.
export const useDealAnimation = ({ dealKey, isFreshDeal }: { dealKey: number; isFreshDeal: boolean }): DealPhase => {
    const [deal, setDeal] = useState(() => ({
        key: dealKey,
        phase: isFreshDeal ? DealPhase.Stacked : DealPhase.Settled,
    }));
    const current = deal.key === dealKey ? deal : { key: dealKey, phase: DealPhase.Stacked };

    if (current !== deal) setDeal(current);

    useEffect(() => {
        const step = nextPhaseMap[current.phase];

        if (step === undefined) return undefined;

        const timer = setTimeout(() => {
            setDeal((latest) => (latest.key === current.key ? { key: current.key, phase: step.next } : latest));
        }, step.afterMs);

        return () => {
            clearTimeout(timer);
        };
    }, [current.key, current.phase]);

    return current.phase;
};
