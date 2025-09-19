/**
 * API Documentation Generator
 * Automatically generates comprehensive API documentation
 */

import fs from 'fs/promises';
import path from 'path';

// API endpoint documentation templates
const endpointDocs = {
  // Security endpoints
  '/api/security/ssl': {
    category: 'Security',
    description: 'Analyzes SSL/TLS certificate information for a given domain',
    parameters: {
      url: { type: 'string', required: true, description: 'Target URL or domain to analyze' }
    },
    example: 'https://api.web-scan.com/api/security/ssl?url=example.com',
    response: {
      subject: 'Certificate subject information',
      issuer: 'Certificate issuer details',
      valid_from: 'Certificate validity start date',
      valid_to: 'Certificate expiration date',
      fingerprint: 'Certificate fingerprint'
    }
  },

  '/api/security/headers': {
    category: 'Security',
    description: 'Analyzes HTTP security headers for a website',
    parameters: {
      url: { type: 'string', required: true, description: 'Target URL to analyze headers' }
    },
    example: 'https://api.web-scan.com/api/security/headers?url=example.com',
    response: {
      'content-security-policy': 'CSP header value',
      'x-frame-options': 'Frame options setting',
      'x-content-type-options': 'Content type options'
    }
  },

  '/api/security/tls': {
    category: 'Security',
    description: 'Comprehensive TLS analysis using multiple methods',
    parameters: {
      url: { type: 'string', required: true, description: 'Target URL for TLS analysis' }
    },
    example: 'https://api.web-scan.com/api/security/tls?url=example.com',
    response: {
      connection: 'Direct TLS connection analysis',
      observatory: 'Mozilla TLS Observatory results'
    }
  },

  '/api/security/firewall': {
    category: 'Security',
    description: 'Detects Web Application Firewalls (WAF) protecting a website',
    parameters: {
      url: { type: 'string', required: true, description: 'Target URL to check for WAF' }
    },
    example: 'https://api.web-scan.com/api/security/firewall?url=example.com',
    response: {
      hasWaf: 'Boolean indicating WAF presence',
      waf: 'Detected WAF name if found',
      confidence: 'Detection confidence score'
    }
  },

  // Network endpoints
  '/api/network/dns': {
    category: 'Network',
    description: 'Comprehensive DNS record lookup for a domain',
    parameters: {
      url: { type: 'string', required: true, description: 'Domain name for DNS lookup' }
    },
    example: 'https://api.web-scan.com/api/network/dns?url=example.com',
    response: {
      A: 'IPv4 address records',
      AAAA: 'IPv6 address records',
      MX: 'Mail exchange records',
      TXT: 'Text records',
      NS: 'Name server records',
      CNAME: 'Canonical name records'
    }
  },

  '/api/network/ports': {
    category: 'Network',
    description: 'Scans common ports on a target domain',
    parameters: {
      url: { type: 'string', required: true, description: 'Target domain for port scanning' }
    },
    example: 'https://api.web-scan.com/api/network/ports?url=example.com',
    response: {
      openPorts: 'Array of open port numbers',
      failedPorts: 'Array of closed/filtered ports'
    }
  },

  '/api/network/trace-route': {
    category: 'Network',
    description: 'Performs network traceroute to show path to destination',
    parameters: {
      url: { type: 'string', required: true, description: 'Target domain for traceroute' }
    },
    example: 'https://api.web-scan.com/api/network/trace-route?url=example.com',
    response: {
      hops: 'Array of network hops with timing information'
    }
  },

  // AI endpoints
  '/api/ai-monitoring-insights': {
    category: 'AI',
    description: 'AI-powered monitoring insights with predictive analytics',
    parameters: {
      configId: { type: 'string', required: true, description: 'Monitoring configuration ID' }
    },
    example: 'https://api.web-scan.com/api/ai-monitoring-insights?configId=1',
    response: {
      insights: 'Array of AI-generated insights',
      healthScore: 'Overall system health score (0-10)',
      predictions: 'Predictive analytics results'
    }
  },

  '/api/test-ai': {
    category: 'AI',
    description: 'Basic AI vulnerability analysis for websites',
    parameters: {
      url: { type: 'string', required: true, description: 'Target URL for AI analysis' }
    },
    example: 'https://api.web-scan.com/api/test-ai?url=example.com',
    response: {
      riskScore: 'Overall risk score (0-10)',
      vulnerabilities: 'Detected security vulnerabilities',
      recommendations: 'AI-generated security recommendations'
    }
  },

  // Utility endpoints
  '/api/utils/cookies': {
    category: 'Utilities',
    description: 'Analyzes cookies set by a website',
    parameters: {
      url: { type: 'string', required: true, description: 'Target URL for cookie analysis' }
    },
    example: 'https://api.web-scan.com/api/utils/cookies?url=example.com',
    response: {
      headerCookies: 'Cookies from HTTP headers',
      clientCookies: 'Client-side cookies detected via browser'
    }
  },

  '/api/utils/redirects': {
    category: 'Utilities',
    description: 'Traces HTTP redirects for a given URL',
    parameters: {
      url: { type: 'string', required: true, description: 'Starting URL to trace redirects' }
    },
    example: 'https://api.web-scan.com/api/utils/redirects?url=example.com',
    response: {
      redirects: 'Array of URLs in the redirect chain'
    }
  }
};

