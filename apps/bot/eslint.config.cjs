const baseConfig = require('../../eslint.config.cjs');

module.exports = [
  ...baseConfig,
  {
    // Type-aware, so .ts only (the .cjs config isn't in a tsconfig)
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
];
