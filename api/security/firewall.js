/**
 * Firewall/WAF Detection API
 * Migrated from Go implementation in web-scan-api/handlers/firewall.go
 * Detects Web Application Firewalls (WAF) based on HTTP headers
 */

import middleware from '../_common/middleware.js';
import got from 'got';

// WAF Detection Constants
const WAF_SIGNATURES = {
  CLOUDFLARE: 'Cloudflare',
  AWS_WAF: 'AWS WAF',
  AKAMAI: 'Akamai',
  SUCURI: 'Sucuri',
  BARRACUDA: 'Barracuda WAF',
  F5: 'F5 BIG-IP',
  SUCURI_PROXY: 'Sucuri CloudProxy WAF',
  FORTINET: 'Fortinet FortiWeb WAF',
  IMPERVA: 'Imperva SecureSphere WAF',
  SQREEN: 'Sqreen',
  REBLAZE: 'Reblaze WAF',
  CITRIX: 'Citrix NetScaler',
  WZB: 'WangZhanBao WAF',
  WEBCOMENT: 'Webcoment Firewall',
  YUNDUN: 'Yundun WAF',
  SAFE3: 'Safe3 Web Application Firewall',
  NAXSI: 'NAXSI WAF',
  IBM: 'IBM WebSphere DataPower',
  QRATOR: 'QRATOR WAF',
  DDOS_GUARD: 'DDoS-Guard WAF'
};

/**
 * Check for Web Application Firewall (WAF) presence
 * @param {string} url - URL to check
 * @returns {Promise<Object>} WAF detection results
 */
