import { describe, expect, it } from 'vitest';

import { at } from '~/testkit/at.ts';
import { aCard, aGameState } from '~/testkit/builders/index.ts';
import { applyMove, dealGame, DrawMode, makeDrawMove, Rank, Suit } from '~/engine/index.ts';

import { dealOrder, layoutCards, movedCardIds, PileKind, stackOnStock } from './layout.utils.ts';

const slotOf = ({ slots, cardId }: { slots: ReturnType<typeof layoutCards>; cardId: string }) => {
    const slot = slots.find((s) => s.card.id === cardId);

    if (slot === undefined) throw new Error(`layout test: no slot for ${cardId}`);

    return slot;
};

describe('layoutCards', () => {
    it('gives each of the 52 cards exactly one slot', () => {
        const slots = layoutCards(dealGame({ seed: 11, drawMode: DrawMode.One }));

        expect(new Set(slots.map((s) => s.card.id)).size).toBe(52);
        expect(slots).toHaveLength(52);
    });

    it('places stock in column 0, waste in column 1 and foundations in columns 3–6 of the top row', () => {
        const stockCard = aCard().withSuit(Suit.Clubs).withRank(Rank.Five).asFaceDown().build();
        const wasteCard = aCard().withSuit(Suit.Hearts).withRank(Rank.Nine).build();
        const ace = aCard().withSuit(Suit.Spades).withRank(Rank.Ace).build();
        const slots = layoutCards(
            aGameState()
                .withStock([stockCard])
                .withWaste([wasteCard])
                .withFoundation({ index: 2, cards: [ace] })
                .build(),
        );

        expect(slotOf({ slots, cardId: stockCard.id })).toMatchObject({ pile: PileKind.Stock, column: 0, row: 0 });
        expect(slotOf({ slots, cardId: wasteCard.id })).toMatchObject({ pile: PileKind.Waste, column: 1, row: 0 });
        expect(slotOf({ slots, cardId: ace.id })).toMatchObject({ pile: PileKind.Foundation, column: 5, row: 0 });
    });

    it('offsets tableau cards by the face-down and face-up cards beneath them, separately', () => {
        const game = dealGame({ seed: 5, drawMode: DrawMode.One });
        const slots = layoutCards(game);
        const column6 = at(game.tableau, 6);

        expect(slotOf({ slots, cardId: at(column6, 0).id })).toMatchObject({
            row: 1,
            column: 6,
            downOffset: 0,
            upOffset: 0,
        });
        expect(slotOf({ slots, cardId: at(column6, 6).id })).toMatchObject({ downOffset: 6, upOffset: 0 });
    });

    it('counts face-up cards beneath separately from face-down ones', () => {
        const hidden = aCard().withSuit(Suit.Clubs).withRank(Rank.Two).asFaceDown().build();
        const king = aCard().withSuit(Suit.Hearts).withRank(Rank.King).build();
        const queen = aCard().withSuit(Suit.Spades).withRank(Rank.Queen).build();
        const slots = layoutCards(
            aGameState()
                .withColumn({ index: 3, cards: [hidden, king, queen] })
                .build(),
        );

        expect(slotOf({ slots, cardId: queen.id })).toMatchObject({ column: 3, downOffset: 1, upOffset: 1 });
    });

    it('fans only the visible turn-3 waste cards, bottom to top', () => {
        const waste = [Rank.Two, Rank.Three, Rank.Four, Rank.Five].map((rank) =>
            aCard().withSuit(Suit.Diamonds).withRank(rank).build(),
        );
        const slots = layoutCards(aGameState().withDrawMode(DrawMode.Three).withWaste(waste).withWasteFan(2).build());

        expect(waste.map((card) => slotOf({ slots, cardId: card.id }).fan)).toEqual([0, 0, 0, 1]);
    });

    it('stacks cards within a pile in pile order', () => {
        const game = dealGame({ seed: 8, drawMode: DrawMode.One });
        const slots = layoutCards(game);
        const stockZ = game.stock.map((card) => slotOf({ slots, cardId: card.id }).z);

        expect(stockZ).toEqual([...stockZ].sort((a, b) => a - b));
        expect(new Set(stockZ).size).toBe(stockZ.length);
    });
});

describe('movedCardIds', () => {
    it('lists exactly the cards whose slot changed between two layouts', () => {
        const before = dealGame({ seed: 21, drawMode: DrawMode.One });
        const move = makeDrawMove(before);

        if (move === undefined) throw new Error('layout test: expected a stock card');

        const after = applyMove({ state: before, move });

        expect(movedCardIds({ previous: layoutCards(before), next: layoutCards(after) })).toEqual(
            new Set([move.cardId]),
        );
    });

    it('lists nothing when the layout is unchanged', () => {
        const slots = layoutCards(dealGame({ seed: 21, drawMode: DrawMode.One }));

        expect(movedCardIds({ previous: slots, next: slots }).size).toBe(0);
    });
});

describe('dealOrder', () => {
    it('numbers tableau cards row by row across the columns, as a dealer deals', () => {
        const game = dealGame({ seed: 4, drawMode: DrawMode.One });
        const order = dealOrder(layoutCards(game));

        expect(order.get(at(at(game.tableau, 0), 0).id)).toBe(0);
        expect(order.get(at(at(game.tableau, 6), 0).id)).toBe(6);
        expect(order.get(at(at(game.tableau, 1), 1).id)).toBe(7);
        expect(order.get(at(at(game.tableau, 6), 6).id)).toBe(27);
        expect(order.size).toBe(28);
    });
});

describe('stackOnStock', () => {
    it('puts every card face-down on the stock pile, keeping each card once', () => {
        const slots = stackOnStock(layoutCards(dealGame({ seed: 4, drawMode: DrawMode.One })));

        expect(
            slots.every((s) => s.column === 0 && s.row === 0 && s.downOffset === 0 && s.upOffset === 0 && s.fan === 0),
        ).toBe(true);
        expect(slots.every((s) => !s.card.faceUp)).toBe(true);
        expect(new Set(slots.map((s) => s.z)).size).toBe(52);
    });
});
