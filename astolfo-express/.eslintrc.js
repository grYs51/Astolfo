module.exports = {
  extends: ['airbnb-base', 'plugin:jest/recommended', 'prettier'],
  env: {
    node: true,
    jest: true,
  },
  overrides: [
    // only for ts files
    {
      files: ['*.ts'],
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      extends: ['airbnb-typescript/base', 'plugin:@typescript-eslint/recommended'],
      rules: {
        '@typescript-eslint/no-implied-eval': 'off', // Too slow
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
  rules: {
    'import/prefer-default-export': 'off',
    'no-plusplus': 'off',
    'no-restricted-syntax': [
      // Removed ForOfStatement
      'error',
      {
        selector: 'ForInStatement',
        message:
          'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],
    'import/no-cycle': 'off', // Too slow,
    'no-underscore-dangle': 'off',
  },
};
