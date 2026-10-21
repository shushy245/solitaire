import { useId } from 'react';

import { Row } from '../../ui/box.tsx';
import { useGame } from '../game-provider.tsx';
import { useHint } from '../hint/hint-provider.tsx';
import { canUndo } from '../session/session.utils.ts';
import { GameOverPanelProps } from './game-over.utils.ts';
import { GameOverTestIds } from './game-over.test-ids.ts';
import { useFocusOnAppear } from '../use-focus-on-appear.ts';

import styles from './game-over.module.scss';

// Shown while no progress is possible. The game stays open behind it, so Undo lets the player try another line.
export const GameOver = (): JSX.Element | undefined => {
    const { session, undo, newGame } = useGame();
    const { isGameOver } = useHint();

    if (!isGameOver) return undefined;

    const handleNewGame = (): void => {
        newGame({ drawMode: session.game.drawMode });
    };

    return <GameOverPanel canUndo={canUndo(session)} onUndo={undo} onNewGame={handleNewGame} />;
};

const GameOverPanel = ({ canUndo: isUndoable, onUndo, onNewGame }: GameOverPanelProps): JSX.Element => {
    const titleId = useId();
    // The panel takes focus, so a keyboard player can step back (or, with nothing to undo, deal) straight away.
    const handleFirstActionRef = useFocusOnAppear<HTMLButtonElement>();

    return (
        <section aria-labelledby={titleId} className={styles.panel} data-testid={GameOverTestIds.Panel}>
            <h2 id={titleId} className={styles.title}>
                {`No more moves`}
            </h2>
            <p className={styles.note}>{`Undo to try another line, or deal a new game.`}</p>
            <Row className={styles.actions}>
                <button
                    type="button"
                    ref={isUndoable ? handleFirstActionRef : undefined}
                    disabled={!isUndoable}
                    className={styles.undo}
                    data-testid={GameOverTestIds.Undo}
                    onClick={onUndo}
                >
                    {`Undo`}
                </button>
                <button
                    type="button"
                    ref={isUndoable ? undefined : handleFirstActionRef}
                    className={styles.newGame}
                    data-testid={GameOverTestIds.NewGame}
                    onClick={onNewGame}
                >
                    {`New game`}
                </button>
            </Row>
        </section>
    );
};
