import { describe, expect, it } from 'vitest';

import { at } from '~/testkit/at.ts';
import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { applyMove } from './apply.ts';
import { DrawMode, MoveKind, Rank, Suit } from './model.ts';

const stockOf = (ranks: readonly Rank[]) =>
    ranks.map((rank) => aCard().withSuit(Suit.Clubs).withRank(rank).asFaceDown().build());
const wasteOf = (ranks: readonly Rank[]) => ranks.map((rank) => aCard().withSuit(Suit.Hearts).withRank(rank).build());
const idsOf = (cards: readonly { id: string }[]) => cards.map((c) => c.id);

describe('applyMove — draw', () => {
    it('turn-1 moves the top stock card face-up onto the waste', () => {
        const state = aGameState()
            .withStock(stockOf([Rank.Two, Rank.Three]))
            .build();

        const next = applyMove({ state, move: { kind: MoveKind.Draw } });

        expect(idsOf(next.stock)).toEqual(idsOf(state.stock.slice(0, 1)));
        expect(idsOf(next.waste)).toEqual([at(state.stock, 1).id]);
        expect(next.waste.every((c) => c.faceUp)).toBe(true);
        expect(next.wasteFan).toBe(1);
    });

    it('turn-3 moves three cards, the last drawn on top, and fans all three', () => {
        const state = aGameState()
            .withDrawMode(DrawMode.Three)
            .withStock(stockOf([Rank.Two, Rank.Three, Rank.Four, Rank.Five]))
            .build();

        const next = applyMove({ state, move: { kind: MoveKind.Draw } });

        // stock top is the last element: Five, then Four, then Three are drawn — Three ends on top
        expect(next.waste.map((c) => c.rank)).toEqual([Rank.Five, Rank.Four, Rank.Three]);
        expect(next.stock.map((c) => c.rank)).toEqual([Rank.Two]);
        expect(next.wasteFan).toBe(3);
    });

    it('turn-3 with fewer than three cards left draws what remains', () => {
        const state = aGameState()
            .withDrawMode(DrawMode.Three)
            .withStock(stockOf([Rank.Two, Rank.Three]))
            .build();

        const next = applyMove({ state, move: { kind: MoveKind.Draw } });

        expect(next.waste.map((c) => c.rank)).toEqual([Rank.Three, Rank.Two]);
        expect(next.stock).toEqual([]);
        expect(next.wasteFan).toBe(2);
    });

    it('drawing from an empty stock is illegal and changes nothing', () => {
        const state = aGameState()
            .withWaste(wasteOf([Rank.Two]))
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.Draw } })).toBe(state);
    });

    it('counts the draw as a move', () => {
        const state = aGameState()
            .withStock(stockOf([Rank.Two]))
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.Draw } }).moves).toBe(1);
    });
});

describe('applyMove — recycle', () => {
    it('returns the waste to the stock face-down so it draws again in the same order', () => {
        const original = aGameState()
            .withStock(stockOf([Rank.Two, Rank.Three, Rank.Four]))
            .build();
        const drawnThrice = [1, 2, 3].reduce((s) => applyMove({ state: s, move: { kind: MoveKind.Draw } }), original);

        const recycled = applyMove({ state: drawnThrice, move: { kind: MoveKind.Recycle } });

        expect(idsOf(recycled.stock)).toEqual(idsOf(original.stock));
        expect(recycled.stock.every((c) => !c.faceUp)).toBe(true);
        expect(recycled.waste).toEqual([]);
        expect(recycled.wasteFan).toBe(0);
        expect(recycled.recycles).toBe(1);
    });

    it('is illegal while the stock still has cards', () => {
        const state = aGameState()
            .withStock(stockOf([Rank.Two]))
            .withWaste(wasteOf([Rank.Three]))
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.Recycle } })).toBe(state);
    });

    it('is illegal when the waste is empty too', () => {
        const state = aGameState().build();

        expect(applyMove({ state, move: { kind: MoveKind.Recycle } })).toBe(state);
    });

    it('costs 100 points every time in turn-1', () => {
        const state = aGameState()
            .withWaste(wasteOf([Rank.Two]))
            .withScore(250)
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.Recycle } }).score).toBe(150);
    });

    it('is free for the first two recycles in turn-3, then costs 20 points', () => {
        const base = aGameState()
            .withDrawMode(DrawMode.Three)
            .withWaste(wasteOf([Rank.Two]))
            .withScore(100);

        expect(applyMove({ state: base.withRecycles(0).build(), move: { kind: MoveKind.Recycle } }).score).toBe(100);
        expect(applyMove({ state: base.withRecycles(1).build(), move: { kind: MoveKind.Recycle } }).score).toBe(100);
        expect(applyMove({ state: base.withRecycles(2).build(), move: { kind: MoveKind.Recycle } }).score).toBe(80);
    });

    it('never takes the score below zero', () => {
        const state = aGameState()
            .withWaste(wasteOf([Rank.Two]))
            .withScore(30)
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.Recycle } }).score).toBe(0);
    });
});

