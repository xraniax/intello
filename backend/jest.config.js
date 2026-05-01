export default {
    testEnvironment: 'node',
    transform: {},
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    clearMocks: true,
    testMatch: [
        '<rootDir>/src/tests/**/*.test.js',
        '<rootDir>/tests/**/*.test.js',
    ],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/server.js',
        '!src/utils/config/db.js',
        '!src/utils/validateEnv.js',
        '!src/utils/config/passport.js',
        '!src/**/__mocks__/**',
    ],
    coverageThreshold: {
        global: {
            statements: 70,
            branches: 65,
            functions: 70,
            lines: 70,
        },
    },
    coverageReporters: ['text', 'lcov', 'html'],
    coverageDirectory: 'coverage',
    testTimeout: 10000,
};
