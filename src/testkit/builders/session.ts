import Chance from 'chance';

import { DrawMode, GameStateModel } from '~/engine/index.ts';
import { makeSession, SessionModel, SessionPhase } from '~/app/session/session.utils.ts';

import { aGameState } from './game-state.ts';

const chance = new Chance();

class SessionBuilder {
    private state: SessionModel = makeSession({
        seed: chance.integer({ min: 0, max: 2 ** 31 }),
        drawMode: DrawMode.One,
    });

    withGame(game: GameStateModel): this {
        this.state = { ...this.state, game };

        return this;
    }

    withDrawMode(drawMode: DrawMode): this {
        this.state = { ...this.state, game: { ...this.state.game, drawMode } };

        return this;
    }

    withScore(score: number): this {
        this.state = { ...this.state, game: { ...this.state.game, score } };

        return this;
    }

    withElapsedMs(elapsedMs: number): this {
        this.state = { ...this.state, elapsedMs };

        return this;
    }

    // A game under way: `moves` moves made, every earlier position on the undo stack.
    asPlayed(moves: number): this {
        const history = Array.from({ length: moves }, (_, made) => ({ ...this.state.game, moves: made }));
        this.state = { ...this.state, game: { ...this.state.game, moves }, history };

        return this;
    }

    // Every card face-up with nothing left to draw, one move already made.
    asReadyToAutoComplete(): this {
        const game = { ...aGameState().asReadyToAutoComplete().build(), moves: 1 };
        this.state = { ...this.state, game, history: [], phase: SessionPhase.Playing };

        return this;
    }

    build(): SessionModel {
        return this.state;
    }
}

export const aSession = (): SessionBuilder => new SessionBuilder();
