module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 120000,
  collectCoverageFrom: [
    'src/controllers/**/*.js',
    'src/middleware/**/*.js',
    'src/services/**/*.js',
    '!src/controllers/*Pdf*.js'
  ]
};
