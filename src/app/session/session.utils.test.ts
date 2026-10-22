import { describe, expect, it } from 'vitest';

import { at } from '~/testkit/at.ts';
import { aCard, aGameState, aSession } from '~/testkit/builders/index.ts';
import { dealGame, DrawMode, isWon, makeDrawMove, Move, MoveKind, Rank, Suit } from '~/engine/index.ts';

import {
    canUndo,
    cardsTakenDown,
    makeSession,
    reduceSession,
    SessionAction,
    SessionActionKind,
    SessionModel,
    SessionPhase,
} from './session.utils.ts';

const freshSession = () => makeSession({ seed: 77, drawMode: DrawMode.One });
const drawIn = (session: ReturnType<typeof freshSession>) => {
    const move = makeDrawMove(session.game);

    if (move === undefined) throw new Error('session test: expected a non-empty stock');

    return reduceSession({ session, action: { kind: SessionActionKind.Move, move } });
};

describe('makeSession', () => {
    it('deals the seeded game with no history, no elapsed time and play in progress', () => {
        const session = freshSession();

        expect(session.game).toEqual(dealGame({ seed: 77, drawMode: DrawMode.One }));
        expect(session.history).toEqual([]);
        expect(session.elapsedMs).toBe(0);
        expect(session.phase).toBe(SessionPhase.Playing);
    });
});

describe('reduceSession — moves and undo', () => {
    it('applies a legal move and remembers the previous game', () => {
        const session = freshSession();

        const next = drawIn(session);

        expect(next.game.moves).toBe(1);
        expect(next.history).toEqual([session.game]);
    });

    it('ignores an illegal move entirely', () => {
        const session = freshSession();

        expect(
            reduceSession({ session, action: { kind: SessionActionKind.Move, move: { kind: MoveKind.Recycle } } }),
        ).toBe(session);
    });

    it('undo restores the previous game exactly, score and move count included', () => {
        const session = freshSession();

        const undone = reduceSession({ session: drawIn(drawIn(session)), action: { kind: SessionActionKind.Undo } });

        expect(undone.game).toEqual(drawIn(session).game);
        expect(undone.history).toEqual([session.game]);
    });

    it('undo with nothing to undo changes nothing', () => {
        const session = freshSession();

        expect(reduceSession({ session, action: { kind: SessionActionKind.Undo } })).toBe(session);
    });

    it('a new game deals the given seed and mode and forgets history and time', () => {
        const played = { ...drawIn(freshSession()), elapsedMs: 42_000 };

        const next = reduceSession({
            session: played,
            action: { kind: SessionActionKind.NewGame, seed: 9, drawMode: DrawMode.Three },
        });

        expect(next.game).toEqual(dealGame({ seed: 9, drawMode: DrawMode.Three }));
        expect([next.history, next.elapsedMs, next.phase]).toEqual([[], 0, SessionPhase.Playing]);
    });

    it('numbers every deal, so replaying the same seed is still a new deal', () => {
        const session = freshSession();
        const action = { kind: SessionActionKind.NewGame, seed: 77, drawMode: DrawMode.One } as const;

        const first = reduceSession({ session, action });
        const second = reduceSession({ session: first, action });

        expect([first.dealNumber, second.dealNumber]).toEqual([1, 2]);
    });
});

