import { describe, expect, it } from 'vitest';

import { MoveKind, Rank, Suit } from '~/engine/index.ts';
import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { PileKind } from '../board/layout.utils.ts';
import {
    findDropMove,
    hasMovedBeyondClick,
    legalDropMove,
    offsetRect,
    pickUp,
    unionRects,
    widenDropAreas,
} from './drag.utils.ts';

const up = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).build();
const down = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).asFaceDown().build();

const hidden = down({ rank: Rank.Two, suit: Suit.Clubs });
const redTen = up({ rank: Rank.Ten, suit: Suit.Hearts });
const blackNine = up({ rank: Rank.Nine, suit: Suit.Spades });
const blackJack = up({ rank: Rank.Jack, suit: Suit.Clubs });
const aceOfHearts = up({ rank: Rank.Ace, suit: Suit.Hearts });

describe('pickUp', () => {
    const game = aGameState()
        .withColumn({ index: 0, cards: [hidden, redTen, blackNine] })
        .withWaste([up({ rank: Rank.Four, suit: Suit.Clubs }), aceOfHearts])
        .withFoundation({ index: 1, cards: [up({ rank: Rank.Ace, suit: Suit.Spades })] })
        .withStock([down({ rank: Rank.Six, suit: Suit.Diamonds })])
        .build();

    it('lifts a face-up tableau card together with every card above it', () => {
        expect(pickUp({ game, cardId: redTen.id })).toEqual({
            source: { pile: PileKind.Tableau, pileIndex: 0 },
            cardIds: [redTen.id, blackNine.id],
        });
    });

    it('lifts only the top waste card and the top foundation card', () => {
        expect(pickUp({ game, cardId: aceOfHearts.id })).toEqual({
            source: { pile: PileKind.Waste, pileIndex: 0 },
            cardIds: [aceOfHearts.id],
        });
        expect(pickUp({ game, cardId: up({ rank: Rank.Ace, suit: Suit.Spades }).id })).toMatchObject({
            source: { pile: PileKind.Foundation, pileIndex: 1 },
        });
        expect(pickUp({ game, cardId: up({ rank: Rank.Four, suit: Suit.Clubs }).id })).toBeUndefined();
    });

    it('refuses face-down cards and stock cards', () => {
        expect(pickUp({ game, cardId: hidden.id })).toBeUndefined();
        expect(pickUp({ game, cardId: down({ rank: Rank.Six, suit: Suit.Diamonds }).id })).toBeUndefined();
    });
});

describe('legalDropMove', () => {
    it('turns a legal drop into the matching move', () => {
        const game = aGameState()
            .withColumn({ index: 0, cards: [hidden, redTen, blackNine] })
            .withColumn({ index: 3, cards: [blackJack] })
            .build();
        const pickup = pickUp({ game, cardId: redTen.id });

        expect(pickup && legalDropMove({ game, pickup, target: { pile: PileKind.Tableau, pileIndex: 3 } })).toEqual({
            kind: MoveKind.TableauToTableau,
            cardId: redTen.id,
            from: 0,
            to: 3,
        });
    });

    it('sends a waste Ace to a foundation', () => {
        const game = aGameState().withWaste([aceOfHearts]).build();
        const pickup = pickUp({ game, cardId: aceOfHearts.id });

        expect(pickup && legalDropMove({ game, pickup, target: { pile: PileKind.Foundation, pileIndex: 2 } })).toEqual({
            kind: MoveKind.WasteToFoundation,
            cardId: aceOfHearts.id,
            to: 2,
        });
    });

    it('offers nothing for an illegal drop, a run onto a foundation, or a drop on the waste or stock', () => {
        const game = aGameState()
            .withColumn({ index: 0, cards: [redTen, blackNine] })
            .withColumn({ index: 1, cards: [up({ rank: Rank.Five, suit: Suit.Clubs })] })
            .build();
        const pickup = pickUp({ game, cardId: redTen.id });

        expect(pickup).toBeDefined();
        expect(
            pickup && legalDropMove({ game, pickup, target: { pile: PileKind.Tableau, pileIndex: 1 } }),
        ).toBeUndefined();
        expect(
            pickup && legalDropMove({ game, pickup, target: { pile: PileKind.Foundation, pileIndex: 0 } }),
        ).toBeUndefined();
        expect(
            pickup && legalDropMove({ game, pickup, target: { pile: PileKind.Waste, pileIndex: 0 } }),
        ).toBeUndefined();
        expect(
            pickup && legalDropMove({ game, pickup, target: { pile: PileKind.Stock, pileIndex: 0 } }),
        ).toBeUndefined();
    });
});

