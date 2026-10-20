import { describe, expect, it } from 'vitest';

import { aCard, aGameState } from '~/testkit/builders/index.ts';

import { listLegalMoves } from './rules.ts';
import { MoveKind, Rank, Suit } from './model.ts';

describe('listLegalMoves', () => {
    it('lists draw while the stock has cards and recycle once only the waste does', () => {
        const card = aCard().asFaceDown().build();

        expect(listLegalMoves(aGameState().withStock([card]).build())).toContainEqual({ kind: MoveKind.Draw });
        expect(
            listLegalMoves(
                aGameState()
                    .withWaste([{ ...card, faceUp: true }])
                    .build(),
            ),
        ).toContainEqual({
            kind: MoveKind.Recycle,
        });
    });

    it('lists an Ace to every empty foundation and a King to every empty column', () => {
        const ace = aCard().withRank(Rank.Ace).withSuit(Suit.Hearts).build();
        const king = aCard().withRank(Rank.King).withSuit(Suit.Spades).build();
        const moves = listLegalMoves(
            aGameState()
                .withWaste([ace])
                .withColumn({ index: 0, cards: [king] })
                .build(),
        );

        expect(moves.filter((m) => m.kind === MoveKind.WasteToFoundation)).toHaveLength(4);
        expect(moves.filter((m) => m.kind === MoveKind.TableauToTableau)).toHaveLength(6);
    });

    it('lists nothing for an empty table', () => {
        expect(listLegalMoves(aGameState().build())).toEqual([]);
    });
});
