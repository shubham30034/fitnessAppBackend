const MAX_RECORDS = 200;

// In-memory ring buffer for recent request metrics
const recentRequests = [];

function recordRequestMetric(metric) {
  try {
    recentRequests.push({
      ts: new Date(),
      method: metric.method,
      url: metric.url,
      status: metric.status,
      durationMs: metric.durationMs,
    });
    if (recentRequests.length > MAX_RECORDS) {
      recentRequests.shift();
    }
  } catch (_) {
    // swallow
  }
}

function getRecentRequestMetrics(limit = 50) {
  const n = Math.max(1, Math.min(Number(limit) || 50, MAX_RECORDS));
  return recentRequests.slice(-n).reverse();
}

module.exports = {
  recordRequestMetric,
  getRecentRequestMetrics,
};

