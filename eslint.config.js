import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import sveltePlugin from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/e2e/**',
      '**/tools/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.node, ...globals.es2024 },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
      'no-constant-condition': 'off',
    },
  },
  ...sveltePlugin.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: tsParser },
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'svelte/no-at-html-tags': 'off',
      'svelte/valid-compile': 'off',
      'svelte/no-unused-svelte-ignore': 'off',
    },
  },
];