/**
 * Simple test script for AI vulnerability analysis
 */

import VulnerabilityAnalyzer from './analyzers/vulnerability-analyzer.js';

async function testAIAnalysis() {
  console.log('🧪 Testing AI Vulnerability Analysis...\n');

  // Initialize analyzer
  const analyzer = new VulnerabilityAnalyzer({
    confidenceThreshold: 0.7,
    enableLearning: true
  });

  await analyzer.initialize();

  // Test data simulating security scan results
  const testData = {
    url: 'https://example.com',
    ssl: {
      valid: false,
      valid_to: '2023-01-01', // Expired
      protocol: 'TLSv1.1', // Weak protocol
      hsts_preload: false
    },
    headers: {
      'server': 'Apache/2.2.15', // Information disclosure
      'x-powered-by': 'PHP/5.6.40' // Information disclosure
      // Missing critical security headers
    },
    threats: {
      unsafe: false
    },
    techStack: {
      technologies: [
        { name: 'jQuery', version: '1.12.4' }, // Outdated
        { name: 'PHP', version: '5.6.40' } // Very outdated
      ]
    },
    ports: {
      open: [
        { port: 80, service: 'http' },
        { port: 443, service: 'https' },
        { port: 21, service: 'ftp' } // Dangerous port
      ]
    }
  };

  try {
    // Perform analysis
    const result = await analyzer.analyze(testData, 'comprehensive');

    // Display results
    console.log('📊 Analysis Results:');
    console.log('===================');
    console.log(`Risk Score: ${result.riskScore}/10 (${result.riskLevel})`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`Vulnerabilities Found: ${result.vulnerabilities.length}`);
    console.log();

    console.log('🚨 Vulnerabilities:');
    result.vulnerabilities.forEach((vuln, index) => {
      console.log(`${index + 1}. [${vuln.severity.toUpperCase()}] ${vuln.name}`);
      console.log(`   Score: ${vuln.score}/10`);
      console.log(`   Description: ${vuln.description}`);
      console.log(`   Remediation: ${vuln.remediation}`);
      console.log();
    });

    console.log('💡 Top Recommendations:');
    result.prioritizedActions.slice(0, 3).forEach((action, index) => {
      console.log(`${index + 1}. ${action.action} (${action.component})`);
    });
    console.log();

    console.log('🔍 Insights:');
    result.insights.forEach((insight, index) => {
      console.log(`${index + 1}. [${insight.severity.toUpperCase()}] ${insight.message}`);
    });
    console.log();

    console.log('📈 Summary:');
    console.log(result.summary.summary);
    console.log();

    console.log('✅ AI Analysis Test Completed Successfully!');
    
    // Display analyzer stats
    const stats = analyzer.getStats();
    console.log('\n📊 Analyzer Statistics:');
    console.log(`Total Analyses: ${stats.totalAnalyses}`);
    console.log(`Successful Analyses: ${stats.successfulAnalyses}`);
    console.log(`Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
    console.log(`Cache Size: ${stats.cacheSize}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await analyzer.shutdown();
  }
}

// Run the test
testAIAnalysis().catch(console.error);
