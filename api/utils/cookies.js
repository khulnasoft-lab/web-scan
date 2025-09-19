import axios from 'axios';
import puppeteer from 'puppeteer';
import middleware from '../_common/middleware.js';

/**
 * Enhanced Cookies Handler - Migrated from Go implementation
 * Extracts both header cookies and client-side cookies using Puppeteer
 */

const getPuppeteerCookies = async (url) => {
  console.log(`🍪 Getting client cookies for: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
  });

  try {
    const page = await browser.newPage();
    
    // Set a reasonable timeout
    await page.setDefaultTimeout(10000);
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 10000
    });
    
    // Get all cookies for the page
    const cookies = await page.cookies();
    
    // Format cookies to match Go implementation structure
    const formattedCookies = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires || -1,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      session: cookie.expires === -1 || cookie.expires === undefined,
      sameSite: cookie.sameSite || 'unspecified',
      priority: 'Medium', // Default priority
      sourceScheme: cookie.secure ? 'Secure' : 'NonSecure'
    }));
    
    console.log(`✅ Found ${formattedCookies.length} client cookies`);
    return formattedCookies;
    
  } finally {
    await browser.close();
  }
};

const cookieHandler = async (url) => {
  console.log(`🍪 Starting cookie analysis for: ${url}`);
  
  let headerCookies = [];
  let clientCookies = [];

  try {
    // Get header cookies using axios
    console.log(`📡 Fetching header cookies...`);
    const response = await axios.get(url, {
      withCredentials: true,
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebScan-Cookie-Checker/1.0)'
      }
    });
    
    headerCookies = response.headers['set-cookie'] || [];
    console.log(`✅ Found ${headerCookies.length} header cookies`);
    
  } catch (error) {
    console.warn(`⚠️ Header cookie fetch failed: ${error.message}`);
    // Continue with client cookies even if header cookies fail
  }

  try {
    // Get client-side cookies using Puppeteer
    console.log(`🎭 Fetching client cookies with Puppeteer...`);
    clientCookies = await getPuppeteerCookies(url);
    
  } catch (error) {
    console.warn(`⚠️ Client cookie fetch failed: ${error.message}`);
    clientCookies = [];
  }

  // Check if we found any cookies
  if (headerCookies.length === 0 && clientCookies.length === 0) {
    console.log(`ℹ️ No cookies found for ${url}`);
    return { skipped: 'No cookies' };
  }

  const result = {
    headerCookies: headerCookies,
    clientCookies: clientCookies
  };

  console.log(`🎯 Cookie analysis complete:`, {
    headerCookies: headerCookies.length,
    clientCookies: clientCookies.length
  });

  return result;
};

export const handler = middleware(cookieHandler);
export default handler;
