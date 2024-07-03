const eslintJS = require('./eslint/eslintrc.javascript');
const eslintTS = require('./eslint/eslintrc.typescript');

module.exports = {
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: ['**/*.json', 'eslint/**', 'node_modules', 'dist/**'],
  overrides: [
    {
      files: ['*.js'],
      ...eslintJS,
    },
    {
      files: ['*.ts'],
      ...eslintTS,
    },
  ],
};
