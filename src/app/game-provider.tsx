import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { AUTO_COMPLETE_STEP_MS, CLOCK_TICK_MS, GameContextValue, GameProviderProps } from './game-provider.utils.ts';
import {
    SessionActionKind,
    reduceSession,
    SessionAction,
    SessionModel,
    SessionPhase,
} from './session/session.utils.ts';

const GameContext = createContext<GameContextValue | undefined>(undefined);

// The step each self-playing phase takes on its timer.
const stepKindMap: Partial<Record<SessionPhase, SessionActionKind.AutoCompleteStep | SessionActionKind.AutoMoveStep>> =
    {
        [SessionPhase.AutoCompleting]: SessionActionKind.AutoCompleteStep,
        [SessionPhase.AutoMoving]: SessionActionKind.AutoMoveStep,
    };

const reducer = (session: SessionModel, action: SessionAction): SessionModel => reduceSession({ session, action });

export const GameProvider = ({
    createInitialSession,
    seedSource,
    now,
    saveSession,
    children,
}: GameProviderProps): JSX.Element => {
    const [session, dispatch] = useReducer(reducer, undefined, createInitialSession);

    const lastTick = useRef(now());

    // Adds the real time since the clock was last read. It runs on an always-on interval (the reducer only
    // advances the clock while a game is in progress) and right before every action that changes the game,
    // so the first move starts the clock and the winning move stops it at that exact moment.
    const flushClock = useCallback((): void => {
        const current = now();
        dispatch({ kind: SessionActionKind.Tick, elapsedMs: current - lastTick.current });
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

    // One card per step, for auto-complete and auto-move alike; each new game state schedules the next, and leaving
    // the phase cancels it.
    useEffect(() => {
        const stepKind = stepKindMap[session.phase];

        if (stepKind === undefined) return undefined;

        const timer = setTimeout(() => {
            flushClock();
            dispatch({ kind: stepKind });
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
            newGame: ({ drawMode }) => {
                flushClock();
                dispatch({ kind: SessionActionKind.NewGame, seed: seedSource(), drawMode });
            },
            startAutoComplete: () => {
                dispatch({ kind: SessionActionKind.StartAutoComplete });
            },
            stopAutoMove: () => {
                dispatch({ kind: SessionActionKind.StopAutoMove });
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