const card = ({ rank, suit, faceUp = true }: { rank: Rank; suit: Suit; faceUp?: boolean }) =>
    faceUp ? aCard().withRank(rank).withSuit(suit).build() : aCard().withRank(rank).withSuit(suit).asFaceDown().build();

describe('applyMove — tableau', () => {
    const blackNine = card({ rank: Rank.Nine, suit: Suit.Spades });
    const redTen = card({ rank: Rank.Ten, suit: Suit.Hearts });

    it('puts a card onto the opposite colour, one rank higher', () => {
        const state = aGameState()
            .withWaste([blackNine])
            .withColumn({ index: 2, cards: [redTen] })
            .build();

        const next = applyMove({ state, move: { kind: MoveKind.WasteToTableau, cardId: blackNine.id, to: 2 } });

        expect(idsOf(at(next.tableau, 2))).toEqual([redTen.id, blackNine.id]);
        expect(next.waste).toEqual([]);
    });

    it('rejects the same colour', () => {
        const blackTen = card({ rank: Rank.Ten, suit: Suit.Clubs });
        const state = aGameState()
            .withWaste([blackNine])
            .withColumn({ index: 0, cards: [blackTen] })
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.WasteToTableau, cardId: blackNine.id, to: 0 } })).toBe(state);
    });

    it('rejects the wrong rank', () => {
        const redJack = card({ rank: Rank.Jack, suit: Suit.Hearts });
        const state = aGameState()
            .withWaste([blackNine])
            .withColumn({ index: 0, cards: [redJack] })
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.WasteToTableau, cardId: blackNine.id, to: 0 } })).toBe(state);
    });

    it('rejects stacking onto a face-down card', () => {
        const hiddenTen = card({ rank: Rank.Ten, suit: Suit.Hearts, faceUp: false });
        const state = aGameState()
            .withWaste([blackNine])
            .withColumn({ index: 0, cards: [hiddenTen] })
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.WasteToTableau, cardId: blackNine.id, to: 0 } })).toBe(state);
    });

    it('accepts only a King onto an empty column', () => {
        const king = card({ rank: Rank.King, suit: Suit.Diamonds });
        const queen = card({ rank: Rank.Queen, suit: Suit.Clubs });

        const withKing = aGameState().withWaste([king]).build();
        const withQueen = aGameState().withWaste([queen]).build();

        expect(
            at(
                applyMove({ state: withKing, move: { kind: MoveKind.WasteToTableau, cardId: king.id, to: 3 } }).tableau,
                3,
            ),
        ).toHaveLength(1);
        expect(applyMove({ state: withQueen, move: { kind: MoveKind.WasteToTableau, cardId: queen.id, to: 3 } })).toBe(
            withQueen,
        );
    });

    it('moves a face-up run together with every card above it', () => {
        const blackJack = card({ rank: Rank.Jack, suit: Suit.Clubs });
        const redQueen = card({ rank: Rank.Queen, suit: Suit.Diamonds });
        const hidden = card({ rank: Rank.Two, suit: Suit.Clubs, faceUp: false });
        const state = aGameState()
            .withColumn({ index: 0, cards: [hidden, redTen, blackNine] })
            .withColumn({ index: 4, cards: [redQueen, blackJack] })
            .build();

        const next = applyMove({ state, move: { kind: MoveKind.TableauToTableau, cardId: redTen.id, from: 0, to: 4 } });

        expect(idsOf(at(next.tableau, 4))).toEqual([redQueen.id, blackJack.id, redTen.id, blackNine.id]);
        expect(idsOf(at(next.tableau, 0))).toEqual([hidden.id]);
    });

    it('moves a King-led run onto an empty column', () => {
        const king = card({ rank: Rank.King, suit: Suit.Spades });
        const queen = card({ rank: Rank.Queen, suit: Suit.Hearts });
        const hidden = card({ rank: Rank.Two, suit: Suit.Clubs, faceUp: false });
        const state = aGameState()
            .withColumn({ index: 1, cards: [hidden, king, queen] })
            .build();

        const next = applyMove({ state, move: { kind: MoveKind.TableauToTableau, cardId: king.id, from: 1, to: 5 } });

        expect(idsOf(at(next.tableau, 5))).toEqual([king.id, queen.id]);
    });

    it('rejects moving from a face-down card', () => {
        const hiddenTen = card({ rank: Rank.Ten, suit: Suit.Hearts, faceUp: false });
        const blackJack = card({ rank: Rank.Jack, suit: Suit.Clubs });
        const state = aGameState()
            .withColumn({ index: 0, cards: [hiddenTen, blackNine] })
            .withColumn({ index: 1, cards: [blackJack] })
            .build();

        expect(
            applyMove({ state, move: { kind: MoveKind.TableauToTableau, cardId: hiddenTen.id, from: 0, to: 1 } }),
        ).toBe(state);
    });

    it('rejects moving a column onto itself', () => {
        const king = card({ rank: Rank.King, suit: Suit.Spades });
        const state = aGameState()
            .withColumn({ index: 0, cards: [king] })
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.TableauToTableau, cardId: king.id, from: 0, to: 0 } })).toBe(
            state,
        );
    });

    it('turns an uncovered face-down card face-up and scores 5', () => {
        const hidden = card({ rank: Rank.Two, suit: Suit.Clubs, faceUp: false });
        const state = aGameState()
            .withColumn({ index: 0, cards: [hidden, blackNine] })
            .withColumn({ index: 1, cards: [redTen] })
            .build();

        const next = applyMove({
            state,
            move: { kind: MoveKind.TableauToTableau, cardId: blackNine.id, from: 0, to: 1 },
        });

        expect(at(at(next.tableau, 0), 0).faceUp).toBe(true);
        expect(next.score).toBe(5);
    });

    it('scores 5 for waste to tableau', () => {
        const state = aGameState()
            .withWaste([blackNine])
            .withColumn({ index: 2, cards: [redTen] })
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.WasteToTableau, cardId: blackNine.id, to: 2 } }).score).toBe(
            5,
        );
    });
});

