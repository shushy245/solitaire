// Wraps the Page Visibility API for the one question the app asks; the composition root injects it.
export const isPageVisible = (): boolean => document.visibilityState === 'visible';
