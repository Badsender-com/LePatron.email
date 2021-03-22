module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  globals: {
    tinymce: true,
  },
  extends: [
    'eslint:recommended',
    'standard',
    'plugin:vue/recommended',
    'prettier',
  ],
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['vue'],
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
    quotes: ['error', 'single'],
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
};
