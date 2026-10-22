// A component a driver renders inside its providers to stand in for "elsewhere in the app": it keeps the latest value
// of one hook, so the test can call into the app the way another component would.
export type HookProbeModel<T> = {
    Probe: () => undefined;
    read: () => T;
};

export const makeHookProbe = <T,>({ useValue, driver }: { useValue: () => T; driver: string }): HookProbeModel<T> => {
    const latest: { value: T | undefined } = { value: undefined };

    const Probe = (): undefined => {
        latest.value = useValue();

        return undefined;
    };

    const read = (): T => {
        if (latest.value === undefined) throw new Error(`${driver} driver: call when.created() first`);

        return latest.value;
    };

    return { Probe, read };
};
