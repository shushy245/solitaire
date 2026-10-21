import { useCallback, useEffect, useRef } from 'react';

// The element given the returned ref takes focus once, when the component appears, so a keyboard player can act on
// what just appeared straight away. Later renders never move focus, even if the ref moves to another element.
export const useFocusOnAppear = <T extends HTMLElement>(): React.RefCallback<T> => {
    const target = useRef<T | undefined>(undefined);

    // React hands refs null on unmount; undefined means "not mounted".
    const handleRef: React.RefCallback<T> = useCallback((element) => {
        target.current = element ?? undefined;
    }, []);

    useEffect(() => {
        const element = target.current;

        if (element !== undefined) element.focus();
    }, []);

    return handleRef;
};
