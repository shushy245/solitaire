import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';

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

export const GameProvider = ({
    createInitialSession,
    seedSource,
    now,
    saveSession,
    children,
}: GameProviderProps): JSX.Element => {
    const [session, dispatch] = useReducer(reducer, undefined, createInitialSession);

    // Read once at mount (a lazy initial value); every later reading comes from flushClock.
    const [mountedAt] = useState(now);
    const lastTick = useRef(mountedAt);
    // Reported by the hint provider, which works out once per position whether the game is over (stuck).
    const isGameOver = useRef(false);

    // Adds the real time since the clock was last read. It runs on an always-on interval (the reducer only
    // advances the clock while a game is in progress) and right before every action that changes the game,
    // so the first move starts the clock and the winning move stops it at that exact moment.
    const flushClock = useCallback((): void => {
        const current = now();
        dispatch({
            kind: SessionActionKind.Tick,
            elapsedMs: current - lastTick.current,
            isGameOver: isGameOver.current,
        });
        lastTick.current = current;
    }, [now]);

    // Restarting the interval (a new `now`) keeps lastTick, so time measured so far is never dropped.
    useEffect(() => {
        const interval = setInterval(flushClock, CLOCK_TICK_MS);

        return () => {
            clearInterval(interval);
        };
    }, [flushClock]);

    // Every change is saved as it happens — a tab can be closed at any moment, with no chance to save on the way out.
    // Cost, measured 2026-10-20: ~3.5ms and ~0.49MB per save at 500 undo steps (desktop). Once a second while
    // playing and every auto-complete step is fine at that size; if a trace ever shows saves janking a phone,
    // save the history only when the game changes and the clock under its own key (persistence review triage).
    useEffect(() => {
        saveSession(session);
    }, [session, saveSession]);

    // One card per step; each new game state schedules the next, and leaving the phase cancels it.
    useEffect(() => {
        if (session.phase !== SessionPhase.AutoCompleting) return undefined;

        const timer = setTimeout(() => {
            flushClock();
            dispatch({ kind: SessionActionKind.AutoCompleteStep });
        }, AUTO_COMPLETE_STEP_MS);

        return () => {
            clearTimeout(timer);
        };
    }, [session.phase, session.game, flushClock]);

    // Actions close over dispatch, flushClock and seedSource only, so they stay stable across clock ticks.
    const actions = useMemo<Omit<GameContextValue, 'session'>>(
        () => ({
            dispatchMove: (move) => {
                flushClock();
                dispatch({ kind: SessionActionKind.Move, move });
            },
            playCard: (cardId) => {
                flushClock();
                dispatch({ kind: SessionActionKind.PlayCard, cardId });
            },
            undo: () => {
                flushClock();
                dispatch({ kind: SessionActionKind.Undo });
            },
            undoToUnstuck: () => {
                flushClock();
                dispatch({ kind: SessionActionKind.UndoToUnstuck });
            },
            newGame: ({ drawMode }) => {
                flushClock();
                dispatch({ kind: SessionActionKind.NewGame, seed: seedSource(), drawMode });
            },
            startAutoComplete: () => {
                dispatch({ kind: SessionActionKind.StartAutoComplete });
            },
            reportGameOver: (report) => {
                isGameOver.current = report.isGameOver;
            },
        }),
        [seedSource, flushClock],
    );
    const value = useMemo<GameContextValue>(() => ({ session, ...actions }), [session, actions]);

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = (): GameContextValue => {
    const value = useContext(GameContext);

    if (value === undefined) throw new Error('useGame: no GameProvider above this component');

    return value;
};
