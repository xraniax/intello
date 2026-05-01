import js from '@eslint/js';
import globals from 'globals';

/**
 * Root ESLint v9 flat config — shared baseline for all JS workspaces.
 * Each workspace (frontend, backend) can import and extend this config.
 */
export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'engine/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'eqeqeq': ['error', 'always'],
    },
  },
];
