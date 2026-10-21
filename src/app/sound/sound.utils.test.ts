import { describe, expect, it } from 'vitest';

import { DrawMode, Move, MoveKind, Rank, Suit } from '~/engine/index.ts';
import { aCard, aGameState, aSession } from '~/testkit/builders/index.ts';

import { soundForChange, SoundKind } from './sound.utils.ts';
import { reduceSession, SessionAction, SessionActionKind, SessionModel } from '../session/session.utils.ts';

const act = (session: SessionModel, action: SessionAction): SessionModel => reduceSession({ session, action });
const soundOf = ({ before, after }: { before: SessionModel; after: SessionModel }) => soundForChange({ before, after });

// Seed 1 opens with the Jack of diamonds playable onto a black Queen, uncovering a face-down card.
const seedOne = (): SessionModel => aSession().withDeal({ seed: 1, drawMode: DrawMode.One }).build();

describe('soundForChange', () => {
    it('is silent when the game did not change (a clock tick, or a rejected move)', () => {
        const session = seedOne();

        expect(
            soundOf({ before: session, after: act(session, { kind: SessionActionKind.Tick, elapsedMs: 1000 }) }),
        ).toBe(undefined);
        expect(soundOf({ before: session, after: session })).toBe(undefined);
    });

    it('plays one draw sound for a draw, even of three cards', () => {
        const turnThree = aSession().withDeal({ seed: 1, drawMode: DrawMode.Three }).build();

        expect(
            soundOf({
                before: turnThree,
                after: aSession().withDeal({ seed: 1, drawMode: DrawMode.Three }).afterLegalMove(MoveKind.Draw).build(),
            }),
        ).toBe(SoundKind.Draw);
    });

    it('plays the flip sound when a move turns a hidden card face-up', () => {
        const session = seedOne();

        expect(
            soundOf({
                before: session,
                after: aSession()
                    .withDeal({ seed: 1, drawMode: DrawMode.One })
                    .afterLegalMove(MoveKind.TableauToTableau)
                    .build(),
            }),
        ).toBe(SoundKind.Flip);
    });

    it('plays the recycle sound when the waste goes back to the stock', () => {
        const emptied = aSession().withDeal({ seed: 1, drawMode: DrawMode.One }).afterDraws(24).build();

        expect(
            soundOf({
                before: emptied,
                after: aSession()
                    .withDeal({ seed: 1, drawMode: DrawMode.One })
                    .afterDraws(24)
                    .afterLegalMove(MoveKind.Recycle)
                    .build(),
            }),
        ).toBe(SoundKind.Recycle);
    });

    it('plays the foundation sound for a card sent home, and the win sound alone for the last one', () => {
        const ready = aSession().asReadyToAutoComplete().build();
        const started = act(ready, { kind: SessionActionKind.StartAutoComplete });
        const firstHome = act(started, { kind: SessionActionKind.AutoCompleteStep });
        const lastBefore = aSession().asOneMoveFromWon().build();
        const winning: Move = { kind: MoveKind.TableauToFoundation, cardId: 'hearts-13', from: 0, to: 0 };

        expect(soundOf({ before: started, after: firstHome })).toBe(SoundKind.Foundation);
        expect(
            soundOf({ before: lastBefore, after: act(lastBefore, { kind: SessionActionKind.Move, move: winning }) }),
        ).toBe(SoundKind.Win);
    });

    it('plays the foundation sound for a card sent home even when it uncovers a hidden card', () => {
        const game = aGameState()
            .withColumn({
                index: 0,
                cards: [
                    aCard().withRank(Rank.Five).withSuit(Suit.Clubs).asFaceDown().build(),
                    aCard().withRank(Rank.Ace).withSuit(Suit.Hearts).build(),
                ],
            })
            .build();
        const before = aSession().withGame(game).build();
        const after = aSession().withGame(game).afterLegalMove(MoveKind.TableauToFoundation).build();

        expect(soundOf({ before, after })).toBe(SoundKind.Foundation);
    });

    it('plays the place sound for an undo and for a card laid on the table without a flip', () => {
        const drawn = aSession().withDeal({ seed: 1, drawMode: DrawMode.One }).afterLegalMove(MoveKind.Draw).build();
        const undone = act(drawn, { kind: SessionActionKind.Undo });
        const won = aSession().asWon().build();
        const offTheFoundation = aSession().asWon().afterLegalMove(MoveKind.FoundationToTableau).build();

        expect(soundOf({ before: drawn, after: undone })).toBe(SoundKind.Place);
        expect(soundOf({ before: won, after: offTheFoundation })).toBe(SoundKind.Place);
    });

    it('plays one deal sound for a new game', () => {
        const session = seedOne();

        expect(
            soundOf({
                before: session,
                after: act(session, { kind: SessionActionKind.NewGame, seed: 9, drawMode: DrawMode.One }),
            }),
        ).toBe(SoundKind.Deal);
    });
});