describe('applyMove — foundations', () => {
    const aceOfHearts = card({ rank: Rank.Ace, suit: Suit.Hearts });
    const twoOfHearts = card({ rank: Rank.Two, suit: Suit.Hearts });

    it('starts an empty foundation with an Ace and scores 10', () => {
        const state = aGameState().withWaste([aceOfHearts]).build();

        const next = applyMove({ state, move: { kind: MoveKind.WasteToFoundation, cardId: aceOfHearts.id, to: 1 } });

        expect(idsOf(at(next.foundations, 1))).toEqual([aceOfHearts.id]);
        expect(next.score).toBe(10);
    });

    it('rejects a non-Ace on an empty foundation', () => {
        const state = aGameState().withWaste([twoOfHearts]).build();

        expect(applyMove({ state, move: { kind: MoveKind.WasteToFoundation, cardId: twoOfHearts.id, to: 0 } })).toBe(
            state,
        );
    });

    it('builds up in the same suit only', () => {
        const twoOfDiamonds = card({ rank: Rank.Two, suit: Suit.Diamonds });
        const sameSuit = aGameState()
            .withFoundation({ index: 0, cards: [aceOfHearts] })
            .withColumn({ index: 3, cards: [twoOfHearts] })
            .build();
        const otherSuit = aGameState()
            .withFoundation({ index: 0, cards: [aceOfHearts] })
            .withColumn({ index: 3, cards: [twoOfDiamonds] })
            .build();

        const next = applyMove({
            state: sameSuit,
            move: { kind: MoveKind.TableauToFoundation, cardId: twoOfHearts.id, from: 3, to: 0 },
        });

        expect(idsOf(at(next.foundations, 0))).toEqual([aceOfHearts.id, twoOfHearts.id]);
        expect(next.score).toBe(10);
        expect(
            applyMove({
                state: otherSuit,
                move: { kind: MoveKind.TableauToFoundation, cardId: twoOfDiamonds.id, from: 3, to: 0 },
            }),
        ).toBe(otherSuit);
    });

    it('takes only the top card of a tableau column', () => {
        const blackNine = card({ rank: Rank.Nine, suit: Suit.Spades });
        const state = aGameState()
            .withColumn({ index: 0, cards: [aceOfHearts, blackNine] })
            .build();

        expect(
            applyMove({ state, move: { kind: MoveKind.TableauToFoundation, cardId: aceOfHearts.id, from: 0, to: 0 } }),
        ).toBe(state);
    });

    it('moves a foundation card back onto the tableau for -15', () => {
        const blackThree = card({ rank: Rank.Three, suit: Suit.Clubs });
        const state = aGameState()
            .withFoundation({ index: 2, cards: [aceOfHearts, twoOfHearts] })
            .withColumn({ index: 6, cards: [blackThree] })
            .withScore(40)
            .build();

        const next = applyMove({
            state,
            move: { kind: MoveKind.FoundationToTableau, cardId: twoOfHearts.id, from: 2, to: 6 },
        });

        expect(idsOf(at(next.tableau, 6))).toEqual([blackThree.id, twoOfHearts.id]);
        expect(idsOf(at(next.foundations, 2))).toEqual([aceOfHearts.id]);
        expect(next.score).toBe(25);
    });

    it('never scores below zero when taking from a foundation', () => {
        const blackThree = card({ rank: Rank.Three, suit: Suit.Clubs });
        const state = aGameState()
            .withFoundation({ index: 2, cards: [aceOfHearts, twoOfHearts] })
            .withColumn({ index: 6, cards: [blackThree] })
            .build();

        expect(
            applyMove({ state, move: { kind: MoveKind.FoundationToTableau, cardId: twoOfHearts.id, from: 2, to: 6 } })
                .score,
        ).toBe(0);
    });
});

