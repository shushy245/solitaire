import { ReactNode } from 'react';

import { joinClassNames } from '../utils/join-class-names.ts';

import styles from './primitives.module.scss';

type BoxProps = {
    children: ReactNode;
    className?: string | undefined;
    'data-testid'?: string | undefined;
};

const makePrimitive =
    (baseClass: string | undefined) =>
    ({ children, className, 'data-testid': testId }: BoxProps): JSX.Element => (
        <div className={joinClassNames(baseClass, className)} data-testid={testId}>
            {children}
        </div>
    );

export const Box = makePrimitive(undefined);
export const Row = makePrimitive(styles.row);
export const Column = makePrimitive(styles.column);
export const FullRow = makePrimitive(styles.fullRow);
export const FullColumn = makePrimitive(styles.fullColumn);
export const FullBox = makePrimitive(styles.fullBox);
