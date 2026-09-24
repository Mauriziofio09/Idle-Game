// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

/**
 * The engine (src/app/engine) must stay a pure, deterministic TypeScript module:
 * no Angular, no DOM, no wall clock, no unseeded randomness. These rules enforce
 * that mechanically instead of by convention. See PLAN.md, section 2.
 */
const ENGINE_FORBIDDEN_GLOBALS = [
  { name: 'Date', message: 'The engine counts ticks, never wall-clock time. Pass ticks in instead.' },
  { name: 'window', message: 'The engine must not touch the DOM.' },
  { name: 'document', message: 'The engine must not touch the DOM.' },
  { name: 'localStorage', message: 'Persistence belongs in game/save.ts.' },
  { name: 'performance', message: 'The engine counts ticks, never wall-clock time.' },
  { name: 'console', message: 'The engine returns domain events; the UI decides what to show.' },
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', '.angular/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/app/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', '@angular/**', 'rxjs', 'rxjs/*'],
              message:
                'The engine is framework-free. Angular and RxJS belong in src/app/game and src/app/ui.',
            },
            {
              group: ['../game/*', '../ui/*', '../content/*'],
              message: 'The engine must not depend on the UI layer. Return domain events instead.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...ENGINE_FORBIDDEN_GLOBALS],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded PRNG from engine/rng.ts so runs stay reproducible.',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
