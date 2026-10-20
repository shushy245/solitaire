import { createContext, useContext } from 'react';

// The player's motion preference, read when an animation is about to start. The composition root supplies the
// browser's (prefers-reduced-motion); tests supply a fixed answer.
const MotionContext = createContext<(() => boolean) | undefined>(undefined);

export const MotionProvider = ({
    prefersReducedMotion,
    children,
}: {
    prefersReducedMotion: () => boolean;
    children: React.ReactNode;
}): JSX.Element => <MotionContext.Provider value={prefersReducedMotion}>{children}</MotionContext.Provider>;

export const usePrefersReducedMotion = (): (() => boolean) => {
    const prefersReducedMotion = useContext(MotionContext);

    if (prefersReducedMotion === undefined)
        throw new Error('usePrefersReducedMotion: no MotionProvider above this component');

    return prefersReducedMotion;
};
