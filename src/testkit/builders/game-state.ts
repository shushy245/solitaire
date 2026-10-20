import Chance from 'chance';

import { CardModel, DrawMode, GameStateModel, PileModel } from '~/engine/model.ts';

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

    build(): GameStateModel {
        return this.state;
    }
}

export const aGameState = (): GameStateBuilder => new GameStateBuilder();
