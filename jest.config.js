module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Test file patterns
    testMatch: [
        '**/test/**/*.test.js',
        '**/__tests__/**/*.js'
    ],
    
    // Test setup files
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/test/',
        '/coverage/',
        '/uploads/',
        '/logs/'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // Test timeout
    testTimeout: 30000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Restore mocks between tests
    restoreMocks: true,
    
    // Module file extensions
    moduleFileExtensions: ['js', 'json'],
    
    // Transform configuration
    transform: {},
    
    // Module name mapping
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    
    // Test path ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/build/'
    ],
    
    // Global test setup
    globalSetup: '<rootDir>/test/globalSetup.js',
    globalTeardown: '<rootDir>/test/globalTeardown.js',
    
    // Environment variables for tests
    setupFiles: ['<rootDir>/test/env.js'],
    
    // Maximum workers
    maxWorkers: 1,
    
    // Force exit after tests
    forceExit: true,
    
    // Detect open handles
    detectOpenHandles: true,
    
    // Run tests in band
    maxWorkers: 1
};
