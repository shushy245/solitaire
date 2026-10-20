// Solitaire ESLint flat config — extends the shared eslint-config-shalev and wires only the pieces
// the shared config leaves to the consumer: the import resolver, the type-aware rule block, and this
// project's seams.

import shalev, { typeAwareRules } from 'eslint-config-shalev';

export default [
    { ignores: ['dist/**', 'coverage/**'] },

    ...shalev,

    // ── Boundary files: null is allowed (normalise at the seam) ───────────────────────────────
    {
        files: ['**/main.tsx', '**/cypress.config.ts'],
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
