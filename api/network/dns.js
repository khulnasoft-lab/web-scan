import dns from 'dns';
import { promisify } from 'util';
import middleware from '../_common/middleware.js';

/**
 * Enhanced DNS Handler - Migrated from Go implementation
 * Provides comprehensive DNS record resolution with proper error handling
 */
const dnsHandler = async (url) => {
  let hostname = url;

  // Handle URLs by extracting hostname
  if (hostname.startsWith('http://') || hostname.startsWith('https://')) {
    hostname = new URL(hostname).hostname;
  }

  console.log(`🔍 DNS lookup for: ${hostname}`);

  try {
    // Promisify DNS functions
    const resolve4 = promisify(dns.resolve4);
    const resolve6 = promisify(dns.resolve6);
    const resolveMx = promisify(dns.resolveMx);
    const resolveTxt = promisify(dns.resolveTxt);
    const resolveNs = promisify(dns.resolveNs);
    const resolveCname = promisify(dns.resolveCname);
    const resolveSoa = promisify(dns.resolveSoa);
    const resolveSrv = promisify(dns.resolveSrv);
    const resolvePtr = promisify(dns.resolvePtr);

    // Resolve all DNS records concurrently
    const results = await Promise.allSettled([
      resolve4(hostname),
      resolve6(hostname),
      resolveMx(hostname),
      resolveTxt(hostname),
      resolveNs(hostname),
      resolveCname(hostname),
      resolveSoa(hostname),
      resolveSrv(hostname),
      resolvePtr(hostname)
    ]);

    // Process A records (IPv4) - match Go format
    const aRecords = [];
    if (results[0].status === 'fulfilled') {
      results[0].value.forEach(ip => {
        aRecords.push({
          address: ip,
          family: 4
        });
      });
    }

    // Process AAAA records (IPv6)
    const aaaaRecords = results[1].status === 'fulfilled' ? results[1].value : [];

    // Process MX records - format like Go version
    const mxRecords = [];
    if (results[2].status === 'fulfilled') {
      results[2].value.forEach(mx => {
        mxRecords.push(`${mx.exchange} ${mx.priority}`);
      });
    }

    // Process TXT records - flatten arrays
    const txtRecords = [];
    if (results[3].status === 'fulfilled') {
      results[3].value.forEach(txtArray => {
        if (Array.isArray(txtArray)) {
          txtRecords.push(txtArray.join(' '));
        } else {
          txtRecords.push(txtArray);
        }
      });
    }

    // Process NS records
    const nsRecords = results[4].status === 'fulfilled' ? results[4].value : [];

    // Process CNAME records
    const cnameRecords = results[5].status === 'fulfilled' ? [results[5].value] : [];

    // Process SOA record
    let soaRecord = '';
    if (results[6].status === 'fulfilled') {
      const soa = results[6].value;
      soaRecord = `${soa.nsname} ${soa.hostmaster} ${soa.serial} ${soa.refresh} ${soa.retry} ${soa.expire} ${soa.minttl}`;
    }

    // Process SRV records - format like Go version
    const srvRecords = [];
    if (results[7].status === 'fulfilled') {
      results[7].value.forEach(srv => {
        srvRecords.push(`${srv.name} ${srv.port} ${srv.priority} ${srv.weight}`);
      });
    }

    // Process PTR records
    const ptrRecords = results[8].status === 'fulfilled' ? results[8].value : [];

    const dnsResponse = {
      A: aRecords,
      AAAA: aaaaRecords,
      MX: mxRecords,
      TXT: txtRecords,
      NS: nsRecords,
      CNAME: cnameRecords,
      SOA: soaRecord,
      SRV: srvRecords,
      PTR: ptrRecords
    };

    console.log(`✅ DNS lookup completed for ${hostname}:`, {
      A: aRecords.length,
      AAAA: aaaaRecords.length,
      MX: mxRecords.length,
      TXT: txtRecords.length,
      NS: nsRecords.length
    });

    return dnsResponse;

  } catch (error) {
    console.error(`❌ DNS lookup failed for ${hostname}:`, error.message);
    throw new Error(`DNS resolution failed: ${error.message}`);
  }
};

export const handler = middleware(dnsHandler);
export default handler;
