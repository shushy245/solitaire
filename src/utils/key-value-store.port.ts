// A string store keyed by name — localStorage in the app. Reads of a missing key are undefined; neither
// operation throws (an unavailable store reads as empty and drops writes).
export type KeyValueStore = {
    read: (key: string) => string | undefined;
    write: (args: { key: string; value: string }) => void;
};
