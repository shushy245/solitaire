// The player's record across every deal. Bests exist only once a game has been won; the fastest time and the
// highest score are kept independently, so they may come from different games.
export type BestModel = { readonly timeMs: number; readonly score: number };

export type StatsModel = {
    readonly played: number;
    readonly won: number;
    readonly best: BestModel | undefined;
};

export const emptyStats: StatsModel = { played: 0, won: 0, best: undefined };

export const recordPlayed = (stats: StatsModel): StatsModel => ({ ...stats, played: stats.played + 1 });

const improveBest = ({ best, timeMs, score }: { best: BestModel | undefined; timeMs: number; score: number }) =>
    best === undefined
        ? { timeMs, score }
        : { timeMs: Math.min(best.timeMs, timeMs), score: Math.max(best.score, score) };

export const recordWin = ({
    stats,
    timeMs,
    score,
}: {
    stats: StatsModel;
    timeMs: number;
    score: number;
}): StatsModel => ({
    ...stats,
    won: stats.won + 1,
    best: improveBest({ best: stats.best, timeMs, score }),
});

const combineBests = ({ a, b }: { a: BestModel | undefined; b: BestModel | undefined }): BestModel | undefined =>
    a === undefined || b === undefined ? (a ?? b) : improveBest({ best: a, timeMs: b.timeMs, score: b.score });

// Another tab may have saved its own games since this one loaded the record: keep those, and add on top only
// what this tab played and won since `before` (the record as this tab last loaded or saved it).
export const mergeStats = ({
    saved,
    before,
    after,
}: {
    saved: StatsModel;
    before: StatsModel;
    after: StatsModel;
}): StatsModel => ({
    played: saved.played + after.played - before.played,
    won: saved.won + after.won - before.won,
    best: combineBests({ a: saved.best, b: after.best }),
});

const PERCENT = 100;

const hasPlayed = (stats: StatsModel): boolean => stats.played > 0;

export const winPercent = (stats: StatsModel): number =>
    hasPlayed(stats) ? Math.round((stats.won / stats.played) * PERCENT) : 0;