/**
 * Generate HTML documentation
 */
export const generateHTMLDocs = () => {
  const categories = {};
  
  // Group endpoints by category
  Object.entries(endpointDocs).forEach(([endpoint, doc]) => {
    if (!categories[doc.category]) {
      categories[doc.category] = [];
    }
    categories[doc.category].push({ endpoint, ...doc });
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web-Scan API Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            text-align: center;
        }
        .category {
            background: white;
            margin: 2rem 0;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .category-header {
            background: #2c3e50;
            color: white;
            padding: 1rem 2rem;
            font-size: 1.5rem;
            font-weight: bold;
        }
        .endpoint {
            border-bottom: 1px solid #eee;
            padding: 2rem;
        }
        .endpoint:last-child {
            border-bottom: none;
        }
        .endpoint-path {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #f1f3f4;
            padding: 0.5rem 1rem;
            border-radius: 5px;
            font-size: 1.1rem;
            color: #d73a49;
            margin-bottom: 1rem;
        }
        .description {
            margin-bottom: 1.5rem;
            font-size: 1.1rem;
        }
        .parameters, .response {
            margin: 1rem 0;
        }
        .parameters h4, .response h4 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        .param {
            background: #f8f9fa;
            padding: 0.5rem 1rem;
            margin: 0.5rem 0;
            border-left: 4px solid #007bff;
            border-radius: 3px;
        }
        .param-name {
            font-weight: bold;
            color: #007bff;
        }
        .param-type {
            color: #6c757d;
            font-style: italic;
        }
        .example {
            background: #1e1e1e;
            color: #f8f8f2;
            padding: 1rem;
            border-radius: 5px;
            font-family: 'Monaco', 'Menlo', monospace;
            overflow-x: auto;
            margin: 1rem 0;
        }
        .response-field {
            background: #e8f5e8;
            padding: 0.3rem 0.8rem;
            margin: 0.3rem 0;
            border-left: 4px solid #28a745;
            border-radius: 3px;
        }
        .toc {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .toc h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .toc ul {
            list-style: none;
            padding-left: 0;
        }
        .toc li {
            margin: 0.5rem 0;
        }
        .toc a {
            color: #007bff;
            text-decoration: none;
            padding: 0.3rem 0.8rem;
            border-radius: 3px;
            transition: background 0.2s;
        }
        .toc a:hover {
            background: #f8f9fa;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Web-Scan API Documentation</h1>
        <p>Comprehensive security and network analysis API</p>
        <p><strong>Base URL:</strong> https://api.web-scan.com</p>
    </div>

    <div class="toc">
        <h3>📋 Table of Contents</h3>
        <ul>
            ${Object.keys(categories).map(category => 
                `<li><a href="#${category.toLowerCase()}">${category} (${categories[category].length} endpoints)</a></li>`
            ).join('')}
        </ul>
    </div>

    ${Object.entries(categories).map(([categoryName, endpoints]) => `
        <div class="category" id="${categoryName.toLowerCase()}">
            <div class="category-header">${categoryName}</div>
            ${endpoints.map(endpoint => `
                <div class="endpoint">
                    <div class="endpoint-path">GET ${endpoint.endpoint}</div>
                    <div class="description">${endpoint.description}</div>
                    
                    <div class="parameters">
                        <h4>📝 Parameters</h4>
                        ${Object.entries(endpoint.parameters).map(([name, param]) => `
                            <div class="param">
                                <span class="param-name">${name}</span>
                                <span class="param-type">(${param.type}${param.required ? ', required' : ', optional'})</span>
                                <br>${param.description}
                            </div>
                        `).join('')}
                    </div>

                    <div class="example">
                        <strong>Example Request:</strong><br>
                        ${endpoint.example}
                    </div>

                    <div class="response">
                        <h4>📤 Response Fields</h4>
                        ${Object.entries(endpoint.response).map(([field, desc]) => `
                            <div class="response-field">
                                <strong>${field}:</strong> ${desc}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('')}

    <div style="text-align: center; margin-top: 3rem; padding: 2rem; color: #6c757d;">
        <p>Generated automatically by Web-Scan API Documentation Generator</p>
        <p>Last updated: ${new Date().toISOString()}</p>
    </div>
</body>
</html>`;

  return html;
};

/**
 * Generate Markdown documentation
 */
export const generateMarkdownDocs = () => {
  const categories = {};
  
  // Group endpoints by category
  Object.entries(endpointDocs).forEach(([endpoint, doc]) => {
    if (!categories[doc.category]) {
      categories[doc.category] = [];
    }
    categories[doc.category].push({ endpoint, ...doc });
  });

  let markdown = `# 🔍 Web-Scan API Documentation

Comprehensive security and network analysis API

**Base URL:** \`https://api.web-scan.com\`

## 📋 Table of Contents

${Object.keys(categories).map(category => 
  `- [${category}](#${category.toLowerCase().replace(/\s+/g, '-')}) (${categories[category].length} endpoints)`
).join('\n')}

---

`;

  Object.entries(categories).forEach(([categoryName, endpoints]) => {
    markdown += `## ${categoryName}\n\n`;
    
    endpoints.forEach(endpoint => {
      markdown += `### \`GET ${endpoint.endpoint}\`\n\n`;
      markdown += `${endpoint.description}\n\n`;
      
      markdown += `**Parameters:**\n`;
      Object.entries(endpoint.parameters).forEach(([name, param]) => {
        markdown += `- \`${name}\` (${param.type}${param.required ? ', required' : ', optional'}): ${param.description}\n`;
      });
      
      markdown += `\n**Example Request:**\n\`\`\`\n${endpoint.example}\n\`\`\`\n\n`;
      
      markdown += `**Response Fields:**\n`;
      Object.entries(endpoint.response).forEach(([field, desc]) => {
        markdown += `- \`${field}\`: ${desc}\n`;
      });
      
      markdown += '\n---\n\n';
    });
  });

  markdown += `\n*Generated automatically by Web-Scan API Documentation Generator*\n`;
  markdown += `*Last updated: ${new Date().toISOString()}*\n`;

  return markdown;
};

/**
 * Save documentation to files
 */
export const saveDocs = async (outputDir = './docs') => {
  try {
    // Create docs directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });
    
    // Generate and save HTML documentation
    const html = generateHTMLDocs();
    await fs.writeFile(path.join(outputDir, 'api-docs.html'), html);
    
    // Generate and save Markdown documentation
    const markdown = generateMarkdownDocs();
    await fs.writeFile(path.join(outputDir, 'API.md'), markdown);
    
    console.log('📚 API documentation generated successfully!');
    console.log(`📄 HTML: ${path.join(outputDir, 'api-docs.html')}`);
    console.log(`📝 Markdown: ${path.join(outputDir, 'API.md')}`);
    
    return { html: path.join(outputDir, 'api-docs.html'), markdown: path.join(outputDir, 'API.md') };
  } catch (error) {
    console.error('❌ Failed to save documentation:', error);
    throw error;
  }
};

export default {
  generateHTMLDocs,
  generateMarkdownDocs,
  saveDocs,
  endpointDocs
};
