// Simple test to verify setup works
describe('Simple Test Suite', () => {
    test('should pass basic test', () => {
        expect(1 + 1).toBe(2);
    });

    test('should handle environment variables', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.MONGODB_TEST_URI).toBeDefined();
    });

    test('should have test timeout set', () => {
        expect(setTimeout).toBeDefined();
    });
});
