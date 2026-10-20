import { describe, expect, it } from 'vitest';

import { MoveKind, Rank, Suit } from '~/engine/index.ts';
import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { PileKind } from '../board/layout.utils.ts';
import { findDropTarget, hasMovedBeyondClick, legalDropMove, pickUp, unionRects } from './drag.utils.ts';

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

describe('findDropTarget', () => {
    const rect = (left: number, top: number) => ({ left, top, right: left + 50, bottom: top + 70 });
    const piles = [
        { pile: PileKind.Tableau, pileIndex: 0, rect: rect(0, 100) },
        { pile: PileKind.Tableau, pileIndex: 1, rect: rect(60, 100) },
        { pile: PileKind.Foundation, pileIndex: 0, rect: rect(180, 0) },
    ];
    const source = { pile: PileKind.Tableau, pileIndex: 0 };

    it('picks the pile the dragged card overlaps most', () => {
        expect(findDropTarget({ dragged: rect(45, 110), piles, source })).toEqual({
            pile: PileKind.Tableau,
            pileIndex: 1,
        });
    });

    it('ignores the pile the cards came from', () => {
        expect(findDropTarget({ dragged: rect(5, 105), piles, source })).toBeUndefined();
    });

    it('finds nothing when the card is dropped on bare felt', () => {
        expect(findDropTarget({ dragged: rect(400, 400), piles, source })).toBeUndefined();
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
