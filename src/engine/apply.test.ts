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
