import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
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

// Rules that apply to both script-backed .ts modules and .vue components.
const importRules = {
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
}

const scriptLanguageOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
  globals: {
    ...globals.browser,
  },
}

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  // TypeScript modules. `vue-tsc --noEmit` (npm run typecheck) is the authority on
  // undefined identifiers and unused types, so the JS parser's view of them is off.
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ...scriptLanguageOptions,
      parser: tsParser,
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...importRules,
      'no-undef': 'off',
      // The JS parser cannot see type-level usage: it reads a TS enum member as
      // an unused variable and cannot tell a declaration-only parameter from an
      // unused one. tsconfig.app.json sets `noUnusedLocals` +
      // `noUnusedParameters`, and `npm run typecheck` enforces both, so the rule
      // is off for TS modules and stays on for `.vue` scripts (where the Vue
      // plugin supplies the template-usage information the parser lacks).
      'no-unused-vars': 'off',
    },
  },
  // Ambient declarations exist to be referenced from other modules, so the JS
  // parser never sees a usage for the names they introduce.
  {
    files: ['src/**/*.d.ts'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  // Build tooling runs under Node, not in the browser.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ...scriptLanguageOptions,
      globals: { ...globals.browser, ...globals.node },
    },
  },
  // Vue components: vue-eslint-parser owns the SFC, tsParser parses the
  // `<script setup lang="ts">` block, and the template rules live here.
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      ...scriptLanguageOptions,
      parserOptions: { parser: tsParser },
    },
    plugins: {
      import: importPlugin,
      local: localPlugin,
      'vuejs-accessibility': accessibilityPlugin,
    },
    rules: {
      ...importRules,
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
      'src/components/**/*.{ts,vue}',
      'src/layouts/**/*.{ts,vue}',
      'src/composables/**/*.{ts,vue}',
      'src/modules/**/*.{ts,vue}',
      'src/run-day/**/*.{ts,vue}',
      'src/services/**/*.{ts,vue}',
      'src/utils/**/*.{ts,vue}',
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
