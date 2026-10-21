import { useEffect, useRef } from 'react';

import { isHintShortcut } from '../hint/hint.utils.ts';

// H anywhere on the page asks for a hint. Like the undo shortcut, the listener reads the latest request through a
// ref, so it is attached once and removed on unmount.
export const useHintShortcut = (showHint: () => void): void => {
    const latestShowHint = useRef(showHint);

    useEffect(() => {
        latestShowHint.current = showHint;
    }, [showHint]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (!isHintShortcut(event)) return;

            event.preventDefault();
            latestShowHint.current();
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
};
