import { useCallback, useEffect, useRef, useState } from 'react';

import { DrawMode } from '~/engine/index.ts';

import { Row } from '../../ui/box.tsx';
import { useGame } from '../game-provider.tsx';
import { HudTestIds } from './hud.test-ids.ts';
import { useUndoShortcut } from './use-undo-shortcut.ts';
import { joinClassNames } from '../../utils/join-class-names.ts';
import {
    canUndo,
    countLabel,
    drawModeLabelMap,
    drawModes,
    formatElapsed,
    isAutoCompleteOffered,
    LeaveConfirmProps,
    leaveQuestion,
    LeaveRequestModel,
    ModeButtonProps,
    ModeSwitchProps,
    needsConfirmationToLeave,
    openLeaveRequest,
} from './hud.utils.ts';

import styles from './hud.module.scss';

export const Hud = (): JSX.Element => {
    const { session, undo, newGame, startAutoComplete } = useGame();
    const { game } = session;
    const [leaveRequest, setLeaveRequest] = useState<LeaveRequestModel | undefined>(undefined);
    const pending = openLeaveRequest({ request: leaveRequest, session });

    useUndoShortcut(undo);

    const requestNewGame = (drawMode: DrawMode): void => {
        if (needsConfirmationToLeave(session)) {
            setLeaveRequest({ drawMode, dealNumber: session.dealNumber });

            return;
        }

        newGame({ drawMode });
    };

    const handleNewGame = (): void => {
        requestNewGame(game.drawMode);
    };

    const handleModeChange = (drawMode: DrawMode): void => {
        if (drawMode !== game.drawMode) requestNewGame(drawMode);
    };

    const handleConfirmLeave = (): void => {
        if (pending !== undefined) newGame({ drawMode: pending.drawMode });
        setLeaveRequest(undefined);
    };

    const handleKeepPlaying = (): void => {
        setLeaveRequest(undefined);
    };

    return (
        <div className={styles.hud} data-testid={HudTestIds.Root} data-deal-number={session.dealNumber}>
            <Row className={styles.controls}>
                <ModeSwitch selected={game.drawMode} onSelect={handleModeChange} />
                <button
                    type="button"
                    className={styles.button}
                    disabled={!canUndo(session)}
                    data-testid={HudTestIds.Undo}
                    onClick={undo}
                >
                    {`Undo`}
                </button>
                <button
                    type="button"
                    className={joinClassNames(styles.button, styles.primary)}
                    data-testid={HudTestIds.NewGame}
                    onClick={handleNewGame}
                >
                    {`New game`}
                </button>
            </Row>
            <Row className={styles.statusRow}>
                <p className={styles.stats}>
                    <span data-testid={HudTestIds.Score}>
                        <strong>{game.score}</strong>
                        {` ${countLabel({ count: game.score, singular: 'point', plural: 'points' })}`}
                    </span>
                    <span data-testid={HudTestIds.Moves}>
                        <strong>{game.moves}</strong>
                        {` ${countLabel({ count: game.moves, singular: 'move', plural: 'moves' })}`}
                    </span>
                    <span data-testid={HudTestIds.Time}>
                        <strong>{formatElapsed(session.elapsedMs)}</strong> {`played`}
                    </span>
                </p>
                {isAutoCompleteOffered(session) && (
                    <button
                        type="button"
                        className={joinClassNames(styles.button, styles.accent)}
                        data-testid={HudTestIds.AutoComplete}
                        onClick={startAutoComplete}
                    >
                        {`Auto-complete`}
                    </button>
                )}
            </Row>
            {pending !== undefined && (
                <LeaveConfirm
                    question={leaveQuestion({ requestedMode: pending.drawMode, currentMode: game.drawMode })}
                    onLeave={handleConfirmLeave}
                    onStay={handleKeepPlaying}
                />
            )}
        </div>
    );
};

const ModeSwitch = ({ selected, onSelect }: ModeSwitchProps): JSX.Element => (
    <div role="group" aria-label="Cards turned per draw" className={styles.modeSwitch}>
        {drawModes.map((mode) => (
            <ModeButton key={mode} mode={mode} isSelected={mode === selected} onSelect={onSelect} />
        ))}
    </div>
);

const ModeButton = ({ mode, isSelected, onSelect }: ModeButtonProps): JSX.Element => {
    const handleClick = (): void => {
        onSelect(mode);
    };

    return (
        <button
            type="button"
            aria-pressed={isSelected}
            className={joinClassNames(styles.modeButton, isSelected && styles.modeSelected)}
            data-testid={HudTestIds.Mode(mode)}
            onClick={handleClick}
        >
            {drawModeLabelMap[mode]}
        </button>
    );
};

const LeaveConfirm = ({ question, onLeave, onStay }: LeaveConfirmProps): JSX.Element => {
    // Whatever had focus when the question appeared (the button that asked) gets it back when it goes.
    const opener = useRef(document.activeElement);
    const leaveButton = useRef<HTMLButtonElement | undefined>(undefined);
    const latestOnStay = useRef(onStay);

    useEffect(() => {
        latestOnStay.current = onStay;
    }, [onStay]);

    // React hands refs null on unmount; undefined means "not mounted".
    const handleLeaveButtonRef: React.RefCallback<HTMLButtonElement> = useCallback((element) => {
        leaveButton.current = element ?? undefined;
    }, []);

    // The question takes focus when it appears, so a keyboard user can answer it straight away.
    useEffect(() => {
        const returnTo = opener.current;
        const leave = leaveButton.current;

        if (leave !== undefined) leave.focus();

        return () => {
            if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus();
        };
    }, []);

    // Escape answers "keep playing" wherever focus is on the page.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') latestOnStay.current();
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <div role="group" aria-label="Leave this game?" className={styles.confirm} data-testid={HudTestIds.Confirm}>
            <p className={styles.confirmText}>{question}</p>
            <Row className={styles.confirmActions}>
                <button
                    type="button"
                    ref={handleLeaveButtonRef}
                    className={joinClassNames(styles.button, styles.primary)}
                    data-testid={HudTestIds.ConfirmLeave}
                    onClick={onLeave}
                >
                    {`Deal new game`}
                </button>
                <button type="button" className={styles.button} data-testid={HudTestIds.ConfirmStay} onClick={onStay}>
                    {`Keep playing`}
                </button>
            </Row>
        </div>
    );
};
