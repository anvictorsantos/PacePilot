import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import importPlugin from 'eslint-plugin-import'
import configPrettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.js', 'src/**/*.vue'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: [],
          distinctGroup: true,
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
        },
      ],
      // Vue essentials that silence common single-word component warnings
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: [
      'src/components/**/*.{js,vue}',
      'src/layouts/**/*.{js,vue}',
      'src/composables/**/*.{js,vue}',
      'src/services/**/*.{js,vue}',
      'src/utils/**/*.{js,vue}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/features/**'],
              message:
                'Shared/infra modules must not depend on feature code; use shared services or components instead.',
            },
          ],
        },
      ],
    },
  },
  configPrettier,
]
