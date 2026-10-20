import { useCallback, useEffect, useId, useRef } from 'react';

import { GameStateModel, isWon } from '~/engine/index.ts';

import { useGame } from '../game-provider.tsx';
import { CelebrationTestIds } from './celebration.test-ids.ts';
import { usePrefersReducedMotion } from '../motion/motion-provider.tsx';
import { CascadeModel, isCascadeOver, makeCascade, stepCascade } from './cascade.utils.ts';
import { measureCardRect, paintCard, prepareCanvas, readCardPaint } from './cascade-canvas.ts';
import {
    cardsById,
    planLaunches,
    viewportBounds,
    WinCascadeProps,
    WinOverlayProps,
    winSummary,
} from './celebration.utils.ts';

import styles from './celebration.module.scss';

// Shown for as long as the game is won. The cascade plays for a win made on this visit — not for a game that
// was already won when the page opened — and never for a player who prefers reduced motion.
export const Celebration = (): JSX.Element | undefined => {
    const { session, newGame } = useGame();
    const prefersReducedMotion = usePrefersReducedMotion();
    const { game } = session;
    const wonOnArrival = useRef<GameStateModel | undefined>(isWon(game) ? game : undefined);

    if (!isWon(game)) return undefined;

    const isCascadeWanted = game !== wonOnArrival.current && !prefersReducedMotion();

    const handleNewGame = (): void => {
        newGame({ drawMode: game.drawMode });
    };

    return (
        <>
            {isCascadeWanted && <WinCascade game={game} />}
            <WinOverlay elapsedMs={session.elapsedMs} score={game.score} onNewGame={handleNewGame} />
        </>
    );
};

const WinCascade = ({ game }: WinCascadeProps): JSX.Element => {
    const canvasElement = useRef<HTMLCanvasElement | undefined>(undefined);

    // React hands refs null on unmount; undefined means "not mounted".
    const handleCanvasRef: React.RefCallback<HTMLCanvasElement> = useCallback((element) => {
        canvasElement.current = element ?? undefined;
    }, []);

    // The cascade lives in this effect, outside React state: each frame steps it and paints it, and leaving
    // (a new game, an undo, unmount) cancels the next frame.
    useEffect(() => {
        const canvas = canvasElement.current;
        const { launches, cardSize } = planLaunches({ game, rectOf: measureCardRect });

        if (canvas === undefined || cardSize === undefined) return undefined;

        const bounds = viewportBounds({ width: window.innerWidth, height: window.innerHeight, cardSize });
        const context = prepareCanvas({ canvas, bounds });
        const cards = cardsById(game);
        const paint = readCardPaint();
        const loop: { cascade: CascadeModel; lastFrameAt: number | undefined; frame: number } = {
            cascade: makeCascade({ launches, seed: game.seed }),
            lastFrameAt: undefined,
            frame: 0,
        };

        const handleFrame = (frameAt: number): void => {
            const dtMs = loop.lastFrameAt === undefined ? 0 : frameAt - loop.lastFrameAt;
            loop.lastFrameAt = frameAt;
            loop.cascade = stepCascade({ cascade: loop.cascade, dtMs, bounds });

            if (context !== undefined) {
                loop.cascade.flying.forEach(({ cardId, x, y }) => {
                    const card = cards.get(cardId);

                    if (card === undefined) return;

                    paintCard({
                        context,
                        card,
                        at: { left: x, top: y, width: cardSize.width, height: cardSize.height },
                        paint,
                    });
                });
            }

            if (!isCascadeOver(loop.cascade)) loop.frame = window.requestAnimationFrame(handleFrame);
        };

        loop.frame = window.requestAnimationFrame(handleFrame);

        return () => {
            window.cancelAnimationFrame(loop.frame);
        };
    }, [game]);

    return (
        <canvas ref={handleCanvasRef} aria-hidden className={styles.cascade} data-testid={CelebrationTestIds.Cascade} />
    );
};

const WinOverlay = ({ elapsedMs, score, onNewGame }: WinOverlayProps): JSX.Element => {
    const titleId = useId();
    const newGameButton = useRef<HTMLButtonElement | undefined>(undefined);

    const handleNewGameRef: React.RefCallback<HTMLButtonElement> = useCallback((element) => {
        newGameButton.current = element ?? undefined;
    }, []);

    // The win takes focus, so a keyboard player can deal again straight away.
    useEffect(() => {
        const button = newGameButton.current;

        if (button !== undefined) button.focus();
    }, []);

    return (
        <section
            role="dialog"
            aria-labelledby={titleId}
            className={styles.overlay}
            data-testid={CelebrationTestIds.Overlay}
        >
            <h2 id={titleId} className={styles.title}>
                {`You won!`}
            </h2>
            <p className={styles.summary} data-testid={CelebrationTestIds.Summary}>
                {winSummary({ elapsedMs, score })}
            </p>
            <button
                type="button"
                ref={handleNewGameRef}
                className={styles.newGame}
                data-testid={CelebrationTestIds.NewGame}
                onClick={onNewGame}
            >
                {`New game`}
            </button>
        </section>
    );
};
