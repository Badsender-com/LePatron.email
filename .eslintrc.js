module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  globals: {
    tinymce: true,
  },
  extends: [
    'eslint:recommended',
    'standard',
    'plugin:vue/recommended',
    'prettier',
    // Prettier owns formatting, including inside <template>. Without this the
    // Vue formatting rules of plugin:vue/recommended fight it, and the winner
    // depends on which tool ran last: lint-staged runs prettier then eslint
    // --fix, `yarn code:fix` runs them the other way round.
    'prettier/vue',
    'plugin:cypress/recommended',
  ],
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['vue', 'cypress'],
  rules: {
    'import/no-named-default': 'off',
    'vue/max-attributes-per-line': 'off',
    'no-var': 'error',
    'vue/valid-v-slot': [
      'error',
      {
        allowModifiers: true,
      },
    ],
    // avoidEscape lets a string containing an apostrophe use double quotes
    // instead of escaping — which is what Prettier emits. Without it the two
    // tools disagree on every such string, French ones in particular.
    quotes: ['error', 'single', { avoidEscape: true }],
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
};
