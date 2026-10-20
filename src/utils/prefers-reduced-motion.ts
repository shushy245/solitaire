// Wraps matchMedia once for the one preference the app reads; the composition root injects it.
export const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
