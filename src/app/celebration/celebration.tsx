import { useCallback, useEffect, useId, useRef } from 'react';

import { GameStateModel, isWon } from '~/engine/index.ts';

import { useGame } from '../game-provider.tsx';
import { useFocusOnAppear } from '../use-focus-on-appear.ts';
import { CelebrationTestIds } from './celebration.test-ids.ts';
import { usePrefersReducedMotion } from '../motion/motion-provider.tsx';
import { useHandFocusToTableOnClose } from '../use-hand-focus-to-table.ts';
import { CascadeModel, isCascadeOver, makeCascade, stepCascade } from './cascade.utils.ts';
import { measureFoundationRect, paintCard, prepareCanvas, readCardPaint } from './cascade-canvas.ts';
import {
    cardsById,
    FittedCanvasModel,
    LaunchPlanKind,
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
    // (a new game, an undo, unmount) cancels the next frame. A resize re-fits the canvas to the new window.
    useEffect(() => {
        const canvas = canvasElement.current;
        const plan = planLaunches({ game, foundationRect: measureFoundationRect });

        if (canvas === undefined || plan.kind !== LaunchPlanKind.Ready) return undefined;

        const { cardSize } = plan;
        const cards = cardsById(game);
        const paint = readCardPaint();
        const fit = (): FittedCanvasModel => {
            const remeasured = planLaunches({ game, foundationRect: measureFoundationRect });
            const paintTop = remeasured.kind === LaunchPlanKind.Ready ? remeasured.paintTop : plan.paintTop;
            const bounds = viewportBounds({ width: window.innerWidth, height: window.innerHeight, cardSize });

            return { bounds, context: prepareCanvas({ canvas, bounds, paintTop }) };
        };
        const loop: {
            cascade: CascadeModel;
            lastFrameAt: number | undefined;
            frame: number;
            fitted: FittedCanvasModel;
        } = {
            cascade: makeCascade({ launches: plan.launches, seed: game.seed }),
            lastFrameAt: undefined,
            frame: 0,
            fitted: fit(),
        };

        const handleFrame = (frameAt: number): void => {
            const dtMs = loop.lastFrameAt === undefined ? 0 : frameAt - loop.lastFrameAt;
            const { bounds, context } = loop.fitted;
            loop.lastFrameAt = frameAt;
            loop.cascade = stepCascade({ cascade: loop.cascade, dtMs, bounds });

            if (context !== undefined) {
                loop.cascade.flying.forEach(({ cardId, x, y }) => {
                    const card = cards.get(cardId);

                    if (card === undefined) return;

                    paintCard({ context, card, at: { left: x, top: y, ...cardSize }, paint });
                });
            }

            if (!isCascadeOver(loop.cascade)) loop.frame = window.requestAnimationFrame(handleFrame);
        };

        const handleResize = (): void => {
            loop.fitted = fit();
        };

        loop.frame = window.requestAnimationFrame(handleFrame);
        window.addEventListener('resize', handleResize);

        return () => {
            window.cancelAnimationFrame(loop.frame);
            window.removeEventListener('resize', handleResize);
        };
    }, [game]);

    return (
        <canvas ref={handleCanvasRef} aria-hidden className={styles.cascade} data-testid={CelebrationTestIds.Cascade} />
    );
};

const WinOverlay = ({ elapsedMs, score, onNewGame }: WinOverlayProps): JSX.Element => {
    const titleId = useId();
    // The win takes focus, so a keyboard player can deal again straight away.
    const handleNewGameRef = useFocusOnAppear<HTMLButtonElement>();
    useHandFocusToTableOnClose();

    return (
        <section aria-labelledby={titleId} className={styles.overlay} data-testid={CelebrationTestIds.Overlay}>
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