async function checkWAF(url) {
  try {
    console.log(`🔥 Checking WAF for: ${url}`);

    const response = await got(url, {
      timeout: {
        request: 10000
      },
      followRedirect: true,
      maxRedirects: 3,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebScan-Security-Checker/1.0)'
      }
    });

    const headers = response.headers;
    const wafResult = analyzeHeaders(headers);

    console.log(`🔍 WAF detection result: ${wafResult.hasWaf ? wafResult.waf : 'No WAF detected'}`);
    
    return {
      hasWaf: wafResult.hasWaf,
      waf: wafResult.waf || null,
      confidence: wafResult.confidence || 0,
      detectionMethod: wafResult.method || 'header_analysis',
      checkedHeaders: Object.keys(headers).length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ WAF check failed:', error.message);
    
    // Return partial results if we got headers before error
    if (error.response && error.response.headers) {
      const wafResult = analyzeHeaders(error.response.headers);
      return {
        hasWaf: wafResult.hasWaf,
        waf: wafResult.waf || null,
        confidence: wafResult.confidence || 0,
        detectionMethod: wafResult.method || 'header_analysis',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    throw new Error(`Failed to check WAF: ${error.message}`);
  }
}

/**
 * Analyze HTTP headers for WAF signatures
 * @param {Object} headers - HTTP response headers
 * @returns {Object} WAF analysis result
 */
function analyzeHeaders(headers) {
  // Convert headers to lowercase for case-insensitive comparison
  const lowerHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    lowerHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(' ').toLowerCase() : String(value).toLowerCase();
  }

  // WAF Detection Rules (ordered by confidence/specificity)
  const detectionRules = [
    // High confidence detections
    {
      check: () => lowerHeaders['x-sucuri-id'] || lowerHeaders['x-sucuri-cache'],
      waf: WAF_SIGNATURES.SUCURI_PROXY,
      confidence: 0.95,
      method: 'specific_header'
    },
    {
      check: () => lowerHeaders['x-waf-event-info'],
      waf: WAF_SIGNATURES.REBLAZE,
      confidence: 0.95,
      method: 'specific_header'
    },
    {
      check: () => lowerHeaders['x-datapower-transactionid'],
      waf: WAF_SIGNATURES.IBM,
      confidence: 0.95,
      method: 'specific_header'
    },
    {
      check: () => lowerHeaders['x-denied-reason'] || lowerHeaders['x-wzws-requested-method'],
      waf: WAF_SIGNATURES.WZB,
      confidence: 0.90,
      method: 'specific_header'
    },
    {
      check: () => lowerHeaders['x-webcoment'],
      waf: WAF_SIGNATURES.WEBCOMENT,
      confidence: 0.90,
      method: 'specific_header'
    },
    {
      check: () => lowerHeaders['x-yd-waf-info'] || lowerHeaders['x-yd-info'],
      waf: WAF_SIGNATURES.YUNDUN,
      confidence: 0.90,
      method: 'specific_header'
    },

    // Medium confidence detections (server header analysis)
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('cloudflare'),
      waf: WAF_SIGNATURES.CLOUDFLARE,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('akamaighost'),
      waf: WAF_SIGNATURES.AKAMAI,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('sucuri'),
      waf: WAF_SIGNATURES.SUCURI,
      confidence: 0.80,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('barracudawaf'),
      waf: WAF_SIGNATURES.BARRACUDA,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && (lowerHeaders['server'].includes('f5 big-ip') || lowerHeaders['server'].includes('big-ip')),
      waf: WAF_SIGNATURES.F5,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('fortiweb'),
      waf: WAF_SIGNATURES.FORTINET,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('imperva'),
      waf: WAF_SIGNATURES.IMPERVA,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('yundun'),
      waf: WAF_SIGNATURES.YUNDUN,
      confidence: 0.80,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('safe3waf'),
      waf: WAF_SIGNATURES.SAFE3,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('naxsi'),
      waf: WAF_SIGNATURES.NAXSI,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('qrator'),
      waf: WAF_SIGNATURES.QRATOR,
      confidence: 0.85,
      method: 'server_header'
    },
    {
      check: () => lowerHeaders['server'] && lowerHeaders['server'].includes('ddos-guard'),
      waf: WAF_SIGNATURES.DDOS_GUARD,
      confidence: 0.85,
      method: 'server_header'
    },

    // Lower confidence detections
    {
      check: () => lowerHeaders['x-powered-by'] && lowerHeaders['x-powered-by'].includes('aws lambda'),
      waf: WAF_SIGNATURES.AWS_WAF,
      confidence: 0.70,
      method: 'powered_by_header'
    },
    {
      check: () => lowerHeaders['x-protected-by'] && lowerHeaders['x-protected-by'].includes('sqreen'),
      waf: WAF_SIGNATURES.SQREEN,
      confidence: 0.80,
      method: 'protected_by_header'
    },
    {
      check: () => lowerHeaders['set-cookie'] && lowerHeaders['set-cookie'].includes('_citrix_ns_id'),
      waf: WAF_SIGNATURES.CITRIX,
      confidence: 0.75,
      method: 'cookie_analysis'
    }
  ];

  // Run detection rules
  for (const rule of detectionRules) {
    try {
      if (rule.check()) {
        return {
          hasWaf: true,
          waf: rule.waf,
          confidence: rule.confidence,
          method: rule.method
        };
      }
    } catch (error) {
      console.warn(`WAF detection rule failed: ${error.message}`);
    }
  }

  return {
    hasWaf: false,
    waf: null,
    confidence: 0,
    method: 'header_analysis'
  };
}

/**
 * Main firewall detection handler
 * @param {string} url - URL to analyze
 * @returns {Promise<Object>} Firewall detection results
 */
const firewallHandler = async (url) => {
  try {
    console.log(`🔥 Starting firewall detection for: ${url}`);

    const result = await checkWAF(url);

    return {
      url,
      firewall: result,
      timestamp: new Date().toISOString(),
      success: true
    };

  } catch (error) {
    console.error('❌ Firewall detection failed:', error);
    
    return {
      url,
      firewall: {
        hasWaf: false,
        waf: null,
        error: error.message
      },
      timestamp: new Date().toISOString(),
      success: false
    };
  }
};

// Export handler with middleware
export const handler = middleware(firewallHandler);
export default handler;
