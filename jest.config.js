module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test-support/jest-native-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/supabase/'],
  testTimeout: 30000,
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', '!**/*.d.ts'],
  clearMocks: true,
};
