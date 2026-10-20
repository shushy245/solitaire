import { useEffect, useRef } from 'react';

import { isUndoShortcut } from './hud.utils.ts';

// Ctrl/Cmd+Z anywhere on the page undoes. The listener reads the latest undo through a ref, so it is
// attached once and removed on unmount.
export const useUndoShortcut = (undo: () => void): void => {
    const latestUndo = useRef(undo);

    useEffect(() => {
        latestUndo.current = undo;
    }, [undo]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (!isUndoShortcut(event)) return;

            event.preventDefault();
            latestUndo.current();
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
};
