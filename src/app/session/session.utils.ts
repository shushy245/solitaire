import {
    applyMove,
    dealGame,
    DrawMode,
    findFoundationTarget,
    GameStateModel,
    isAutoCompletable,
    isTopCard,
    isWon,
    Move,
    MoveKind,
    nextAutoMove,
    topCard,
} from '~/engine/index.ts';

export enum SessionPhase {
    Playing = 'playing',
    AutoCompleting = 'auto-completing',
}

export type SessionModel = {
    readonly game: GameStateModel;
    // Earlier games, oldest first — undo pops the last one.
    readonly history: readonly GameStateModel[];
    // Play time measured in real milliseconds (ticks carry the measured gap, so throttled timers can't undercount).
    readonly elapsedMs: number;
    readonly phase: SessionPhase;
    // Counts deals in this session, so replaying the same seed is still recognised as a new deal.
    readonly dealNumber: number;
};

export enum SessionActionKind {
    Move = 'move',
    SendToFoundation = 'send-to-foundation',
    Undo = 'undo',
    NewGame = 'new-game',
    Tick = 'tick',
    StartAutoComplete = 'start-auto-complete',
    AutoCompleteStep = 'auto-complete-step',
}

type SessionPayloadMap = {
    [SessionActionKind.Move]: { readonly move: Move };
    // An intent, resolved against the game at reduce time — never a move computed from a stale snapshot.
    [SessionActionKind.SendToFoundation]: { readonly cardId: string };
    [SessionActionKind.Undo]: object;
    [SessionActionKind.NewGame]: { readonly seed: number; readonly drawMode: DrawMode };
    [SessionActionKind.Tick]: { readonly elapsedMs: number };
    [SessionActionKind.StartAutoComplete]: object;
    [SessionActionKind.AutoCompleteStep]: object;
};

export type SessionActionOf<K extends SessionActionKind> = { [P in K]: { readonly kind: P } & SessionPayloadMap[P] }[K];

export type SessionAction = SessionActionOf<SessionActionKind>;

export const makeSession = ({ seed, drawMode }: { seed: number; drawMode: DrawMode }): SessionModel => ({
    game: dealGame({ seed, drawMode }),
    history: [],
    elapsedMs: 0,
    phase: SessionPhase.Playing,
    dealNumber: 0,
});

const isAutoCompleting = (session: SessionModel): boolean => session.phase === SessionPhase.AutoCompleting;

const isClockRunning = (session: SessionModel): boolean => session.game.moves > 0 && !isWon(session.game);

// Records a new game state on top of history; an unchanged game (illegal move) leaves the session as is.
const advance = ({ session, game }: { session: SessionModel; game: GameStateModel }): SessionModel =>
    game === session.game ? session : { ...session, game, history: [...session.history, session.game] };

const playerMove = ({ session, move }: { session: SessionModel; move: Move }): SessionModel =>
    isAutoCompleting(session) ? session : advance({ session, game: applyMove({ state: session.game, move }) });

const isWasteTop = ({ game, cardId }: { game: GameStateModel; cardId: string }): boolean =>
    isTopCard({ pile: game.waste, cardId });

// The move that sends `cardId` up, if it is the top of the waste or of a tableau column and has a foundation.
const foundationMoveFor = ({ game, cardId }: { game: GameStateModel; cardId: string }): Move | undefined => {
    if (isWasteTop({ game, cardId })) {
        const card = topCard(game.waste);
        const to = card === undefined ? undefined : findFoundationTarget({ state: game, card });

        return to === undefined ? undefined : { kind: MoveKind.WasteToFoundation, cardId, to };
    }

    const from = game.tableau.findIndex((column) => isTopCard({ pile: column, cardId }));
    const card = topCard(game.tableau[from] ?? []);
    const to = card === undefined ? undefined : findFoundationTarget({ state: game, card });

    return to === undefined ? undefined : { kind: MoveKind.TableauToFoundation, cardId, from, to };
};

type ReducerMap = {
    [K in SessionActionKind]: (args: { session: SessionModel; action: SessionActionOf<K> }) => SessionModel;
};

const reducerMap: ReducerMap = {
    [SessionActionKind.Move]: ({ session, action }) => playerMove({ session, move: action.move }),
    [SessionActionKind.SendToFoundation]: ({ session, action }) => {
        const move = foundationMoveFor({ game: session.game, cardId: action.cardId });

        return move === undefined ? session : playerMove({ session, move });
    },
    [SessionActionKind.Undo]: ({ session }) => {
        const previous = session.history[session.history.length - 1];

        if (previous === undefined || isAutoCompleting(session)) return session;

        return { ...session, game: previous, history: session.history.slice(0, -1) };
    },
    [SessionActionKind.NewGame]: ({ session, action }) => ({
        ...makeSession({ seed: action.seed, drawMode: action.drawMode }),
        dealNumber: session.dealNumber + 1,
    }),
    [SessionActionKind.Tick]: ({ session, action }) =>
        isClockRunning(session) ? { ...session, elapsedMs: session.elapsedMs + action.elapsedMs } : session,
    [SessionActionKind.StartAutoComplete]: ({ session }) =>
        isAutoCompletable(session.game) && !isAutoCompleting(session)
            ? { ...session, phase: SessionPhase.AutoCompleting }
            : session,
    [SessionActionKind.AutoCompleteStep]: ({ session }) => {
        const move = nextAutoMove(session.game);

        if (!isAutoCompleting(session)) return session;
        if (move === undefined) return { ...session, phase: SessionPhase.Playing };

        const next = advance({ session, game: applyMove({ state: session.game, move }) });

        // A rejected step (nothing changed) or a finished game ends the sweep — never stall in AutoCompleting.
        return next === session || isWon(next.game) ? { ...next, phase: SessionPhase.Playing } : next;
    },
};

export const reduceSession = <K extends SessionActionKind>({
    session,
    action,
}: {
    session: SessionModel;
    action: SessionActionOf<K>;
}): SessionModel => reducerMap[action.kind]({ session, action });
