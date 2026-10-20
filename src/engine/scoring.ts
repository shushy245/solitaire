import { DrawMode, GameStateModel, MoveKind, MoveOf } from './model.ts';

// Windows-standard Klondike scoring.
export const REVEAL_BONUS = 5;
const TO_FOUNDATION = 10;
const WASTE_TO_TABLEAU = 5;
const FOUNDATION_TO_TABLEAU = -15;

const recyclePenaltyMap: Record<DrawMode, { freeRecycles: number; penalty: number }> = {
    [DrawMode.One]: { freeRecycles: 0, penalty: -100 },
    [DrawMode.Three]: { freeRecycles: 2, penalty: -20 },
};

const recyclePenalty = (state: GameStateModel): number => {
    const { freeRecycles, penalty } = recyclePenaltyMap[state.drawMode];

    return state.recycles < freeRecycles ? 0 : penalty;
};

type ScoreMap = { [K in MoveKind]: (args: { state: GameStateModel; move: MoveOf<K> }) => number };

const scoreMap: ScoreMap = {
    [MoveKind.Draw]: () => 0,
    [MoveKind.Recycle]: ({ state }) => recyclePenalty(state),
    [MoveKind.WasteToTableau]: () => WASTE_TO_TABLEAU,
    [MoveKind.WasteToFoundation]: () => TO_FOUNDATION,
    [MoveKind.TableauToTableau]: () => 0,
    [MoveKind.TableauToFoundation]: () => TO_FOUNDATION,
    [MoveKind.FoundationToTableau]: () => FOUNDATION_TO_TABLEAU,
};

// The score change a legal move earns, before any card it uncovers is revealed.
export const scoreMove = <K extends MoveKind>({ state, move }: { state: GameStateModel; move: MoveOf<K> }): number =>
    scoreMap[move.kind]({ state, move });

export const clampScore = (score: number): number => Math.max(0, score);
