import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import { AUTO_COMPLETE_STEP_MS, CLOCK_TICK_MS, GameContextValue, GameProviderProps } from './game-provider.utils.ts';
import {
    SessionActionKind,
    reduceSession,
    SessionAction,
    SessionModel,
    SessionPhase,
} from './session/session.utils.ts';

const GameContext = createContext<GameContextValue | undefined>(undefined);

const reducer = (session: SessionModel, action: SessionAction): SessionModel => reduceSession({ session, action });

export const GameProvider = ({ createInitialSession, seedSource, children }: GameProviderProps): JSX.Element => {
    const [session, dispatch] = useReducer(reducer, undefined, createInitialSession);

    // The reducer only advances the clock while a game is in progress, so an always-on tick is safe.
    useEffect(() => {
        const interval = setInterval(() => {
            dispatch({ kind: SessionActionKind.Tick });
        }, CLOCK_TICK_MS);

        return () => {
            clearInterval(interval);
        };
    }, []);

    // One card per step; each new game state schedules the next, and leaving the phase cancels it.
    useEffect(() => {
        if (session.phase !== SessionPhase.AutoCompleting) return undefined;

        const timer = setTimeout(() => {
            dispatch({ kind: SessionActionKind.AutoCompleteStep });
        }, AUTO_COMPLETE_STEP_MS);

        return () => {
            clearTimeout(timer);
        };
    }, [session.phase, session.game]);

    const value = useMemo<GameContextValue>(
        () => ({
            session,
            dispatchMove: (move) => {
                dispatch({ kind: SessionActionKind.Move, move });
            },
            sendToFoundation: (cardId) => {
                dispatch({ kind: SessionActionKind.SendToFoundation, cardId });
            },
            undo: () => {
                dispatch({ kind: SessionActionKind.Undo });
            },
            newGame: ({ drawMode }) => {
                dispatch({ kind: SessionActionKind.NewGame, seed: seedSource(), drawMode });
            },
            startAutoComplete: () => {
                dispatch({ kind: SessionActionKind.StartAutoComplete });
            },
        }),
        [session, seedSource],
    );

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = (): GameContextValue => {
    const value = useContext(GameContext);

    if (value === undefined) throw new Error('useGame: no GameProvider above this component');

    return value;
};