describe('applyMove — turn-3 waste fan', () => {
    it('shrinks by one as the top card is played, never below one while the waste has cards', () => {
        const king = card({ rank: Rank.King, suit: Suit.Spades });
        const state = aGameState()
            .withDrawMode(DrawMode.Three)
            .withWaste([card({ rank: Rank.Two, suit: Suit.Clubs }), card({ rank: Rank.Three, suit: Suit.Clubs }), king])
            .withWasteFan(1)
            .build();

        expect(applyMove({ state, move: { kind: MoveKind.WasteToTableau, cardId: king.id, to: 0 } }).wasteFan).toBe(1);
        expect(
            applyMove({
                state: { ...state, wasteFan: 3 },
                move: { kind: MoveKind.WasteToTableau, cardId: king.id, to: 0 },
            }).wasteFan,
        ).toBe(2);
    });
});

describe('applyMove — stale moves', () => {
    it('rejects a move naming a card that is no longer where the move says (double-fired click)', () => {
        const aceOfSpades = card({ rank: Rank.Ace, suit: Suit.Spades });
        const aceOfClubs = card({ rank: Rank.Ace, suit: Suit.Clubs });
        const state = aGameState().withWaste([aceOfClubs, aceOfSpades]).build();
        const move = { kind: MoveKind.WasteToFoundation, cardId: aceOfSpades.id, to: 0 } as const;

        const once = applyMove({ state, move });
        const twice = applyMove({ state: once, move: { ...move, to: 1 } });

        expect(twice).toBe(once);
    });

    it('counts every legal move and leaves an illegal one uncounted', () => {
        const aceOfSpades = card({ rank: Rank.Ace, suit: Suit.Spades });
        const state = aGameState().withWaste([aceOfSpades]).build();

        const next = applyMove({ state, move: { kind: MoveKind.WasteToFoundation, cardId: aceOfSpades.id, to: 0 } });

        expect(next.moves).toBe(1);
        expect(applyMove({ state: next, move: { kind: MoveKind.Draw } }).moves).toBe(1);
    });
});
