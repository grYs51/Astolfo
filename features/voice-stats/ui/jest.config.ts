// Plain ts-jest: the specs here cover pure helpers, not Angular components
export default {
  displayName: 'ui-voice-stats',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../../coverage/features/voice-stats/ui',
};
