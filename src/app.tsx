import { FullColumn } from './ui/box.tsx';
import { AppTestIds } from './app.utils.ts';
import { DrawMode } from './engine/index.ts';
import { Board } from './app/board/board.tsx';
import { GameProvider } from './app/game-provider.tsx';
import { makeSession } from './app/session/session.utils.ts';

import styles from './app.module.scss';
import tableStyles from './styles/table-metrics.module.scss';

export const App = ({ seedSource }: { seedSource: () => number }): JSX.Element => {
    const createInitialSession = () => makeSession({ seed: seedSource(), drawMode: DrawMode.One });

    return (
        <GameProvider createInitialSession={createInitialSession} seedSource={seedSource}>
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
