module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/data/**/*.ts',
    'src/lib/**/*.ts',
    '!src/data/db/opsqlite.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    // The money and tax engine must stay fully tested.
    './src/domain/': { lines: 100, functions: 100, statements: 100, branches: 95 },
  },
};
