const nx = require('@nx/eslint-plugin');

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          // config files require() these by relative path
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?js$',
            '^(\\.\\./)+package\\.json$',
            '^(\\.\\./)+libs/tailwind-preset/tailwind\\.config$',
          ],
          "depConstraints": [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:data-access', 'type:common']
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:data-access', 'type:common']
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:data-access', 'type:common']
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:data-access', 'type:common']
            }

            // Domain-based rules
            // {
            //   sourceTag: 'scope:orders',
            //   onlyDependOnLibsWithTags: ['scope:orders', 'scope:products', 'scope:shared']
            // },
            // {
            //   sourceTag: 'scope:products',
            //   onlyDependOnLibsWithTags: ['scope:products', 'scope:shared']
            // }
          ]
        }
      ]
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
          checkMissingDependencies: true,
          buildTargets: ['build']
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
];
