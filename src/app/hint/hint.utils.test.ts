import { describe, expect, it } from 'vitest';

import { MoveKind, Rank, Suit } from '~/engine/index.ts';
import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { PileKind } from '../board/layout.utils.ts';
import { HintKind, highlightOf, isHintShortcut, nextHint, shownHighlight } from './hint.utils.ts';

const up = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).build();
const down = ({ rank, suit }: { rank: Rank; suit: Suit }) => aCard().withRank(rank).withSuit(suit).asFaceDown().build();

const aceOfHearts = up({ rank: Rank.Ace, suit: Suit.Hearts });
const blackNine = up({ rank: Rank.Nine, suit: Suit.Spades });
const redEight = up({ rank: Rank.Eight, suit: Suit.Diamonds });
const redTen = up({ rank: Rank.Ten, suit: Suit.Hearts });
const hidden = down({ rank: Rank.Four, suit: Suit.Clubs });

// two hints: A♥ up, then 9♠ (with 8♦) onto 10♥, uncovering a card
const game = aGameState()
    .withColumn({ index: 0, cards: [hidden, blackNine, redEight] })
    .withColumn({ index: 1, cards: [down({ rank: Rank.Two, suit: Suit.Clubs }), redTen] })
    .withColumn({ index: 3, cards: [down({ rank: Rank.Five, suit: Suit.Spades }), aceOfHearts] })
    .build();

describe('nextHint', () => {
    it('starts at the most useful hint', () => {
        expect(nextHint({ previous: undefined, game })).toEqual({ kind: HintKind.Showing, game, index: 0 });
    });

    it('moves on to the next hint for the same game, wrapping round to the first', () => {
        const first = nextHint({ previous: undefined, game });
        const second = nextHint({ previous: first, game });

        expect(second).toEqual({ kind: HintKind.Showing, game, index: 1 });
        expect(nextHint({ previous: second, game })).toEqual({ kind: HintKind.Showing, game, index: 0 });
    });

    it('starts over at the first hint once the game has changed', () => {
        const first = nextHint({ previous: undefined, game });
        const changed = aGameState()
            .withColumn({ index: 0, cards: [aceOfHearts] })
            .build();

        expect(nextHint({ previous: nextHint({ previous: first, game }), game: changed })).toEqual({
            kind: HintKind.Showing,
            game: changed,
            index: 0,
        });
    });

    it('says there is no move when nothing plays and nothing is left to draw', () => {
        const stuck = aGameState().build();

        expect(nextHint({ previous: undefined, game: stuck })).toEqual({ kind: HintKind.NoMoves, game: stuck });
    });
});

describe('highlightOf', () => {
    it('marks the moving card and every card above it, and the card it lands on', () => {
        expect(
            highlightOf({ game, move: { kind: MoveKind.TableauToTableau, cardId: blackNine.id, from: 0, to: 1 } }),
        ).toEqual({ cardIds: new Set([blackNine.id, redEight.id, redTen.id]), pile: undefined, isStock: false });
    });

    it('marks the empty pile a card goes to when nothing lies there', () => {
        expect(
            highlightOf({ game, move: { kind: MoveKind.TableauToFoundation, cardId: aceOfHearts.id, from: 3, to: 0 } }),
        ).toEqual({
            cardIds: new Set([aceOfHearts.id]),
            pile: { pile: PileKind.Foundation, pileIndex: 0 },
            isStock: false,
        });
    });

    it('marks the stock for a draw or a recycle', () => {
        expect(highlightOf({ game, move: { kind: MoveKind.Recycle } })).toEqual({
            cardIds: new Set(),
            pile: undefined,
            isStock: true,
        });
    });
});

describe('shownHighlight', () => {
    it('shows the hint only for the game it was given for, and only while it is visible', () => {
        const hint = nextHint({ previous: undefined, game });

        expect(shownHighlight({ hint, isVisible: true, game })?.cardIds).toEqual(new Set([aceOfHearts.id]));
        expect(shownHighlight({ hint, isVisible: false, game })).toBeUndefined();
        expect(shownHighlight({ hint, isVisible: true, game: aGameState().build() })).toBeUndefined();
    });
});

describe('isHintShortcut', () => {
    it('is a plain H, not held down and with no modifier', () => {
        const key = (overrides: Partial<KeyboardEventInit>) => new KeyboardEvent('keydown', { key: 'h', ...overrides });

        expect(isHintShortcut(key({}))).toBe(true);
        expect(isHintShortcut(key({ key: 'H' }))).toBe(true);
        expect(isHintShortcut(key({ repeat: true }))).toBe(false);
        expect(isHintShortcut(key({ ctrlKey: true }))).toBe(false);
        expect(isHintShortcut(key({ metaKey: true }))).toBe(false);
        expect(isHintShortcut(key({ altKey: true }))).toBe(false);
        expect(isHintShortcut(key({ key: 'g' }))).toBe(false);
    });
});
