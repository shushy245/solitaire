import { CSSProperties, ReactNode } from 'react';

import styles from './primitives.module.css';

// Layout primitives — flex only, no grid.
// These are the structural vocabulary: use them instead of raw <div> with layout styles.

type BoxProps = {
    children: ReactNode;
    className?: string | undefined;
    style?: CSSProperties | undefined;
    'data-testid'?: string | undefined;
};

export const Box = ({ children, className, style, 'data-testid': testId }: BoxProps): JSX.Element => (
    <div className={className} style={style} data-testid={testId}>
        {children}
    </div>
);

export const Row = ({ children, className, style, 'data-testid': testId }: BoxProps): JSX.Element => (
    <div className={`${styles.row} ${className ?? ''}`} style={style} data-testid={testId}>
        {children}
    </div>
);

export const Column = ({ children, className, style, 'data-testid': testId }: BoxProps): JSX.Element => (
    <div className={`${styles.column} ${className ?? ''}`} style={style} data-testid={testId}>
        {children}
    </div>
);

export const FullRow = ({ children, className, style, 'data-testid': testId }: BoxProps): JSX.Element => (
    <div className={`${styles.fullRow} ${className ?? ''}`} style={style} data-testid={testId}>
        {children}
    </div>
);

export const FullColumn = ({ children, className, style, 'data-testid': testId }: BoxProps): JSX.Element => (
    <div className={`${styles.fullColumn} ${className ?? ''}`} style={style} data-testid={testId}>
        {children}
    </div>
);

export const FullBox = ({ children, className, style, 'data-testid': testId }: BoxProps): JSX.Element => (
    <div className={`${styles.fullBox} ${className ?? ''}`} style={style} data-testid={testId}>
        {children}
    </div>
);