describe('findDropMove', () => {
    const rect = (left: number, top: number) => ({ left, top, right: left + 50, bottom: top + 70 });
    const blackTen = up({ rank: Rank.Ten, suit: Suit.Spades });
    const redJack = up({ rank: Rank.Jack, suit: Suit.Diamonds });
    // column 0 holds the dragged black nine; column 1 takes it (red ten), column 2 does not (black ten)
    const game = aGameState()
        .withColumn({ index: 0, cards: [blackNine] })
        .withColumn({ index: 1, cards: [redTen] })
        .withColumn({ index: 2, cards: [blackTen] })
        .withColumn({ index: 3, cards: [redJack] })
        .build();
    const pickup = { source: { pile: PileKind.Tableau, pileIndex: 0 }, cardIds: [blackNine.id] };
    const piles = [0, 1, 2, 3].map((pileIndex) => ({
        pile: PileKind.Tableau,
        pileIndex,
        rect: rect(pileIndex * 60, 100),
    }));
    const ontoColumnOne = { kind: MoveKind.TableauToTableau, cardId: blackNine.id, from: 0, to: 1 };

    it('plays onto the pile the dragged card overlaps most', () => {
        expect(findDropMove({ game, pickup, dragged: rect(65, 110), piles })).toEqual(ontoColumnOne);
    });

    it('lands on a legal pile even when an illegal one is overlapped more', () => {
        // overlaps column 2 (black ten) by 25px and column 1 (red ten) by only 15px
        expect(findDropMove({ game, pickup, dragged: rect(95, 110), piles })).toEqual(ontoColumnOne);
    });

    it('treats a drop mostly back over the source pile as no drop, even if it grazes a legal neighbour', () => {
        // overlaps column 0 by 37px and column 1 by only 3px
        expect(findDropMove({ game, pickup, dragged: rect(13, 100), piles })).toBeUndefined();
    });

    it('snaps back from a drop dead centre on an illegal pile, though a legal neighbour is grazed', () => {
        // centred on column 2 (black ten), column 1 (red ten) widened to reach 5px under the card's left edge
        const widened = piles.map((pile) =>
            pile.pileIndex === 1 ? { ...pile, rect: { ...pile.rect, right: pile.rect.right + 15 } } : pile,
        );

        expect(findDropMove({ game, pickup, dragged: rect(120, 100), piles: widened })).toBeUndefined();
    });

    it('treats a drop exactly between the source pile and a legal neighbour as no drop', () => {
        // overlaps column 0 and column 1 by 25px each
        const touching = piles.map((pile) =>
            pile.pileIndex === 1 ? { ...pile, rect: { ...pile.rect, left: 50, right: 100 } } : pile,
        );

        expect(findDropMove({ game, pickup, dragged: rect(25, 100), piles: touching })).toBeUndefined();
        expect(findDropMove({ game, pickup, dragged: rect(25, 100), piles: [...touching].reverse() })).toBeUndefined();
    });

    it('treats a drop that overlaps its source more than any legal pile as no drop, whatever overlaps most', () => {
        // column 2 (illegal) 40%, column 0 (the source) 35%, column 1 (legal) only 26%
        const dragged = { left: 0, top: 0, right: 100, bottom: 100 };
        const stacked = [
            { pile: PileKind.Tableau, pileIndex: 2, rect: { left: 0, top: 0, right: 40, bottom: 100 } },
            { pile: PileKind.Tableau, pileIndex: 0, rect: { left: 40, top: 0, right: 75, bottom: 100 } },
            { pile: PileKind.Tableau, pileIndex: 1, rect: { left: 74, top: 0, right: 100, bottom: 100 } },
        ];

        expect(findDropMove({ game, pickup, dragged, piles: stacked })).toBeUndefined();
    });

    it('snaps back when no overlapped pile takes the card', () => {
        expect(findDropMove({ game, pickup, dragged: rect(125, 110), piles })).toBeUndefined();
        expect(findDropMove({ game, pickup, dragged: rect(400, 400), piles })).toBeUndefined();
    });
});

describe('widenDropAreas', () => {
    const cardRect = { left: 100, top: 200, right: 150, bottom: 270 };
    // a quarter of a 40px card: 10px of padding
    const widen = ({
        pile,
        boardBottom = 500,
        viewportHeight = 900,
    }: {
        pile: PileKind;
        boardBottom?: number;
        viewportHeight?: number;
    }) =>
        widenDropAreas({
            piles: [{ pile, pileIndex: 0, rect: cardRect }],
            cardWidth: 40,
            boardBottom,
            viewportHeight,
        })[0]?.rect;

    it('pads every pile sideways and vertically, so a drop slightly off its edge still lands', () => {
        expect(widen({ pile: PileKind.Foundation })).toEqual({ left: 90, top: 190, right: 160, bottom: 280 });
    });

    it('stretches a tableau column down to the foot of the window, below the table itself', () => {
        expect(widen({ pile: PileKind.Tableau })).toEqual({ left: 90, top: 190, right: 160, bottom: 900 });
    });

    it('stretches a column to the table bottom when the table runs past the window', () => {
        expect(widen({ pile: PileKind.Tableau, boardBottom: 1400 })?.bottom).toBe(1400);
    });

    it('never shortens a column that already reaches past the floor', () => {
        expect(widen({ pile: PileKind.Tableau, boardBottom: 100, viewportHeight: 250 })?.bottom).toBe(280);
    });
});

describe('unionRects', () => {
    it('spans every rect given', () => {
        expect(
            unionRects([
                { left: 10, top: 20, right: 60, bottom: 90 },
                { left: 10, top: 40, right: 60, bottom: 140 },
            ]),
        ).toEqual({ left: 10, top: 20, right: 60, bottom: 140 });
    });
});

describe('hasMovedBeyondClick', () => {
    it('treats a few pixels of jitter as a click and a longer travel as a drag', () => {
        expect(hasMovedBeyondClick({ dx: 2, dy: 3 })).toBe(false);
        expect(hasMovedBeyondClick({ dx: 6, dy: 0 })).toBe(true);
    });
});

describe('offsetRect', () => {
    it('moves a box by the pointer travel', () => {
        expect(offsetRect({ rect: { left: 10, top: 20, right: 60, bottom: 90 }, dx: 5, dy: -10 })).toEqual({
            left: 15,
            top: 10,
            right: 65,
            bottom: 80,
        });
    });
});
