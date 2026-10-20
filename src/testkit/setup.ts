import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // Drivers spy on window listeners; put the real ones back so spies never leak into the next test.
    vi.restoreAllMocks();
});
