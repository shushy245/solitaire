import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            reporters: ['verbose'],
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            setupFiles: ['./src/testkit/setup.ts'],
            clearMocks: true,
            passWithNoTests: true,
        },
    }),
);
