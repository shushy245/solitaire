// Stand-ins for the composition root's seed source and clock, shared by every driver that mounts a GameProvider.

export const fixedSeed = (): number => 1;

// Fake timers fake Date too, so the provider's clock advances with the fake clock.
export const fakeNow = (): number => Date.now();
