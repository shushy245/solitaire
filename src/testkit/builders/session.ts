import Chance from 'chance';

import { StatsModel } from '~/app/stats/stats.utils.ts';
import { dealGame, DrawMode, GameStateModel, listLegalMoves, makeDrawMove, MoveKind } from '~/engine/index.ts';
import {
    DealProgress,
    makeSession,
    reduceSession,
    SessionActionKind,
    SessionModel,
    SessionPhase,
} from '~/app/session/session.utils.ts';

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

    withDeal({ seed, drawMode }: { seed: number; drawMode: DrawMode }): this {
        this.state = { ...this.state, game: dealGame({ seed, drawMode }) };

        return this;
    }

    withDealNumber(dealNumber: number): this {
        this.state = { ...this.state, dealNumber };

        return this;
    }

    // Really plays `draws` draws through the session reducer, so history and the record are what play produces.
    afterDraws(draws: number): this {
        this.state = Array.from({ length: draws }).reduce<SessionModel>((session) => {
            const move = makeDrawMove(session.game);

            if (move === undefined) throw new Error(`aSession.afterDraws: stock ran out before ${draws} draws`);

            return reduceSession({ session, action: { kind: SessionActionKind.Move, move } });
        }, this.state);

        return this;
    }

    // Really plays the first legal move of `kind` through the session reducer.
    afterLegalMove(kind: MoveKind): this {
        const move = listLegalMoves(this.state.game).find((candidate) => candidate.kind === kind);

        if (move === undefined) throw new Error(`aSession.afterLegalMove: no legal ${kind} move in this game`);

        this.state = reduceSession({ session: this.state, action: { kind: SessionActionKind.Move, move } });

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

    withStats(stats: StatsModel): this {
        this.state = { ...this.state, stats };

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

    // Won but for the King of hearts on the first column; the deal was counted as played.
    asOneMoveFromWon(): this {
        const game = { ...aGameState().asOneMoveFromWon().build(), moves: 51, score: 500 };
        this.state = { ...this.state, game, history: [], phase: SessionPhase.Playing, progress: DealProgress.Started };

        return this;
    }

    // Every card home and the win already counted — a won game as it is restored after a reload.
    asWon(): this {
        const game = { ...aGameState().asWon().build(), moves: 52, score: 510 };
        this.state = { ...this.state, game, history: [], phase: SessionPhase.Playing, progress: DealProgress.Won };

        return this;
    }

    build(): SessionModel {
        return this.state;
    }
}

export const aSession = (): SessionBuilder => new SessionBuilder();
