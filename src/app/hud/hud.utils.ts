import { DrawMode, isAutoCompletable } from '~/engine/index.ts';

import { StatsModel, winPercent } from '../stats/stats.utils.ts';
import { isAutoCompleting, isAutoMoving, isGameUnderWay, SessionModel } from '../session/session.utils.ts';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

const twoDigits = (value: number): string => String(value).padStart(2, '0');

// 0:09, 59:59, then 1:01:01 once past the hour.
export const formatElapsed = (elapsedMs: number): string => {
    const totalSeconds = Math.floor(elapsedMs / MS_PER_SECOND);
    const seconds = totalSeconds % SECONDS_PER_MINUTE;
    const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
    const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const minutes = totalMinutes % MINUTES_PER_HOUR;

    return hours === 0 ? `${minutes}:${twoDigits(seconds)}` : `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
};

// Leaving a game the player has started (and not finished) throws their progress away — ask first.
export const needsConfirmationToLeave = isGameUnderWay;

export const isAutoCompleteOffered = (session: SessionModel): boolean =>
    isAutoCompletable(session.game) && !isAutoCompleting(session) && !isAutoMoving(session);

export const drawModeLabelMap: Record<DrawMode, string> = {
    [DrawMode.One]: 'Turn 1',
    [DrawMode.Three]: 'Turn 3',
};

export const drawModes: readonly DrawMode[] = [DrawMode.One, DrawMode.Three];

// Asking for the other mode is a mode switch; asking for the same one is a plain new deal.
export const leaveQuestion = ({
    requestedMode,
    currentMode,
}: {
    requestedMode: DrawMode;
    currentMode: DrawMode;
}): string =>
    requestedMode === currentMode
        ? 'Deal a new game? This one will be lost.'
        : `Switch to ${drawModeLabelMap[requestedMode]}? This game will be lost.`;

export type ModeSwitchProps = { selected: DrawMode; onSelect: (drawMode: DrawMode) => void };

export type ModeButtonProps = { mode: DrawMode; isSelected: boolean; onSelect: (drawMode: DrawMode) => void };

export type LeaveConfirmProps = { question: string; onLeave: () => void; onStay: () => void };

// A request to leave the current game, remembered while the player confirms. It belongs to one deal:
// once that deal is replaced, the question no longer applies.
export type LeaveRequestModel = { drawMode: DrawMode; dealNumber: number };

const isRequestForCurrentDeal = ({
    request,
    session,
}: {
    request: LeaveRequestModel;
    session: SessionModel;
}): boolean => request.dealNumber === session.dealNumber;

// The question also lapses once leaving stops needing confirmation (everything undone, or the game won).
export const openLeaveRequest = ({
    request,
    session,
}: {
    request: LeaveRequestModel | undefined;
    session: SessionModel;
}): LeaveRequestModel | undefined => {
    if (request === undefined) return undefined;

    return isRequestForCurrentDeal({ request, session }) && needsConfirmationToLeave(session) ? request : undefined;
};

const LATIN_LETTER = /^[a-z]$/i;

// A Latin layout names the letter (so AZERTY's Z is found where it is printed); any other layout falls back
// to the key's position on the keyboard.
const isZKey = (event: KeyboardEvent): boolean =>
    LATIN_LETTER.test(event.key) ? event.key.toLowerCase() === 'z' : event.code === 'KeyZ';

// AltGr reports as Ctrl+Alt, and types characters rather than issuing commands.
const hasCommandModifier = (event: KeyboardEvent): boolean => (event.ctrlKey || event.metaKey) && !event.altKey;

// Ctrl+Z (Cmd+Z on a Mac) undoes; a held key's auto-repeat does not undo again.
export const isUndoShortcut = (event: KeyboardEvent): boolean =>
    hasCommandModifier(event) && !event.shiftKey && !event.repeat && isZKey(event);

export const countLabel = ({ count, singular, plural }: { count: number; singular: string; plural: string }): string =>
    count === 1 ? singular : plural;

export enum RecordEntry {
    Played = 'played',
    Won = 'won',
    WinRate = 'winRate',
    BestTime = 'bestTime',
    BestScore = 'bestScore',
}

export type RecordEntryModel = { readonly entry: RecordEntry; readonly label: string; readonly value: string };

const NO_BEST_YET = '—';

// The player's record as the stats panel lists it; bests read as a dash until the first win.
export const recordEntries = (stats: StatsModel): readonly RecordEntryModel[] => [
    { entry: RecordEntry.Played, label: 'Played', value: String(stats.played) },
    { entry: RecordEntry.Won, label: 'Won', value: String(stats.won) },
    { entry: RecordEntry.WinRate, label: 'Win rate', value: `${winPercent(stats)}%` },
    {
        entry: RecordEntry.BestTime,
        label: 'Best time',
        value: stats.best === undefined ? NO_BEST_YET : formatElapsed(stats.best.timeMs),
    },
    {
        entry: RecordEntry.BestScore,
        label: 'Best score',
        value: stats.best === undefined ? NO_BEST_YET : String(stats.best.score),
    },
];

export type RecordPanelProps = { id: string; isOpen: boolean; stats: StatsModel };
