import { Hud } from './app/hud/hud.tsx';
import { FullColumn } from './ui/box.tsx';
import { AppTestIds } from './app.utils.ts';
import { Board } from './app/board/board.tsx';
import { GameProvider } from './app/game-provider.tsx';
import { GameOver } from './app/game-over/game-over.tsx';
import { HintProvider } from './app/hint/hint-provider.tsx';
import { joinClassNames } from './utils/join-class-names.ts';
import { SoundEffects } from './app/sound/sound-effects.tsx';
import { SessionModel } from './app/session/session.utils.ts';
import { Celebration } from './app/celebration/celebration.tsx';

import styles from './app.module.scss';
import tableStyles from './styles/table-metrics.module.scss';

// The first session (resumed or freshly dealt) is decided once by the composition root: React may run the
// session initialiser twice (StrictMode), so it must not load or draw a seed itself.
export const App = ({
    initialSession,
    saveSession,
    seedSource,
    now,
}: {
    initialSession: SessionModel;
    saveSession: (session: SessionModel) => void;
    seedSource: () => number;
    now: () => number;
}): JSX.Element => {
    const createInitialSession = (): SessionModel => initialSession;

    return (
        <GameProvider
            createInitialSession={createInitialSession}
            seedSource={seedSource}
            now={now}
            saveSession={saveSession}
        >
            <HintProvider>
                <main className={styles.app}>
                    <FullColumn className={tableStyles.metrics}>
                        <header className={joinClassNames(tableStyles.tableWidth, styles.header)}>
                            <h1 className={styles.title} data-testid={AppTestIds.Title}>
                                {`Solitaire`}
                            </h1>
                            <Hud />
                        </header>
                        <Board />
                        <Celebration />
                        <GameOver />
                        <SoundEffects />
                    </FullColumn>
                </main>
            </HintProvider>
        </GameProvider>
    );
};
