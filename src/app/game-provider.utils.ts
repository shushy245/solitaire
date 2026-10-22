import { DrawMode, Move } from '~/engine/index.ts';

import { SessionModel } from './session/session.utils.ts';

// The game port every feature reads through useGame() — fixed in docs/plan.md ("Contracts").
export type GameContextValue = {
    session: SessionModel;
    // Illegal or stale moves are ignored, never thrown.
    dispatchMove: (move: Move) => void;
    playCard: (cardId: string) => void;
    undo: () => void;
    // Back to the last position that was not stuck (the game-over panel's Undo).
    undoToUnstuck: () => void;
    newGame: (opts: { drawMode: DrawMode }) => void;
    startAutoComplete: () => void;
};

export type GameProviderProps = {
    createInitialSession: () => SessionModel;
    seedSource: () => number;
    // Monotonic milliseconds (performance.now in the app) — the clock measures real gaps between ticks.
    now: () => number;
    // Called with every new session, so the game survives a reload; never throws.
    saveSession: (session: SessionModel) => void;
    children: React.ReactNode;
};

export const AUTO_COMPLETE_STEP_MS = 90;
export const CLOCK_TICK_MS = 1000;
