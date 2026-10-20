import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom cannot draw: it returns no context and logs "not implemented" each time. Return no context quietly,
// as a browser that cannot draw does — cypress/e2e/celebration.cy.ts checks the cascade really paints.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => undefined });

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // Drivers spy on window listeners; put the real ones back so spies never leak into the next test.
    vi.restoreAllMocks();
});
