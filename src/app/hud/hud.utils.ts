import { DrawMode, isAutoCompletable, isWon } from '~/engine/index.ts';

import { SessionModel, SessionPhase } from '../session/session.utils.ts';

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

const isAutoCompleting = (session: SessionModel): boolean => session.phase === SessionPhase.AutoCompleting;

// Leaving a game the player has started (and not finished) throws their progress away — ask first.
export const needsConfirmationToLeave = (session: SessionModel): boolean =>
    session.game.moves > 0 && !isWon(session.game);

export const canUndo = (session: SessionModel): boolean => session.history.length > 0 && !isAutoCompleting(session);

export const isAutoCompleteOffered = (session: SessionModel): boolean =>
    isAutoCompletable(session.game) && !isAutoCompleting(session);

export const drawModeLabelMap: Record<DrawMode, string> = {
    [DrawMode.One]: 'Turn 1',
    [DrawMode.Three]: 'Turn 3',
};

export const drawModes: readonly DrawMode[] = [DrawMode.One, DrawMode.Three];

// A request to leave the current game, remembered while the player confirms. It belongs to one deal:
// once that deal is replaced, the question no longer applies.
export type LeaveRequestModel = { drawMode: DrawMode; dealNumber: number };

// The question also lapses once leaving stops needing confirmation (everything undone, or the game won).
export const openLeaveRequest = ({
    request,
    session,
}: {
    request: LeaveRequestModel | undefined;
    session: SessionModel;
}): LeaveRequestModel | undefined =>
    request !== undefined && request.dealNumber === session.dealNumber && needsConfirmationToLeave(session)
        ? request
        : undefined;

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
