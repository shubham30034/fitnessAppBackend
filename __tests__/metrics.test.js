const { recordRequestMetric, getRecentRequestMetrics } = require('../src/Utils/metrics');

describe('Metrics utils', () => {
  it('records and returns recent metrics', () => {
    recordRequestMetric({ method: 'GET', url: '/x', status: 200, durationMs: 12.3 });
    const items = getRecentRequestMetrics(5);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toHaveProperty('durationMs');
  });
});

