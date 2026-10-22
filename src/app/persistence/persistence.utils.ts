import { z } from 'zod';

import { RequestedDealModel } from '~/utils/seed-source.utils.ts';
import {
    CardModel,
    DECK_SIZE,
    DrawMode,
    FOUNDATION_COUNT,
    GameStateModel,
    isMovableRun,
    MAX_WASTE_FAN,
    Rank,
    Suit,
    TABLEAU_COUNT,
} from '~/engine/index.ts';

import { StatsModel } from '../stats/stats.utils.ts';
import { DealProgress, makeSession, SessionModel, SessionPhase } from '../session/session.utils.ts';

// localStorage is an external boundary: whatever is read back is parsed, never trusted. The game and the
// record are saved under separate keys, so a game that can no longer be read never costs the player their stats.
export { SAVED_GAME_KEY, SAVED_STATS_KEY } from './storage-keys.utils.ts';

const SAVE_VERSION = 1;

export enum SavedKind {
    Found = 'found',
    Missing = 'missing',
    Corrupt = 'corrupt',
}

export type SavedResult<T> =
    | { readonly kind: SavedKind.Found; readonly value: T }
    | { readonly kind: SavedKind.Missing }
    | { readonly kind: SavedKind.Corrupt; readonly reason: string };

// Everything about the current deal that survives a reload. The phase does not: a sweep cut short by the
// reload resumes as normal play, with Auto-complete offered again.
export type SavedGameModel = Pick<SessionModel, 'game' | 'history' | 'elapsedMs' | 'dealNumber' | 'progress'>;

// A card is saved as one short string — "hearts-11:up" — so a long undo history stays small.
const FACE_UP = 'up';
const FACE_DOWN = 'down';
const CARD_PATTERN = /^([a-z]+)-(\d{1,2}):(up|down)$/;

const toSavedCard = (card: CardModel): string => `${card.id}:${card.faceUp ? FACE_UP : FACE_DOWN}`;

const CardSchema = z
    .string()
    .regex(CARD_PATTERN)
    .transform((saved) => {
        const [, suit, rank, face] = CARD_PATTERN.exec(saved) ?? [];

        return { suit, rank: Number(rank), faceUp: face === FACE_UP };
    })
    .pipe(z.object({ suit: z.enum(Suit), rank: z.enum(Rank), faceUp: z.boolean() }))
    .transform(({ suit, rank, faceUp }): CardModel => ({ id: `${suit}-${rank}`, suit, rank, faceUp }));

const PileSchema = z.array(CardSchema);
const count = z.number().int().min(0);

const allCards = (game: GameStateModel): readonly CardModel[] => [
    ...game.stock,
    ...game.waste,
    ...game.foundations.flat(),
    ...game.tableau.flat(),
];

const holdsEveryCardOnce = (game: GameStateModel): boolean => {
    const ids = allCards(game).map((card) => card.id);

    return ids.length === DECK_SIZE && new Set(ids).size === DECK_SIZE;
};

// Ace first, then each rank one higher in the Ace's suit, all face-up — anything else could fake a win.
const isBuiltUpInOneSuit = (pile: readonly CardModel[]): boolean => {
    const [ace] = pile;

    if (ace === undefined) return true;

    return pile.every((card, i) => card.faceUp && card.rank === i + Rank.Ace && card.suit === ace.suit);
};

const hasPossibleWasteFan = (game: GameStateModel): boolean =>
    game.wasteFan <= Math.min(game.waste.length, MAX_WASTE_FAN);

// Hidden cards only under shown ones, never more hidden than the column was dealt (column i is dealt i), and the
// shown cards one descending run of alternating colours — anything else is a position no game reaches (and one
// the table cannot draw).
const isPossibleColumn = (column: readonly CardModel[], index: number): boolean => {
    const firstShown = column.findIndex((card) => card.faceUp);
    const hiddenCount = firstShown === -1 ? column.length : firstShown;
    const shown = column.slice(hiddenCount);

    return hiddenCount <= index && (column.length === 0 || shown.length > 0) && isMovableRun(shown);
};

const isSameDeal = ({ a, b }: { a: GameStateModel; b: GameStateModel }): boolean =>
    a.seed === b.seed && a.drawMode === b.drawMode;

