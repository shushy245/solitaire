import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '~': path.resolve(import.meta.dirname, 'src'),
        },
    },
    test: {
        reporters: ['verbose'],
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}'],
        setupFiles: ['./src/testkit/setup.ts'],
        clearMocks: true,
        passWithNoTests: true,
    },
});
