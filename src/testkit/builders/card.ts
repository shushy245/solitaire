import Chance from 'chance';

import { makeCardId } from '~/engine/deck.ts';
import { CardModel, Rank, Suit } from '~/engine/model.ts';

const chance = new Chance();

class CardBuilder {
    private state: { suit: Suit; rank: Rank; faceUp: boolean } = {
        suit: chance.pickone(Object.values(Suit)),
        rank: chance.integer({ min: Rank.Ace, max: Rank.King }),
        faceUp: true,
    };

    withSuit(suit: Suit): this {
        this.state = { ...this.state, suit };

        return this;
    }

    withRank(rank: Rank): this {
        this.state = { ...this.state, rank };

        return this;
    }

    asFaceDown(): this {
        this.state = { ...this.state, faceUp: false };

        return this;
    }

    asFaceUp(): this {
        this.state = { ...this.state, faceUp: true };

        return this;
    }

    build(): CardModel {
        return { id: makeCardId(this.state), suit: this.state.suit, rank: this.state.rank, faceUp: this.state.faceUp };
    }
}

export const aCard = (): CardBuilder => new CardBuilder();
