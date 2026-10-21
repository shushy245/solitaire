import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { isWon } from '~/engine/index.ts';

import { useGame } from '../game-provider.tsx';
import { isAutoCompleting } from '../session/session.utils.ts';
import { HINT_SHOWN_MS, HintContextValue, HintModel, isNoMovesShown, nextHint, shownHighlight } from './hint.utils.ts';

const HintContext = createContext<HintContextValue | undefined>(undefined);

// Holds the hint the player last asked for and lights it for HINT_SHOWN_MS. Every request is a new `shown` object,
// so the timer effect restarts and its cleanup cancels the older timer — an earlier timer never puts out a newer
// hint. The hint is forgotten the moment the game changes, so an undo back to the same game cannot revive it.
export const HintProvider = ({ children }: { children: React.ReactNode }): JSX.Element => {
    const { session } = useGame();
    const { game } = session;
    const [hint, setHint] = useState<HintModel | undefined>(undefined);
    const [shown, setShown] = useState({ isVisible: false });
    const [isTableReady, setTableReady] = useState(true);
    const canHint = isTableReady && !isAutoCompleting(session) && !isWon(game);

    if (hint !== undefined && hint.game !== game) setHint(undefined);

    const showHint = useCallback((): void => {
        if (!canHint) return;

        setHint((previous) => nextHint({ previous, game }));
        setShown({ isVisible: true });
    }, [canHint, game]);

    useEffect(() => {
        if (!shown.isVisible) return undefined;

        const timer = setTimeout(() => {
            setShown({ isVisible: false });
        }, HINT_SHOWN_MS);

        return () => {
            clearTimeout(timer);
        };
    }, [shown]);

    const highlight = useMemo(
        () => shownHighlight({ hint, isVisible: shown.isVisible, game }),
        [hint, shown.isVisible, game],
    );
    const isNoMoves = isNoMovesShown({ hint, isVisible: shown.isVisible, game });
    const value = useMemo(
        () => ({ highlight, isNoMoves, canHint, showHint, reportTableReady: setTableReady }),
        [highlight, isNoMoves, canHint, showHint],
    );

    return <HintContext.Provider value={value}>{children}</HintContext.Provider>;
};

export const useHint = (): HintContextValue => {
    const value = useContext(HintContext);

    if (value === undefined) throw new Error('useHint: no HintProvider above this component');

    return value;
};