const GameSchema = z
    .object({
        seed: count,
        drawMode: z.enum(DrawMode),
        stock: PileSchema,
        waste: PileSchema,
        wasteFan: count,
        foundations: z.array(PileSchema).length(FOUNDATION_COUNT),
        tableau: z.array(PileSchema).length(TABLEAU_COUNT),
        score: count,
        moves: count,
        recycles: count,
    })
    .refine(holdsEveryCardOnce, { message: `a game must hold the 52 cards exactly once` })
    .refine((game) => game.foundations.every(isBuiltUpInOneSuit), {
        message: 'every foundation must build up from the Ace in one suit, face-up',
    })
    .refine((game) => game.tableau.every(isPossibleColumn), {
        message: 'every tableau column must hide no more cards than it was dealt, under one shown descending run',
    })
    .refine((game) => game.stock.every((card) => !card.faceUp) && game.waste.every((card) => card.faceUp), {
        message: 'stock cards must lie face-down and waste cards face-up',
    })
    .refine(hasPossibleWasteFan, {
        message: 'the waste fan cannot show more cards than the waste holds or a draw turns',
    });

const SavedGameSchema = z
    .object({
        version: z.literal(SAVE_VERSION),
        game: GameSchema,
        history: z.array(GameSchema),
        elapsedMs: z.number().min(0),
        dealNumber: count,
        progress: z.enum(DealProgress),
    })
    .refine(({ game, history }) => history.every((earlier) => isSameDeal({ a: earlier, b: game })), {
        message: 'every undo history entry must come from the same deal as the game',
    });

const BestSchema = z.object({ timeMs: z.number().min(0), score: count });

const SavedStatsSchema = z
    .object({ version: z.literal(SAVE_VERSION), played: count, won: count, best: BestSchema.optional() })
    .refine(({ played, won }) => won <= played, { message: 'stats cannot hold more wins than games played' })
    .transform(({ played, won, best }): StatsModel => ({ played, won, best }));

type SavedGameDTO = z.input<typeof SavedGameSchema>;
type SavedStatsDTO = z.input<typeof SavedStatsSchema>;

const toSavedGameState = (game: GameStateModel): SavedGameDTO['game'] => ({
    ...game,
    stock: game.stock.map(toSavedCard),
    waste: game.waste.map(toSavedCard),
    foundations: game.foundations.map((pile) => pile.map(toSavedCard)),
    tableau: game.tableau.map((pile) => pile.map(toSavedCard)),
});

export const serializeGame = (session: SessionModel): string => {
    const saved: SavedGameDTO = {
        version: SAVE_VERSION,
        game: toSavedGameState(session.game),
        history: session.history.map(toSavedGameState),
        elapsedMs: session.elapsedMs,
        dealNumber: session.dealNumber,
        progress: session.progress,
    };

    return JSON.stringify(saved);
};

export const serializeStats = (stats: StatsModel): string => {
    const saved: SavedStatsDTO = {
        version: SAVE_VERSION,
        played: stats.played,
        won: stats.won,
        ...(stats.best === undefined ? {} : { best: stats.best }),
    };

    return JSON.stringify(saved);
};

const parseJson = (raw: string): SavedResult<unknown> => {
    try {
        return { kind: SavedKind.Found, value: JSON.parse(raw) };
    } catch (error) {
        return { kind: SavedKind.Corrupt, reason: `not valid JSON — ${String(error)}` };
    }
};

// Missing, corrupt (with the reason) or found — the one way every saved value is read back.
export const parseSaved = <T>({ raw, schema }: { raw: string | undefined; schema: z.ZodType<T> }): SavedResult<T> => {
    if (raw === undefined) return { kind: SavedKind.Missing };

    const json = parseJson(raw);

    if (json.kind !== SavedKind.Found) return json;

    const parsed = schema.safeParse(json.value);

    return parsed.success
        ? { kind: SavedKind.Found, value: parsed.data }
        : { kind: SavedKind.Corrupt, reason: z.prettifyError(parsed.error) };
};

export const parseSavedGame = (raw: string | undefined): SavedResult<SavedGameModel> =>
    parseSaved({
        raw,
        schema: SavedGameSchema.transform(({ game, history, elapsedMs, dealNumber, progress }) => ({
            game,
            history,
            elapsedMs,
            dealNumber,
            progress,
        })),
    });

export const parseSavedStats = (raw: string | undefined): SavedResult<StatsModel> =>
    parseSaved({ raw, schema: SavedStatsSchema });

// A deal the page asks for (?seed=, ?draw=) wins over resuming; the record always carries over.
export const chooseInitialSession = ({
    savedGame,
    stats,
    requestedDeal,
    freshSeed,
}: {
    savedGame: SavedGameModel | undefined;
    stats: StatsModel;
    requestedDeal: RequestedDealModel | undefined;
    freshSeed: () => number;
}): SessionModel => {
    if (requestedDeal !== undefined) return { ...makeSession(requestedDeal), stats };
    if (savedGame === undefined) return { ...makeSession({ seed: freshSeed(), drawMode: DrawMode.One }), stats };

    return { ...savedGame, phase: SessionPhase.Playing, stats };
};
