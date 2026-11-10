// Plain ts-jest: the specs here cover pure helpers, not Angular components
export default {
  displayName: 'ui-admin',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../../coverage/features/admin/ui',
};
