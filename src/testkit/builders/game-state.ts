import Chance from 'chance';

import { makeCardId } from '~/engine/deck.ts';
import { CardModel, CARDS_PER_SUIT, DrawMode, GameStateModel, PileModel, Rank, Suit } from '~/engine/model.ts';

const chance = new Chance();

// Defaults to an empty table — each test lays out exactly the cards its scenario needs.
class GameStateBuilder {
    private state: GameStateModel = {
        seed: chance.integer({ min: 0, max: 2 ** 31 }),
        drawMode: DrawMode.One,
        stock: [],
        waste: [],
        wasteFan: 0,
        foundations: [[], [], [], []],
        tableau: [[], [], [], [], [], [], []],
        score: 0,
        moves: 0,
        recycles: 0,
    };

    withDrawMode(drawMode: DrawMode): this {
        this.state = { ...this.state, drawMode };

        return this;
    }

    withStock(stock: PileModel): this {
        this.state = { ...this.state, stock };

        return this;
    }

    withWaste(waste: PileModel): this {
        this.state = { ...this.state, waste, wasteFan: Math.min(waste.length, 1) };

        return this;
    }

    withWasteFan(wasteFan: number): this {
        this.state = { ...this.state, wasteFan };

        return this;
    }

    withFoundation({ index, cards }: { index: number; cards: PileModel }): this {
        this.state = { ...this.state, foundations: this.state.foundations.map((p, i) => (i === index ? cards : p)) };

        return this;
    }

    withColumn({ index, cards }: { index: number; cards: readonly CardModel[] }): this {
        this.state = { ...this.state, tableau: this.state.tableau.map((c, i) => (i === index ? cards : c)) };

        return this;
    }

    withScore(score: number): this {
        this.state = { ...this.state, score };

        return this;
    }

    withRecycles(recycles: number): this {
        this.state = { ...this.state, recycles };

        return this;
    }

    // All 52 cards face-up in four King-to-Ace alternating-colour columns; stock and waste empty.
    asReadyToAutoComplete(): this {
        const columns = [
            descendingRun({ first: Suit.Hearts, second: Suit.Spades }),
            descendingRun({ first: Suit.Spades, second: Suit.Hearts }),
            descendingRun({ first: Suit.Diamonds, second: Suit.Clubs }),
            descendingRun({ first: Suit.Clubs, second: Suit.Diamonds }),
        ];
        this.state = {
            ...this.state,
            stock: [],
            waste: [],
            wasteFan: 0,
            tableau: this.state.tableau.map((_, i) => columns[i] ?? []),
        };

        return this;
    }

    // Every card home: four complete foundations, nothing anywhere else.
    asWon(): this {
        const suits = [Suit.Hearts, Suit.Spades, Suit.Diamonds, Suit.Clubs];
        this.state = {
            ...this.state,
            stock: [],
            waste: [],
            wasteFan: 0,
            tableau: this.state.tableau.map(() => []),
            foundations: suits.map((suit) => descendingRun({ first: suit, second: suit }).reverse()),
        };

        return this;
    }

    build(): GameStateModel {
        return this.state;
    }
}

export const aGameState = (): GameStateBuilder => new GameStateBuilder();

// King of `first`, Queen of `second`, Jack of `first`, … down to the Ace — alternating colours when
// `first` and `second` differ in colour.
const descendingRun = ({ first, second }: { first: Suit; second: Suit }): CardModel[] =>
    Array.from({ length: CARDS_PER_SUIT }, (_, i) => {
        const suit = i % 2 === 0 ? first : second;
        const rank = Rank.King - i;

        return { id: makeCardId({ suit, rank }), suit, rank, faceUp: true };
    });
