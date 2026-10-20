// Solitaire ESLint flat config — extends the shared eslint-config-shalev and wires only the pieces
// the shared config leaves to the consumer: the import resolver, the type-aware rule block, and this
// project's seams.

import shalev, { pureFunctionTestSyntaxSelectors, typeAwareRules } from 'eslint-config-shalev';

export default [
    { ignores: ['dist/**', 'coverage/**'] },

    ...shalev,

    // ── Engine purity: src/engine is the functional core. It may not reach React, the app shell,
    //    the DOM, the clock or ambient randomness — randomness enters as a seed. This guard is the
    //    structural precondition for the test exemption below; don't drop one without the other.
    {
        files: ['src/engine/**/*.ts'],
        ignores: ['src/engine/**/*.test.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['react', 'react-*', '~/*', '../*', '!~/engine/*'],
                            message: 'src/engine is pure — it imports only its own modules (./) and pure libraries.',
                        },
                    ],
                },
            ],
            'no-restricted-globals': [
                'error',
                ...['window', 'document', 'navigator', 'globalThis', 'self', 'crypto', 'localStorage', 'sessionStorage'],
                ...['Date', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'fetch'],
            ],
            'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'src/engine is deterministic — take a seed.' }],
        },
    },

    // ── Engine tests: pure-function exemption from the expect() ban (adr-0004) — valid only while
    //    the purity guard above holds for src/engine.
    {
        files: ['src/engine/**/*.test.ts'],
        rules: {
            'no-restricted-syntax': ['error', ...pureFunctionTestSyntaxSelectors],
        },
    },

    // ── Boundary files: null is allowed (normalise at the seam) ───────────────────────────────
    //    The DOM lookup, and the in-memory fake of Web Storage, whose interface returns null.
    {
        files: ['src/utils/get-element-by-id.ts', 'src/testkit/fakes/memory-storage.ts'],
        rules: {
            'no-restricted-syntax': 'off',
        },
    },

    // ── Composition root: console allowed — the shared config's `**/main.ts` exemption, for this app's
    //    `main.tsx`. Only the Logger adapter speaks to the console; everything else logs through the port.
    {
        files: ['src/main.tsx'],
        rules: {
            'no-console': 'off',
        },
    },

    {
        settings: {
            'import/resolver': {
                typescript: { alwaysTryTypes: true, project: ['tsconfig.json'] },
                node: true,
            },
        },
    },

    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        rules: typeAwareRules,
    },
];
