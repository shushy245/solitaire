import { describe, expect, it } from 'vitest';

import { at } from '~/testkit/at.ts';
import { aCard, aGameState, aSession } from '~/testkit/builders/index.ts';
import { dealGame, DrawMode, isWon, makeDrawMove, Move, MoveKind, Rank, Suit } from '~/engine/index.ts';

import {
    canUndo,
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

describe('reduceSession — auto-move', () => {
    const hiddenTwo = aCard().withSuit(Suit.Hearts).withRank(Rank.Two).asFaceDown().build();
    const aceOfHearts = aCard().withSuit(Suit.Hearts).withRank(Rank.Ace).build();
    const blackFive = aCard().withSuit(Suit.Spades).withRank(Rank.Five).build();
    const redSix = aCard().withSuit(Suit.Diamonds).withRank(Rank.Six).build();
    const kingOfClubs = aCard().withSuit(Suit.Clubs).withRank(Rank.King).asFaceDown().build();
    // Moving the black five onto the red six uncovers the Ace of hearts, and under it the Two of hearts.
    const freeingMove: Move = { kind: MoveKind.TableauToTableau, cardId: blackFive.id, from: 0, to: 1 };
    const start = aSession()
        .withGame(
            aGameState()
                .withColumn({ index: 0, cards: [hiddenTwo, aceOfHearts, blackFive] })
                .withColumn({ index: 1, cards: [redSix] })
                .withStock([kingOfClubs])
                .build(),
        )
        .build();
    const beforeFreeing = () => start;
    const act = (session: SessionModel, action: SessionAction) => reduceSession({ session, action });
    const step = (session: SessionModel) => act(session, { kind: SessionActionKind.AutoMoveStep });
    const freed = () => act(beforeFreeing(), { kind: SessionActionKind.Move, move: freeingMove });

    it('starts after a player move that leaves a card safe to send home', () => {
        expect(freed().phase).toBe(SessionPhase.AutoMoving);
    });

    it('does not start after a move that leaves nothing safe to send home', () => {
        const drawn = drawIn(freshSession());

        expect(drawn.phase).toBe(SessionPhase.Playing);
    });

    it('each step sends one safe card home as a scored move, and returns to play when none is left', () => {
        const once = step(freed());
        const twice = step(once);

        expect(once.game.foundations.flat().map((card) => card.id)).toEqual([aceOfHearts.id]);
        // +10 for the Ace home, +5 for the Two of hearts it turns over.
        expect(once.game.score).toBe(freed().game.score + 15);
        expect(once.phase).toBe(SessionPhase.AutoMoving);
        expect(twice.game.foundations.flat()).toHaveLength(2);
        expect(step(twice).phase).toBe(SessionPhase.Playing);
    });

    it('undo takes back the player move and the cards it sent home together, and does not auto-move again', () => {
        const finished = step(step(step(freed())));

        const undone = act(finished, { kind: SessionActionKind.Undo });

        expect(undone.game).toEqual(beforeFreeing().game);
        expect(undone.phase).toBe(SessionPhase.Playing);
    });

    it('undo mid-sequence stops it and steps back over the player move', () => {
        const undone = act(step(freed()), { kind: SessionActionKind.Undo });

        expect(undone.game).toEqual(beforeFreeing().game);
        expect(undone.phase).toBe(SessionPhase.Playing);
    });

    it('a new game mid-sequence stops it', () => {
        const next = act(step(freed()), { kind: SessionActionKind.NewGame, seed: 3, drawMode: DrawMode.One });

        expect(next.phase).toBe(SessionPhase.Playing);
    });

    it('stopping it keeps the cards sent home so far and returns to play', () => {
        const oneHome = step(freed());

        const stopped = act(oneHome, { kind: SessionActionKind.StopAutoMove });

        expect(stopped.game).toBe(oneHome.game);
        expect(stopped.phase).toBe(SessionPhase.Playing);
        expect(act(stopped, { kind: SessionActionKind.StopAutoMove })).toBe(stopped);
    });

    it('a step outside a sequence does nothing', () => {
        const session = beforeFreeing();

        expect(step(session)).toBe(session);
    });

    it('a player move mid-sequence is played, and undo then returns to what the player saw before it', () => {
        const oneHome = step(freed());
        const drawn = act(oneHome, {
            kind: SessionActionKind.Move,
            move: { kind: MoveKind.Draw, cardId: kingOfClubs.id },
        });

        expect(drawn.game.waste.map((card) => card.id)).toEqual([kingOfClubs.id]);
        expect(act(drawn, { kind: SessionActionKind.Undo }).game).toEqual(oneHome.game);
    });

    it('sending the last card home wins the game, recorded once', () => {
        const oneFromWon = aGameState().asOneMoveFromWon().build();
        const lastKing = oneFromWon.tableau[0]?.[0];

        if (lastKing === undefined) throw new Error('session test: expected the King on the first column');

        const kingInStock = aSession()
            .withGame({
                ...oneFromWon,
                tableau: oneFromWon.tableau.map(() => []),
                stock: [{ ...lastKing, faceUp: false }],
            })
            .asStarted()
            .build();
        const drawn = act(kingInStock, {
            kind: SessionActionKind.Move,
            move: { kind: MoveKind.Draw, cardId: lastKing.id },
        });
        const won = step(drawn);

        expect(isWon(won.game)).toBe(true);
        expect(won.stats.won).toBe(1);
        expect(won.phase).toBe(SessionPhase.Playing);
        expect(step(won)).toBe(won);
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