describe('reduceSession — play a clicked card', () => {
    const aceOfHearts = aCard().withSuit(Suit.Hearts).withRank(Rank.Ace).build();
    const twoOfHearts = aCard().withSuit(Suit.Hearts).withRank(Rank.Two).build();

    it('sends a playable tableau top card to its foundation', () => {
        const session = {
            ...freshSession(),
            game: aGameState()
                .withColumn({ index: 4, cards: [aceOfHearts] })
                .build(),
        };

        const next = reduceSession({
            session,
            action: { kind: SessionActionKind.PlayCard, cardId: aceOfHearts.id },
        });

        expect(at(next.game.foundations, 0)).toEqual([aceOfHearts]);
    });

    it('sends the top waste card to the foundation already building its suit', () => {
        const game = aGameState()
            .withWaste([twoOfHearts])
            .withFoundation({ index: 2, cards: [aceOfHearts] })
            .build();

        const next = reduceSession({
            session: { ...freshSession(), game },
            action: { kind: SessionActionKind.PlayCard, cardId: twoOfHearts.id },
        });

        expect(at(next.game.foundations, 2)).toEqual([aceOfHearts, twoOfHearts]);
    });

    it('does nothing for a card that cannot go up, or that is not a top card', () => {
        const session = {
            ...freshSession(),
            game: aGameState()
                .withColumn({ index: 0, cards: [aceOfHearts, twoOfHearts] })
                .build(),
        };

        expect(reduceSession({ session, action: { kind: SessionActionKind.PlayCard, cardId: twoOfHearts.id } })).toBe(
            session,
        );
        expect(reduceSession({ session, action: { kind: SessionActionKind.PlayCard, cardId: aceOfHearts.id } })).toBe(
            session,
        );
    });

    it('plays a card that cannot go up onto the first column that takes it', () => {
        const blackThree = aCard().withSuit(Suit.Spades).withRank(Rank.Three).build();
        const session = {
            ...freshSession(),
            game: aGameState()
                .withColumn({ index: 1, cards: [twoOfHearts] })
                .withColumn({ index: 5, cards: [blackThree] })
                .build(),
        };

        const next = reduceSession({ session, action: { kind: SessionActionKind.PlayCard, cardId: twoOfHearts.id } });

        expect(at(next.game.tableau, 5)).toEqual([blackThree, twoOfHearts]);
    });

    it('resolves against the current game, so a repeated send does nothing the second time', () => {
        const session = {
            ...freshSession(),
            game: aGameState()
                .withColumn({ index: 4, cards: [aceOfHearts] })
                .build(),
        };
        const action = { kind: SessionActionKind.PlayCard, cardId: aceOfHearts.id } as const;

        const once = reduceSession({ session, action });

        expect(reduceSession({ session: once, action })).toBe(once);
    });
});

describe('reduceSession — timer', () => {
    it('does not tick before the first move', () => {
        const session = freshSession();

        expect(reduceSession({ session, action: { kind: SessionActionKind.Tick, elapsedMs: 1000 } })).toBe(session);
    });

    it('adds the real time measured since the last tick once play has started', () => {
        const played = drawIn(freshSession());
        const afterTicks = [1000, 61_500].reduce(
            (current, elapsedMs) =>
                reduceSession({ session: current, action: { kind: SessionActionKind.Tick, elapsedMs } }),
            played,
        );

        // a throttled background tab reports one long gap, not many ticks — it must still count it all
        expect(afterTicks.elapsedMs).toBe(62_500);
    });

    it('stops ticking once the game is won', () => {
        const won = aGameState().asReadyToAutoComplete().build();
        const session = reduceSession({
            session: { ...freshSession(), game: won },
            action: { kind: SessionActionKind.StartAutoComplete },
        });
        const finished = Array.from({ length: 52 }).reduce<typeof session>(
            (current) => reduceSession({ session: current, action: { kind: SessionActionKind.AutoCompleteStep } }),
            session,
        );

        expect(isWon(finished.game)).toBe(true);
        expect(reduceSession({ session: finished, action: { kind: SessionActionKind.Tick, elapsedMs: 1000 } })).toBe(
            finished,
        );
    });
});

describe('reduceSession — auto-complete', () => {
    const ready = () => ({ ...freshSession(), game: aGameState().asReadyToAutoComplete().build() });

    it('starts only when the game is auto-completable', () => {
        const session = freshSession();

        expect(reduceSession({ session, action: { kind: SessionActionKind.StartAutoComplete } })).toBe(session);
        expect(reduceSession({ session: ready(), action: { kind: SessionActionKind.StartAutoComplete } }).phase).toBe(
            SessionPhase.AutoCompleting,
        );
    });

    it('a second start while the sweep runs changes nothing (a double-clicked button starts one sweep)', () => {
        const started = reduceSession({ session: ready(), action: { kind: SessionActionKind.StartAutoComplete } });

        expect(reduceSession({ session: started, action: { kind: SessionActionKind.StartAutoComplete } })).toBe(
            started,
        );
    });

    it('each step sends one card up, and the last step returns to normal play', () => {
        const started = reduceSession({ session: ready(), action: { kind: SessionActionKind.StartAutoComplete } });
        const oneStep = reduceSession({ session: started, action: { kind: SessionActionKind.AutoCompleteStep } });
        const finished = Array.from({ length: 52 }).reduce<typeof started>(
            (current) => reduceSession({ session: current, action: { kind: SessionActionKind.AutoCompleteStep } }),
            started,
        );

        expect(oneStep.game.foundations.flat()).toHaveLength(1);
        expect(isWon(finished.game)).toBe(true);
        expect(finished.phase).toBe(SessionPhase.Playing);
    });

    it('ignores player moves and undo while it runs', () => {
        const started = reduceSession({ session: ready(), action: { kind: SessionActionKind.StartAutoComplete } });
        const stepped = reduceSession({ session: started, action: { kind: SessionActionKind.AutoCompleteStep } });

        expect(reduceSession({ session: stepped, action: { kind: SessionActionKind.Undo } })).toBe(stepped);
    });

    it('a step outside auto-complete does nothing', () => {
        const session = ready();

        expect(reduceSession({ session, action: { kind: SessionActionKind.AutoCompleteStep } })).toBe(session);
    });

    it('a new game mid-sweep stops it', () => {
        const started = reduceSession({ session: ready(), action: { kind: SessionActionKind.StartAutoComplete } });

        expect(
            reduceSession({
                session: started,
                action: { kind: SessionActionKind.NewGame, seed: 1, drawMode: DrawMode.One },
            }).phase,
        ).toBe(SessionPhase.Playing);
    });
});

