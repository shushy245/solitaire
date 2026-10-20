import { useCallback, useState } from 'react';

import { CardSlotModel, movedCardIds } from './layout.utils.ts';

type LiftedCardsResult = {
    lifted: ReadonlySet<string>;
    // Lifts cards that fly without a layout change (a drag snapping back) until they land.
    liftUntilLanded: (cardIds: readonly string[]) => void;
    handleLanded: (cardId: string) => void;
};

// Cards that moved in the latest layout change fly above the rest until their transform transition
// ends. Each layout change replaces the set, so a missed transitionend (e.g. reduced motion) can't
// leave a card lifted past the next move; explicit lifts only add to it.
export const useLiftedCards = (slots: readonly CardSlotModel[]): LiftedCardsResult => {
    const [tracked, setTracked] = useState<{ slots: readonly CardSlotModel[]; lifted: ReadonlySet<string> }>({
        slots,
        lifted: new Set(),
    });

    if (tracked.slots !== slots) setTracked({ slots, lifted: movedCardIds({ previous: tracked.slots, next: slots }) });

    const liftUntilLanded = useCallback((cardIds: readonly string[]) => {
        setTracked((latest) => ({ ...latest, lifted: new Set([...latest.lifted, ...cardIds]) }));
    }, []);

    const handleLanded = useCallback((cardId: string) => {
        setTracked((latest) => {
            if (!latest.lifted.has(cardId)) return latest;

            return { ...latest, lifted: new Set([...latest.lifted].filter((id) => id !== cardId)) };
        });
    }, []);

    return { lifted: tracked.lifted, liftUntilLanded, handleLanded };
};
