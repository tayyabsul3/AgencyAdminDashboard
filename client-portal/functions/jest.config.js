module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/lib/**/__tests__/**/*.test.js',
    '<rootDir>/api/**/__tests__/**/*.test.js',
    '<rootDir>/**/*.test.js'
  ],
  collectCoverageFrom: [
    'lib/**/*.js',
    'api/**/*.js',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  verbose: true,
  testTimeout: 10000
};