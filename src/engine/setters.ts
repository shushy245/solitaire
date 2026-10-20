// Immutable pile-list update: a new list with index i replaced, the input untouched.
export const replaceAt = <T>({ items, index, value }: { items: readonly T[]; index: number; value: T }): T[] =>
    items.map((item, i) => (i === index ? value : item));
