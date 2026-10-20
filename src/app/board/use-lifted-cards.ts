import { useCallback, useState } from 'react';

import { CardSlotModel, movedCardIds } from './layout.utils.ts';

// Cards that moved in the latest layout change fly above the rest until their transform transition
// ends. Each change replaces the set, so a missed transitionend (e.g. reduced motion) can't leave a
// card lifted past the next move.
export const useLiftedCards = (
    slots: readonly CardSlotModel[],
): { lifted: ReadonlySet<string>; handleLanded: (cardId: string) => void } => {
    const [tracked, setTracked] = useState<{ slots: readonly CardSlotModel[]; lifted: ReadonlySet<string> }>({
        slots,
        lifted: new Set(),
    });

    if (tracked.slots !== slots) setTracked({ slots, lifted: movedCardIds({ previous: tracked.slots, next: slots }) });

    const handleLanded = useCallback((cardId: string) => {
        setTracked((latest) => {
            if (!latest.lifted.has(cardId)) return latest;

            return { ...latest, lifted: new Set([...latest.lifted].filter((id) => id !== cardId)) };
        });
    }, []);

    return {
        lifted: tracked.slots === slots ? tracked.lifted : movedCardIds({ previous: tracked.slots, next: slots }),
        handleLanded,
    };
};
