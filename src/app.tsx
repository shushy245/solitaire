import { FullColumn } from './ui/box.tsx';
import { AppTestIds } from './app.utils.ts';

import styles from './app.module.scss';

export const App = (): JSX.Element => (
    <FullColumn className={styles.app}>
        <h1 className={styles.title} data-testid={AppTestIds.Title}>
            {`Solitaire`}
        </h1>
    </FullColumn>
);
