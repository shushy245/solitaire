import { describe, expect, it } from 'vitest';

import { at } from '~/testkit/at.ts';
import { aCard, aGameState } from '~/testkit/builders/index.ts';
import { dealGame, DrawMode, isWon, makeDrawMove, MoveKind, Rank, Suit } from '~/engine/index.ts';

import { makeSession, reduceSession, SessionActionKind, SessionPhase } from './session.utils.ts';

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
        expect(session.elapsedSeconds).toBe(0);
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
        const played = { ...drawIn(freshSession()), elapsedSeconds: 42 };

        const next = reduceSession({
            session: played,
            action: { kind: SessionActionKind.NewGame, seed: 9, drawMode: DrawMode.Three },
        });

        expect(next).toEqual(makeSession({ seed: 9, drawMode: DrawMode.Three }));
    });
});

describe('reduceSession — send to foundation', () => {
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
            action: { kind: SessionActionKind.SendToFoundation, cardId: aceOfHearts.id },
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
            action: { kind: SessionActionKind.SendToFoundation, cardId: twoOfHearts.id },
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

        expect(
            reduceSession({ session, action: { kind: SessionActionKind.SendToFoundation, cardId: twoOfHearts.id } }),
        ).toBe(session);
        expect(
            reduceSession({ session, action: { kind: SessionActionKind.SendToFoundation, cardId: aceOfHearts.id } }),
        ).toBe(session);
    });

    it('resolves against the current game, so a repeated send does nothing the second time', () => {
        const session = {
            ...freshSession(),
            game: aGameState()
                .withColumn({ index: 4, cards: [aceOfHearts] })
                .build(),
        };
        const action = { kind: SessionActionKind.SendToFoundation, cardId: aceOfHearts.id } as const;

        const once = reduceSession({ session, action });

        expect(reduceSession({ session: once, action })).toBe(once);
    });
});

describe('reduceSession — timer', () => {
    it('does not tick before the first move', () => {
        const session = freshSession();

        expect(reduceSession({ session, action: { kind: SessionActionKind.Tick } })).toBe(session);
    });

    it('ticks one second at a time once play has started', () => {
        expect(
            reduceSession({ session: drawIn(freshSession()), action: { kind: SessionActionKind.Tick } }).elapsedSeconds,
        ).toBe(1);
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
        expect(reduceSession({ session: finished, action: { kind: SessionActionKind.Tick } })).toBe(finished);
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
