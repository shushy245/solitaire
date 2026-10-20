// Indexed access that throws instead of yielding `undefined` (noUncheckedIndexedAccess), so a test
// can assert on one element without an inline guard. Test-only; positional like Array.prototype.at.
export const at = <T>(items: readonly T[], index: number): T => {
    const item = items[index];

    if (item === undefined) throw new Error(`at: no element at index ${index} — length=${items.length}`);

    return item;
};
