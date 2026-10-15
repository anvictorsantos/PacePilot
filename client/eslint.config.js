import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import importPlugin from 'eslint-plugin-import'
import accessibilityPlugin from 'eslint-plugin-vuejs-accessibility'
import configPrettier from 'eslint-config-prettier'
import globals from 'globals'

const localPlugin = {
  rules: {
    'no-hardcoded-template-text': {
      meta: {
        type: 'problem',
        messages: { text: 'Raw template text "{{text}}" must be wrapped in $t(...).' },
      },
      create(context) {
        const allowed = new Set(['pacepilot'])
        return {
          VText(node) {
            const text = node.value || ''
            const trimmed = text.trim()
            if (!trimmed || /\{\{/.test(text)) return
            if (!/[a-zA-ZÀ-ÿ]{3,}/.test(trimmed)) return
            if (allowed.has(trimmed.toLowerCase())) return
            context.report({ node, messageId: 'text', data: { text: trimmed } })
          },
        }
      },
    },
  },
}

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
      local: localPlugin,
      'vuejs-accessibility': accessibilityPlugin,
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
      'local/no-hardcoded-template-text': 'error',
      'vuejs-accessibility/alt-text': 'error',
      'vuejs-accessibility/anchor-has-content': 'warn',
      'vuejs-accessibility/aria-props': 'error',
      'vuejs-accessibility/aria-role': 'error',
      'vuejs-accessibility/click-events-have-key-events': 'warn',
      'vuejs-accessibility/form-control-has-label': 'error',
      'vuejs-accessibility/iframe-has-title': 'error',
      'vuejs-accessibility/label-has-for': 'warn',
      'vuejs-accessibility/mouse-events-have-key-events': 'warn',
      'vuejs-accessibility/no-access-key': 'error',
      'vuejs-accessibility/no-autofocus': 'error',
      'vuejs-accessibility/no-distracting-elements': 'warn',
      'vuejs-accessibility/no-onchange': 'error',
      'vuejs-accessibility/no-redundant-roles': 'warn',
      'vuejs-accessibility/no-static-element-interactions': 'warn',
      'vuejs-accessibility/role-has-required-aria-props': 'error',
      'vuejs-accessibility/tabindex-no-positive': 'error',
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
