import { FullColumn } from './ui/box.tsx';
import { AppTestIds } from './app.utils.ts';
import { DrawMode } from './engine/index.ts';
import { Board } from './app/board/board.tsx';
import { GameProvider } from './app/game-provider.tsx';
import { makeSession } from './app/session/session.utils.ts';

import styles from './app.module.scss';
import tableStyles from './styles/table-metrics.module.scss';

// firstSeed is decided once by the composition root: React may run the session initialiser twice
// (StrictMode), so it must not draw from seedSource itself.
export const App = ({
    firstSeed,
    seedSource,
    now,
}: {
    firstSeed: number;
    seedSource: () => number;
    now: () => number;
}): JSX.Element => {
    const createInitialSession = () => makeSession({ seed: firstSeed, drawMode: DrawMode.One });

    return (
        <GameProvider createInitialSession={createInitialSession} seedSource={seedSource} now={now}>
            <main className={styles.app}>
                <FullColumn className={tableStyles.metrics}>
                    <header className={tableStyles.tableWidth}>
                        <h1 className={styles.title} data-testid={AppTestIds.Title}>
                            {`Solitaire`}
                        </h1>
                    </header>
                    <Board />
                </FullColumn>
            </main>
        </GameProvider>
    );
};
