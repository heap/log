module.exports = {
  env: {
      node: true
  },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended'
    ],
    globals: {},
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
    },
    plugins: [
        '@typescript-eslint',
        'import'
    ],
};
