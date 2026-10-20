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
            // Stylesheets load blank in tests, except the palette, which the contrast test reads (global.scss?raw).
            css: { include: [/global\.scss/] },
            passWithNoTests: true,
        },
    }),
);
