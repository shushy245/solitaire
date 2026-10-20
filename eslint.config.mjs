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
                { patterns: [{ group: ['react', 'react-*', '~/app/*', '../app/*', '../../app/*'], message: 'src/engine is pure — no React or app-shell imports.' }] },
            ],
            'no-restricted-globals': ['error', 'window', 'document', 'crypto', 'localStorage', 'Date', 'performance'],
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
    {
        files: ['src/utils/get-element-by-id.ts'],
        rules: {
            'no-restricted-syntax': 'off',
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
