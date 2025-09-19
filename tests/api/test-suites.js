/**
 * API Test Suites
 * Comprehensive test cases for all Web-Scan API endpoints
 */

// Test URLs for different scenarios
const testUrls = {
  valid: 'example.com',
  https: 'https://example.com',
  complex: 'github.com',
  slow: 'httpbin.org/delay/2', // Intentionally slow for timeout testing
  invalid: 'invalid-domain-that-should-not-exist.com'
};

/**
 * Security API Test Suite
 */
export const securityTestSuite = {
  name: 'Security APIs',
  tests: [
    {
      name: 'SSL Certificate Analysis - Valid Domain',
      endpoint: '/api/security/ssl',
      params: { url: testUrls.https },
      expected: {
        statusCode: 200,
        maxResponseTime: 10000,
        requiredFields: ['subject', 'issuer', 'valid_from', 'valid_to'],
        responseType: 'object'
      }
    },
    {
      name: 'SSL Certificate Analysis - Plain Domain',
      endpoint: '/api/security/ssl',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 10000,
        responseType: 'object'
      }
    },
    {
      name: 'Security Headers Analysis',
      endpoint: '/api/security/headers',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 8000,
        responseType: 'object'
      }
    },
    {
      name: 'TLS Analysis - Comprehensive',
      endpoint: '/api/security/tls',
      params: { url: testUrls.https },
      expected: {
        statusCode: 200,
        maxResponseTime: 20000, // TLS analysis can be slow
        requiredFields: ['domain', 'timestamp'],
        responseType: 'object'
      }
    },
    {
      name: 'Firewall Detection',
      endpoint: '/api/security/firewall',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 15000,
        requiredFields: ['url', 'firewall'],
        responseType: 'object'
      }
    },
    {
      name: 'HSTS Analysis',
      endpoint: '/api/security/hsts',
      params: { url: testUrls.https },
      expected: {
        statusCode: 200,
        maxResponseTime: 8000,
        responseType: 'object'
      }
    },
    {
      name: 'Threats Analysis',
      endpoint: '/api/security/threats',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 12000,
        responseType: 'object'
      }
    }
  ]
};

/**
 * Network API Test Suite
 */
export const networkTestSuite = {
  name: 'Network APIs',
  tests: [
    {
      name: 'DNS Lookup - Comprehensive',
      endpoint: '/api/network/dns',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 8000,
        requiredFields: ['A', 'AAAA', 'MX', 'TXT', 'NS'],
        responseType: 'object'
      }
    },
    {
      name: 'DNS Lookup - Complex Domain',
      endpoint: '/api/network/dns',
      params: { url: testUrls.complex },
      expected: {
        statusCode: 200,
        maxResponseTime: 10000,
        responseType: 'object'
      }
    },
    {
      name: 'Port Scanning',
      endpoint: '/api/network/ports',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 15000,
        requiredFields: ['openPorts', 'failedPorts'],
        responseType: 'object'
      }
    },
    {
      name: 'IP Address Lookup',
      endpoint: '/api/network/get-ip',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 5000,
        responseType: 'object'
      }
    },
    {
      name: 'Trace Route Analysis',
      endpoint: '/api/network/trace-route',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 30000, // Traceroute can be very slow
        responseType: 'object'
      }
    }
  ]
};

/**
 * AI API Test Suite
 */
export const aiTestSuite = {
  name: 'AI APIs',
  tests: [
    {
      name: 'Basic AI Analysis',
      endpoint: '/api/test-ai',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 15000,
        responseType: 'object'
      }
    },
    {
      name: 'AI Vulnerability Analysis',
      endpoint: '/api/ai-vulnerability-analysis',
      params: { url: testUrls.https },
      expected: {
        statusCode: 200,
        maxResponseTime: 25000, // AI analysis can be slow
        responseType: 'object'
      }
    },
    {
      name: 'AI Monitoring Insights',
      endpoint: '/api/ai-monitoring-insights',
      params: { configId: '1' },
      expected: {
        statusCode: 200,
        maxResponseTime: 10000,
        requiredFields: ['success', 'configId', 'aiInsights'],
        responseType: 'object'
      }
    }
  ]
};

/**
 * Analysis API Test Suite
 */
export const analysisTestSuite = {
  name: 'Analysis APIs',
  tests: [
    {
      name: 'Website Quality Analysis',
      endpoint: '/api/analysis/quality',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 15000,
        responseType: 'object'
      }
    },
    {
      name: 'Domain Ranking',
      endpoint: '/api/analysis/rank',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 10000,
        responseType: 'object'
      }
    },
    {
      name: 'Legacy Ranking',
      endpoint: '/api/analysis/legacy-rank',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 12000,
        responseType: 'object'
      }
    },
    {
      name: 'Technology Stack Analysis',
      endpoint: '/api/analysis/tech-stack',
      params: { url: testUrls.https },
      expected: {
        statusCode: 200,
        maxResponseTime: 20000,
        responseType: 'object'
      }
    }
  ]
};

/**
 * Utilities API Test Suite
 */
export const utilitiesTestSuite = {
  name: 'Utilities APIs',
  tests: [
    {
      name: 'Cookie Analysis',
      endpoint: '/api/utils/cookies',
      params: { url: testUrls.https },
      expected: {
        statusCode: 200,
        maxResponseTime: 25000, // Puppeteer can be slow
        responseType: 'object'
      }
    },
    {
      name: 'Redirect Tracing',
      endpoint: '/api/utils/redirects',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 10000,
        requiredFields: ['redirects'],
        responseType: 'object'
      }
    }
  ]
};

/**
 * Error Handling Test Suite
 */
export const errorTestSuite = {
  name: 'Error Handling',
  tests: [
    {
      name: 'Missing URL Parameter',
      endpoint: '/api/security/ssl',
      params: {},
      expected: {
        statusCode: 500,
        maxResponseTime: 2000,
        responseType: 'object'
      }
    },
    {
      name: 'Invalid Domain',
      endpoint: '/api/network/dns',
      params: { url: testUrls.invalid },
      expected: {
        statusCode: 500,
        maxResponseTime: 10000,
        responseType: 'object'
      }
    },
    {
      name: 'Rate Limit Testing - AI Endpoint',
      endpoint: '/api/test-ai',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200, // First request should succeed
        maxResponseTime: 15000,
        responseType: 'object'
      }
    }
  ]
};

/**
 * Performance Test Suite
 */
export const performanceTestSuite = {
  name: 'Performance Tests',
  tests: [
    {
      name: 'Fast Response - Health Check',
      endpoint: '/health',
      params: {},
      expected: {
        statusCode: 200,
        maxResponseTime: 1000,
        requiredFields: ['status', 'timestamp'],
        responseType: 'object'
      }
    },
    {
      name: 'Cached Response - DNS',
      endpoint: '/api/network/dns',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 8000,
        responseType: 'object'
      }
    },
    {
      name: 'Concurrent Request Handling',
      endpoint: '/api/security/headers',
      params: { url: testUrls.valid },
      expected: {
        statusCode: 200,
        maxResponseTime: 10000,
        responseType: 'object'
      }
    }
  ]
};

/**
 * All test suites
 */
export const allTestSuites = [
  securityTestSuite,
  networkTestSuite,
  aiTestSuite,
  analysisTestSuite,
  utilitiesTestSuite,
  errorTestSuite,
  performanceTestSuite
];

export default allTestSuites;
