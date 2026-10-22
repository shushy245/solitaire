import { useEffect } from 'react';

import { TABLE_FOCUS_ID } from './board/board.utils.ts';
import { getElementById } from '../utils/get-element-by-id.ts';

// Removing the focused element hands focus back to the page itself.
export const isFocusLost = (): boolean => document.activeElement === document.body;

// A panel that goes away with focus inside it would drop focus to the page, and Tab would start again from the top;
// focus is handed to the table instead. Focus the player moved elsewhere stays where it is.
export const useHandFocusToTableOnClose = (): void => {
    useEffect(
        () => () => {
            const table = getElementById(TABLE_FOCUS_ID);

            if (table !== undefined && isFocusLost()) table.focus();
        },
        [],
    );
};
