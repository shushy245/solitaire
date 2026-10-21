import { describe, expect, it } from 'vitest';

import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { listHints } from './hints.ts';
import { MoveKind, Rank, Suit } from './model.ts';

const up = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).build();
const down = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).asFaceDown().build();

const aceOfHearts = up({ rank: Rank.Ace, suit: Suit.Hearts });
const blackNine = up({ rank: Rank.Nine, suit: Suit.Spades });
const redTen = up({ rank: Rank.Ten, suit: Suit.Hearts });
const hidden = down({ rank: Rank.Four, suit: Suit.Clubs });
const stockCard = down({ rank: Rank.Five, suit: Suit.Clubs });

describe('listHints', () => {
    it('ranks a foundation move first, then a move that uncovers a card, then a waste card onto a column, the stock last', () => {
        const state = aGameState()
            .withWaste([up({ rank: Rank.Seven, suit: Suit.Hearts })])
            .withColumn({ index: 0, cards: [hidden, blackNine] })
            .withColumn({ index: 1, cards: [down({ rank: Rank.Two, suit: Suit.Clubs }), redTen] })
            .withColumn({
                index: 2,
                cards: [down({ rank: Rank.Six, suit: Suit.Diamonds }), up({ rank: Rank.Eight, suit: Suit.Clubs })],
            })
            .withColumn({ index: 3, cards: [down({ rank: Rank.Four, suit: Suit.Spades }), aceOfHearts] })
            .build();

        expect(listHints(state).map((move) => move.kind)).toEqual([
            MoveKind.TableauToFoundation,
            MoveKind.TableauToTableau,
            MoveKind.WasteToTableau,
            MoveKind.Recycle,
        ]);
    });

    it('never suggests shuffling a run between equal places, nor a King from one empty column to another', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [redTen, blackNine] })
            .withColumn({ index: 1, cards: [up({ rank: Rank.Ten, suit: Suit.Diamonds })] })
            .withColumn({ index: 2, cards: [up({ rank: Rank.King, suit: Suit.Clubs })] })
            .withColumn({ index: 3, cards: [] })
            .build();

        expect(listHints(state)).toEqual([]);
    });

    it('suggests emptying a column by moving its whole run onto another', () => {
        const state = aGameState()
            .withColumn({ index: 0, cards: [blackNine] })
            .withColumn({ index: 1, cards: [down({ rank: Rank.Four, suit: Suit.Spades }), redTen] })
            .build();

        expect(listHints(state)).toEqual([{ kind: MoveKind.TableauToTableau, cardId: blackNine.id, from: 0, to: 1 }]);
    });

    it('never suggests taking a card back down from a foundation', () => {
        const state = aGameState()
            .withFoundation({ index: 0, cards: [aceOfHearts, up({ rank: Rank.Two, suit: Suit.Hearts })] })
            .withColumn({ index: 0, cards: [up({ rank: Rank.Three, suit: Suit.Spades })] })
            .build();

        expect(listHints(state)).toEqual([]);
    });

    it('falls back to the stock — draw, or recycle once it is empty — when nothing else plays', () => {
        const withStock = aGameState().withStock([stockCard]).build();
        const withWasteOnly = aGameState()
            .withWaste([up({ rank: Rank.Five, suit: Suit.Clubs })])
            .build();

        expect(listHints(withStock)).toEqual([{ kind: MoveKind.Draw, cardId: stockCard.id }]);
        expect(listHints(withWasteOnly)).toEqual([{ kind: MoveKind.Recycle }]);
    });

    it('offers the stock after the real moves, never instead of them', () => {
        const state = aGameState()
            .withStock([stockCard])
            .withColumn({ index: 0, cards: [aceOfHearts] })
            .build();

        expect(listHints(state).map((move) => move.kind)).toEqual([MoveKind.TableauToFoundation, MoveKind.Draw]);
    });

    it('has nothing to suggest with no move and nothing left to draw', () => {
        expect(listHints(aGameState().build())).toEqual([]);
    });
});