describe('cardsTakenDown', () => {
    const threeOfHearts = aCard().withSuit(Suit.Hearts).withRank(Rank.Three).build();
    const blackFour = aCard().withSuit(Suit.Clubs).withRank(Rank.Four).build();
    const heartsToTwo = [Rank.Ace, Rank.Two].map((rank) => aCard().withSuit(Suit.Hearts).withRank(rank).build());
    const homeToThree = aSession()
        .withGame(
            aGameState()
                .withFoundation({ index: 0, cards: [...heartsToTwo, threeOfHearts] })
                .withColumn({ index: 0, cards: [blackFour] })
                .build(),
        )
        .build();
    const act = (session: SessionModel, action: SessionAction) => reduceSession({ session, action });
    const pulledDown = () =>
        act(homeToThree, {
            kind: SessionActionKind.Move,
            move: { kind: MoveKind.FoundationToTableau, cardId: threeOfHearts.id, from: 0, to: 0 },
        });

    it('names the cards the player took down off a foundation, and forgets one once the take-down is undone', () => {
        expect(cardsTakenDown(homeToThree)).toEqual(new Set());
        expect(cardsTakenDown(pulledDown())).toEqual(new Set([threeOfHearts.id]));
        expect(cardsTakenDown(act(pulledDown(), { kind: SessionActionKind.Undo }))).toEqual(new Set());
    });
});

describe('canUndo', () => {
    it('needs something to undo and no auto-complete running', () => {
        const fresh = freshSession();
        const withHistory = { ...fresh, history: [fresh.game] };

        expect(canUndo(fresh)).toBe(false);
        expect(canUndo(withHistory)).toBe(true);
        expect(canUndo({ ...withHistory, phase: SessionPhase.AutoCompleting })).toBe(false);
    });
});

describe('reduceSession — stats', () => {
    const winningMove: Move = { kind: MoveKind.TableauToFoundation, cardId: 'hearts-13', from: 0, to: 0 };
    const oneMoveFromWon = () => ({
        ...freshSession(),
        game: { ...aGameState().asOneMoveFromWon().build(), moves: 9, score: 300 },
    });
    const act = (session: SessionModel, action: SessionAction) => reduceSession({ session, action });

    it('counts a deal as played at its first move, and only then', () => {
        const once = drawIn(freshSession());

        expect(freshSession().stats.played).toBe(0);
        expect(once.stats.played).toBe(1);
        expect(drawIn(once).stats.played).toBe(1);
    });

    it('still counts a deal once when every move is undone and play starts again', () => {
        const undone = act(drawIn(freshSession()), { kind: SessionActionKind.Undo });

        expect(drawIn(undone).stats.played).toBe(1);
    });

    it('records the win with the time played and the final score at the winning move', () => {
        const session = { ...oneMoveFromWon(), elapsedMs: 75_000 };

        const won = act(session, { kind: SessionActionKind.Move, move: winningMove });

        expect(won.stats.won).toBe(1);
        expect(won.stats.best).toEqual({ timeMs: 75_000, score: won.game.score });
    });

    it('records a win once, even when it is undone and won again', () => {
        const won = act(oneMoveFromWon(), { kind: SessionActionKind.Move, move: winningMove });
        const undone = act(won, { kind: SessionActionKind.Undo });

        expect(act(undone, { kind: SessionActionKind.Move, move: winningMove }).stats.won).toBe(1);
    });

    it('a new game keeps the record and starts its own deal uncounted', () => {
        const played = drawIn(freshSession());
        const next = act(played, { kind: SessionActionKind.NewGame, seed: 5, drawMode: DrawMode.One });

        expect(next.stats).toEqual(played.stats);
        expect(drawIn(next).stats.played).toBe(2);
    });
});
