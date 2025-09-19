#!/usr/bin/env node

/**
 * API Test Runner
 * Main script to run comprehensive API tests
 */

import { APITestRunner } from './api/api-test-framework.js';
import { allTestSuites } from './api/test-suites.js';
import { performance } from 'perf_hooks';

// Configuration
const config = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
  outputDir: './test-results',
  runPerformanceBenchmarks: true,
  generateReport: true,
  exitOnFailure: false
};

/**
 * Performance benchmark tests
 */
async function runPerformanceBenchmarks(testRunner) {
  console.log('\n🏃‍♂️ Running Performance Benchmarks...\n');
  
  const benchmarks = [
    {
      name: 'Concurrent DNS Requests',
      endpoint: '/api/network/dns',
      params: { url: 'example.com' },
      concurrency: 10,
      iterations: 5
    },
    {
      name: 'Cache Performance Test',
      endpoint: '/api/security/ssl',
      params: { url: 'example.com' },
      concurrency: 5,
      iterations: 10 // Should hit cache after first request
    },
    {
      name: 'AI Endpoint Load Test',
      endpoint: '/api/test-ai',
      params: { url: 'example.com' },
      concurrency: 3,
      iterations: 3 // Limited due to rate limiting
    }
  ];

  const benchmarkResults = [];

  for (const benchmark of benchmarks) {
    console.log(`📊 Running: ${benchmark.name}`);
    const startTime = performance.now();
    
    const promises = [];
    for (let i = 0; i < benchmark.iterations; i++) {
      const batchPromises = [];
      for (let j = 0; j < benchmark.concurrency; j++) {
        batchPromises.push(
          testRunner.client.get(benchmark.endpoint, { params: benchmark.params })
            .catch(err => ({ error: err.message }))
        );
      }
      promises.push(Promise.all(batchPromises));
      
      // Small delay between batches to avoid overwhelming the server
      if (i < benchmark.iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const totalRequests = benchmark.concurrency * benchmark.iterations;
    const totalTime = endTime - startTime;
    const avgResponseTime = totalTime / totalRequests;
    
    // Count successful requests
    let successfulRequests = 0;
    let errors = 0;
    
    results.flat().forEach(result => {
      if (result.error || (result.status && result.status >= 400)) {
        errors++;
      } else {
        successfulRequests++;
      }
    });

    const successRate = (successfulRequests / totalRequests * 100).toFixed(2);
    
    benchmarkResults.push({
      name: benchmark.name,
      totalRequests,
      successfulRequests,
      errors,
      successRate: `${successRate}%`,
      totalTime: `${totalTime.toFixed(2)}ms`,
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      requestsPerSecond: (totalRequests / (totalTime / 1000)).toFixed(2)
    });

    console.log(`   ✅ ${successfulRequests}/${totalRequests} successful (${successRate}%)`);
    console.log(`   ⚡ Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   🚀 RPS: ${(totalRequests / (totalTime / 1000)).toFixed(2)}\n`);
  }

  return benchmarkResults;
}

/**
 * Main test execution
 */
async function main() {
  console.log('🧪 Web-Scan API Test Suite');
  console.log('============================\n');
  console.log(`🎯 Target: ${config.baseURL}`);
  console.log(`📊 Test Suites: ${allTestSuites.length}`);
  console.log(`🔬 Total Tests: ${allTestSuites.reduce((sum, suite) => sum + suite.tests.length, 0)}\n`);

  const testRunner = new APITestRunner(config.baseURL);
  
  try {
    // Check if server is running
    console.log('🔍 Checking server availability...');
    await testRunner.client.get('/health');
    console.log('✅ Server is running\n');
  } catch (error) {
    console.error('❌ Server is not accessible:', error.message);
    console.error('💡 Make sure the API server is running on', config.baseURL);
    process.exit(1);
  }

  let allResults;
  let benchmarkResults = [];

  try {
    // Run main test suites
    allResults = await testRunner.runAllTests(allTestSuites);

    // Run performance benchmarks if enabled
    if (config.runPerformanceBenchmarks) {
      benchmarkResults = await runPerformanceBenchmarks(testRunner);
    }

    // Generate and save reports
    if (config.generateReport) {
      await testRunner.saveResults(config.outputDir);
      
      // Save benchmark results
      if (benchmarkResults.length > 0) {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        await fs.writeFile(
          path.join(config.outputDir, 'benchmark-results.json'),
          JSON.stringify(benchmarkResults, null, 2)
        );
        
        console.log('🏃‍♂️ Benchmark results saved to benchmark-results.json');
      }
    }

    // Print summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Passed: ${allResults.summary.passed}`);
    console.log(`❌ Failed: ${allResults.summary.failed}`);
    console.log(`📈 Pass Rate: ${(allResults.summary.passed / allResults.summary.total * 100).toFixed(2)}%`);
    console.log(`⏱️  Duration: ${(allResults.summary.duration / 1000).toFixed(2)}s`);
    console.log(`⚡ Avg Response: ${allResults.performance.averageResponseTime.toFixed(2)}ms`);

    if (benchmarkResults.length > 0) {
      console.log('\n🏃‍♂️ Performance Benchmarks');
      console.log('==========================');
      benchmarkResults.forEach(result => {
        console.log(`📊 ${result.name}:`);
        console.log(`   Success Rate: ${result.successRate}`);
        console.log(`   Avg Response: ${result.avgResponseTime}`);
        console.log(`   Requests/sec: ${result.requestsPerSecond}`);
      });
    }

    // Exit with appropriate code
    if (config.exitOnFailure && allResults.summary.failed > 0) {
      console.log('\n❌ Tests failed, exiting with error code 1');
      process.exit(1);
    } else {
      console.log('\n🎉 Test run completed successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n💥 Test run failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧪 Web-Scan API Test Runner

Usage: node run-api-tests.js [options]

Options:
  --base-url <url>     API base URL (default: http://localhost:3001)
  --no-benchmarks      Skip performance benchmarks
  --no-report          Skip generating reports
  --exit-on-failure    Exit with error code if tests fail
  --help, -h           Show this help message

Environment Variables:
  API_BASE_URL         API base URL (overrides --base-url)

Examples:
  node run-api-tests.js
  node run-api-tests.js --base-url http://localhost:8080
  node run-api-tests.js --no-benchmarks --exit-on-failure
`);
  process.exit(0);
}

// Parse CLI arguments
if (args.includes('--base-url')) {
  const urlIndex = args.indexOf('--base-url') + 1;
  if (urlIndex < args.length) {
    config.baseURL = args[urlIndex];
  }
}

if (args.includes('--no-benchmarks')) {
  config.runPerformanceBenchmarks = false;
}

if (args.includes('--no-report')) {
  config.generateReport = false;
}

if (args.includes('--exit-on-failure')) {
  config.exitOnFailure = true;
}

// Run the tests
main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
