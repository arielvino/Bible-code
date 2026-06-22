import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import prettier from 'eslint-config-prettier';

export default [
    // Generated corpora and build artifacts are not hand-written source — skip them.
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'bible-wlc-text.js',
            'bible-wlc-index.js',
            'bible-wlc-verse-index.js',
            'hebrew-books/**',
        ],
    },

    js.configs.recommended,

    // Browser / worker source (app + search worker).
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser, ...globals.worker },
        },
        plugins: { 'react-hooks': reactHooks, react },
        rules: {
            // Count JSX references so components aren't flagged as unused vars.
            'react/jsx-uses-vars': 'error',
            'react/jsx-uses-react': 'error',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },

    // Node build config.
    {
        files: ['vite.config.js'],
        languageOptions: { globals: { ...globals.node } },
    },

    // CommonJS Node scripts.
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
    },

    // Keep ESLint out of Prettier's lane (disable stylistic rules).
    prettier,
];
