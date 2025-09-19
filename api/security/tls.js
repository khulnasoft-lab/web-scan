import axios from 'axios';
import tls from 'tls';
import { promisify } from 'util';
import middleware from '../_common/middleware.js';

const MOZILLA_TLS_OBSERVATORY_API = 'https://tls-observatory.services.mozilla.com/api/v1';

/**
 * Enhanced TLS Handler - Migrated from Go implementation
 * Provides comprehensive TLS/SSL analysis using Mozilla TLS Observatory
 * and direct TLS connection analysis
 */

const getTLSConnectionInfo = async (hostname, port = 443) => {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: hostname,
      port: port,
      rejectUnauthorized: false, // Allow self-signed certificates for analysis
    }, () => {
      const cert = socket.getPeerCertificate(true);
      const cipher = socket.getCipher();
      const protocol = socket.getProtocol();
      
      const tlsInfo = {
        certificate: {
          subject: cert.subject,
          issuer: cert.issuer,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          fingerprint: cert.fingerprint,
          fingerprint256: cert.fingerprint256,
          serialNumber: cert.serialNumber
        },
        cipher: {
          name: cipher.name,
          version: cipher.version
        },
        protocol: protocol,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError
      };
      
      socket.end();
      resolve(tlsInfo);
    });

    socket.on('error', (error) => {
      reject(error);
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('TLS connection timeout'));
    });
  });
};

const getMozillaTLSObservatory = async (domain) => {
  try {
    console.log(`🔒 Starting Mozilla TLS Observatory scan for: ${domain}`);
    
    // Start scan
    const scanResponse = await axios.post(`${MOZILLA_TLS_OBSERVATORY_API}/scan?target=${domain}`, {}, {
      timeout: 15000
    });
    
    const scanId = scanResponse.data.scan_id;
    
    if (typeof scanId !== 'number') {
      throw new Error('Failed to get scan_id from TLS Observatory');
    }
    
    console.log(`🔍 TLS Observatory scan started with ID: ${scanId}`);
    
    // Wait a bit for scan to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get results
    const resultResponse = await axios.get(`${MOZILLA_TLS_OBSERVATORY_API}/results?id=${scanId}`, {
      timeout: 15000
    });
    
    console.log(`✅ TLS Observatory scan completed`);
    return resultResponse.data;
    
  } catch (error) {
    console.warn(`⚠️ Mozilla TLS Observatory failed: ${error.message}`);
    return null;
  }
};

const tlsHandler = async (url) => {
  console.log(`🔒 Starting TLS analysis for: ${url}`);
  
  try {
    const domain = new URL(url).hostname;
    
    // Run both analyses concurrently
    const [directTLS, observatoryResults] = await Promise.allSettled([
      getTLSConnectionInfo(domain),
      getMozillaTLSObservatory(domain)
    ]);
    
    const result = {
      domain: domain,
      timestamp: new Date().toISOString()
    };
    
    // Add direct TLS connection results
    if (directTLS.status === 'fulfilled') {
      result.connection = directTLS.value;
      console.log(`✅ Direct TLS connection analysis completed`);
    } else {
      result.connectionError = directTLS.reason.message;
      console.warn(`⚠️ Direct TLS connection failed: ${directTLS.reason.message}`);
    }
    
    // Add Mozilla TLS Observatory results
    if (observatoryResults.status === 'fulfilled' && observatoryResults.value) {
      result.observatory = observatoryResults.value;
      console.log(`✅ Mozilla TLS Observatory analysis completed`);
    } else {
      result.observatoryError = observatoryResults.reason?.message || 'Observatory analysis failed';
      console.warn(`⚠️ Mozilla TLS Observatory failed`);
    }
    
    // Ensure we have some results
    if (!result.connection && !result.observatory) {
      throw new Error('Both TLS analysis methods failed');
    }
    
    console.log(`🎯 TLS analysis complete for ${domain}`);
    return result;
    
  } catch (error) {
    console.error(`❌ TLS analysis failed: ${error.message}`);
    throw new Error(`TLS analysis failed: ${error.message}`);
  }
};

export const handler = middleware(tlsHandler);
export default handler;
