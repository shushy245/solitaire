// A fresh 32-bit deal seed from the platform CSPRNG. Only the composition root calls this; everything
// downstream takes the seed as data, so deals stay reproducible in tests.
export const generateSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
