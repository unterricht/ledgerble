module.exports = {
  testEnvironment: 'node',          // default; component tests opt in via docblock
  setupFilesAfterEnv: ['<rootDir>/test/setup-jsdom.js'],
  transform: { '^.+\\.(js|jsx)$': 'babel-jest' },
  testMatch: ['<rootDir>/test/**/*.test.js', '<rootDir>/test/**/*.test.jsx'],
};
