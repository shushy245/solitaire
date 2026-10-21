import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useGame } from '../game-provider.tsx';
import { isAutoCompleting } from '../session/session.utils.ts';
import { HINT_SHOWN_MS, HintContextValue, HintModel, isNoMovesHint, nextHint, shownHighlight } from './hint.utils.ts';

const HintContext = createContext<HintContextValue | undefined>(undefined);

// Holds the hint the player last asked for and lights it for HINT_SHOWN_MS. Every request restarts the timer (the
// effect's cleanup cancels the previous one), so an earlier timer never puts out a newer hint. A move made since
// puts the hint out at once: it belongs to the game it was worked out for.
export const HintProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
    const { session } = useGame();
    const { game } = session;
    const [hint, setHint] = useState<HintModel | undefined>(undefined);
    const [shown, setShown] = useState({ isVisible: false, requests: 0 });
    const isLocked = isAutoCompleting(session);

    const showHint = useCallback((): void => {
        if (isLocked) return;

        setHint((previous) => nextHint({ previous, game }));
        setShown((latest) => ({ isVisible: true, requests: latest.requests + 1 }));
    }, [game, isLocked]);

    useEffect(() => {
        if (!shown.isVisible) return undefined;

        const timer = setTimeout(() => {
            setShown((latest) => ({ ...latest, isVisible: false }));
        }, HINT_SHOWN_MS);

        return () => {
            clearTimeout(timer);
        };
    }, [shown]);

    const isCurrent = hint !== undefined && hint.game === game && shown.isVisible;
    const highlight = useMemo(
        () => shownHighlight({ hint, isVisible: shown.isVisible, game }),
        [hint, shown.isVisible, game],
    );
    const value = useMemo(
        () => ({ highlight, isNoMoves: isCurrent && isNoMovesHint(hint), showHint }),
        [highlight, isCurrent, hint, showHint],
    );

    return <HintContext.Provider value={value}>{children}</HintContext.Provider>;
};

export const useHint = (): HintContextValue => {
    const value = useContext(HintContext);

    if (value === undefined) throw new Error('useHint: no HintProvider above this component');

    return value;
};
