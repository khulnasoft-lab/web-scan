/**
 * Comprehensive API Testing Framework
 * Automated testing suite for Web-Scan API endpoints
 */

import axios from 'axios';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Test configuration
const config = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
  testUrls: [
    'example.com',
    'google.com',
    'github.com',
    'stackoverflow.com'
  ],
  maxConcurrentTests: 5,
  retryAttempts: 3
};

// Test results storage
let testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    startTime: null,
    endTime: null,
    duration: 0
  },
  endpoints: {},
  performance: {
    averageResponseTime: 0,
    slowestEndpoint: null,
    fastestEndpoint: null
  },
  errors: []
};

/**
 * Test runner class
 */
class APITestRunner {
  constructor(baseURL = config.baseURL) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: config.timeout,
      validateStatus: () => true // Don't throw on HTTP errors
    });
  }

  /**
   * Run a single test
   */
  async runTest(testCase) {
    const startTime = performance.now();
    
    try {
      console.log(`🧪 Testing: ${testCase.name}`);
      
      const response = await this.client.request({
        method: testCase.method || 'GET',
        url: testCase.endpoint,
        params: testCase.params,
        data: testCase.data,
        headers: testCase.headers
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Validate response
      const validationResult = this.validateResponse(response, testCase.expected, responseTime);
      
      const result = {
        name: testCase.name,
        endpoint: testCase.endpoint,
        method: testCase.method || 'GET',
        status: validationResult.passed ? 'PASSED' : 'FAILED',
        responseTime: Math.round(responseTime),
        statusCode: response.status,
        responseSize: JSON.stringify(response.data).length,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        timestamp: new Date().toISOString()
      };

      // Update statistics
      testResults.summary.total++;
      if (result.status === 'PASSED') {
        testResults.summary.passed++;
        console.log(`✅ ${testCase.name} - ${responseTime.toFixed(2)}ms`);
      } else {
        testResults.summary.failed++;
        console.log(`❌ ${testCase.name} - ${result.errors.join(', ')}`);
      }

      return result;

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      testResults.summary.total++;
      testResults.summary.failed++;
      testResults.errors.push({
        test: testCase.name,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      console.log(`💥 ${testCase.name} - ERROR: ${error.message}`);

      return {
        name: testCase.name,
        endpoint: testCase.endpoint,
        method: testCase.method || 'GET',
        status: 'FAILED',
        responseTime: Math.round(responseTime),
        statusCode: null,
        responseSize: 0,
        errors: [error.message],
        warnings: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate API response
   */
  validateResponse(response, expected, responseTime) {
    const errors = [];
    const warnings = [];

    // Check status code
    if (expected.statusCode && response.status !== expected.statusCode) {
      errors.push(`Expected status ${expected.statusCode}, got ${response.status}`);
    }

    // Check response time
    if (expected.maxResponseTime && responseTime > expected.maxResponseTime) {
      errors.push(`Response time ${responseTime.toFixed(2)}ms exceeds limit ${expected.maxResponseTime}ms`);
    }

    // Warn on slow responses
    if (responseTime > 5000) {
      warnings.push(`Slow response: ${responseTime.toFixed(2)}ms`);
    }

    // Check required fields
    if (expected.requiredFields && response.data) {
      expected.requiredFields.forEach(field => {
        if (!(field in response.data)) {
          errors.push(`Missing required field: ${field}`);
        }
      });
    }

    // Check response structure
    if (expected.responseType) {
      const actualType = Array.isArray(response.data) ? 'array' : typeof response.data;
      if (actualType !== expected.responseType) {
        errors.push(`Expected ${expected.responseType}, got ${actualType}`);
      }
    }

    // Check for error responses
    if (response.data && response.data.error && expected.statusCode === 200) {
      errors.push(`API returned error: ${response.data.error}`);
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Run all tests
   */
  async runAllTests(testSuites) {
    console.log('🚀 Starting API Test Suite...\n');
    testResults.summary.startTime = new Date().toISOString();

    const allTests = [];
    testSuites.forEach(suite => {
      suite.tests.forEach(test => {
        allTests.push({ ...test, suite: suite.name });
      });
    });

    // Run tests with concurrency control
    const results = [];
    for (let i = 0; i < allTests.length; i += config.maxConcurrentTests) {
      const batch = allTests.slice(i, i + config.maxConcurrentTests);
      const batchResults = await Promise.all(
        batch.map(test => this.runTest(test))
      );
      results.push(...batchResults);
    }

    testResults.summary.endTime = new Date().toISOString();
    testResults.summary.duration = Date.now() - new Date(testResults.summary.startTime).getTime();

    // Calculate performance metrics
    this.calculatePerformanceMetrics(results);

    // Group results by endpoint
    results.forEach(result => {
      if (!testResults.endpoints[result.endpoint]) {
        testResults.endpoints[result.endpoint] = [];
      }
      testResults.endpoints[result.endpoint].push(result);
    });

    return testResults;
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics(results) {
    const responseTimes = results.map(r => r.responseTime);
    testResults.performance.averageResponseTime = 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    const slowest = results.reduce((prev, current) => 
      (prev.responseTime > current.responseTime) ? prev : current
    );
    const fastest = results.reduce((prev, current) => 
      (prev.responseTime < current.responseTime) ? prev : current
    );

    testResults.performance.slowestEndpoint = {
      name: slowest.name,
      endpoint: slowest.endpoint,
      responseTime: slowest.responseTime
    };

    testResults.performance.fastestEndpoint = {
      name: fastest.name,
      endpoint: fastest.endpoint,
      responseTime: fastest.responseTime
    };
  }

  /**
   * Generate test report
   */
  generateReport() {
    const passRate = (testResults.summary.passed / testResults.summary.total * 100).toFixed(2);
    
    const report = `
# 🧪 API Test Report

**Generated:** ${new Date().toISOString()}
**Duration:** ${(testResults.summary.duration / 1000).toFixed(2)}s
**Base URL:** ${this.baseURL}

## 📊 Summary
- **Total Tests:** ${testResults.summary.total}
- **Passed:** ${testResults.summary.passed} ✅
- **Failed:** ${testResults.summary.failed} ❌
- **Pass Rate:** ${passRate}%

## ⚡ Performance
- **Average Response Time:** ${testResults.performance.averageResponseTime.toFixed(2)}ms
- **Fastest Endpoint:** ${testResults.performance.fastestEndpoint?.name} (${testResults.performance.fastestEndpoint?.responseTime}ms)
- **Slowest Endpoint:** ${testResults.performance.slowestEndpoint?.name} (${testResults.performance.slowestEndpoint?.responseTime}ms)

## 📋 Test Results by Endpoint

${Object.entries(testResults.endpoints).map(([endpoint, tests]) => {
  const passed = tests.filter(t => t.status === 'PASSED').length;
  const total = tests.length;
  const avgTime = (tests.reduce((sum, t) => sum + t.responseTime, 0) / total).toFixed(2);
  
  return `### ${endpoint}
- **Tests:** ${total}
- **Passed:** ${passed}/${total}
- **Average Response Time:** ${avgTime}ms

${tests.map(test => 
  `- ${test.status === 'PASSED' ? '✅' : '❌'} ${test.name} (${test.responseTime}ms)`
).join('\n')}
`;
}).join('\n')}

${testResults.errors.length > 0 ? `
## ❌ Errors
${testResults.errors.map(error => 
  `- **${error.test}:** ${error.error}`
).join('\n')}
` : ''}

---
*Generated by Web-Scan API Test Framework*
`;

    return report;
  }

  /**
   * Save test results
   */
  async saveResults(outputDir = './test-results') {
    try {
      await fs.mkdir(outputDir, { recursive: true });
      
      // Save JSON results
      await fs.writeFile(
        path.join(outputDir, 'test-results.json'),
        JSON.stringify(testResults, null, 2)
      );

      // Save markdown report
      const report = this.generateReport();
      await fs.writeFile(
        path.join(outputDir, 'test-report.md'),
        report
      );

      console.log(`\n📄 Test results saved to ${outputDir}/`);
      console.log(`📊 JSON: test-results.json`);
      console.log(`📝 Report: test-report.md`);

    } catch (error) {
      console.error('❌ Failed to save test results:', error);
    }
  }
}

export { APITestRunner, config, testResults };
export default APITestRunner;
