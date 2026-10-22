// A component a driver renders inside its providers to stand in for "elsewhere in the app": it keeps the latest value
// of one hook, so the test can call into the app the way another component would.
export type HookProbeModel<T> = {
    Probe: () => undefined;
    read: () => T;
};

// Rendered or not is its own state, so a hook that legitimately returns undefined still reads back.
type ProbedModel<T> = { isRendered: false } | { isRendered: true; value: T };

export const makeHookProbe = <T,>({ useValue, driver }: { useValue: () => T; driver: string }): HookProbeModel<T> => {
    const latest: { probed: ProbedModel<T> } = { probed: { isRendered: false } };

    const Probe = (): undefined => {
        latest.probed = { isRendered: true, value: useValue() };

        return undefined;
    };

    const read = (): T => {
        const { probed } = latest;

        if (!probed.isRendered) throw new Error(`${driver} driver: call when.created() first`);

        return probed.value;
    };

    return { Probe, read };
};
