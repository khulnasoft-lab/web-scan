/**
 * API Versioning System
 * Manages API versions and backward compatibility
 */

// API Version Configuration
export const API_VERSIONS = {
  v1: {
    version: '1.0.0',
    released: '2024-01-01',
    deprecated: false,
    supportedUntil: '2025-12-31',
    description: 'Initial API release with core security and network analysis features'
  },
  v2: {
    version: '2.0.0',
    released: '2024-06-01',
    deprecated: false,
    supportedUntil: null, // Current version
    description: 'Enhanced API with AI features, caching, and performance improvements'
  }
};

export const CURRENT_VERSION = 'v2';
export const DEFAULT_VERSION = 'v2';

/**
 * Version compatibility matrix
 */
const COMPATIBILITY_MATRIX = {
  v1: {
    endpoints: {
      '/api/ssl': '/api/security/ssl',
      '/api/headers': '/api/security/headers',
      '/api/dns': '/api/network/dns',
      '/api/ports': '/api/network/ports',
      '/api/cookies': '/api/utils/cookies',
      '/api/redirects': '/api/utils/redirects'
    },
    removedEndpoints: [],
    deprecatedFeatures: []
  },
  v2: {
    endpoints: {}, // Current structure
    newEndpoints: [
      '/api/security/tls',
      '/api/security/firewall',
      '/api/ai-monitoring-insights',
      '/api/ai-vulnerability-analysis',
      '/api/test-ai'
    ],
    enhancedFeatures: [
      'Rate limiting',
      'Response caching',
      'Performance monitoring',
      'AI-powered analysis'
    ]
  }
};

/**
 * Extract version from request
 */
export const extractVersion = (req) => {
  // Check Accept header first
  const acceptHeader = req.headers.accept;
  if (acceptHeader && acceptHeader.includes('application/vnd.webscan')) {
    const versionMatch = acceptHeader.match(/application\/vnd\.webscan\.v(\d+)/);
    if (versionMatch) {
      return `v${versionMatch[1]}`;
    }
  }

  // Check query parameter
  if (req.query.version) {
    return req.query.version.startsWith('v') ? req.query.version : `v${req.query.version}`;
  }

  // Check custom header
  if (req.headers['x-api-version']) {
    const version = req.headers['x-api-version'];
    return version.startsWith('v') ? version : `v${version}`;
  }

  // Check URL path
  const pathMatch = req.path.match(/^\/api\/v(\d+)\//);
  if (pathMatch) {
    return `v${pathMatch[1]}`;
  }

  return DEFAULT_VERSION;
};

/**
 * Version validation middleware
 */
export const versionMiddleware = (req, res, next) => {
  const requestedVersion = extractVersion(req);
  
  // Validate version
  if (!API_VERSIONS[requestedVersion]) {
    return res.status(400).json({
      error: 'Unsupported API version',
      requestedVersion,
      supportedVersions: Object.keys(API_VERSIONS),
      message: `API version ${requestedVersion} is not supported. Please use one of: ${Object.keys(API_VERSIONS).join(', ')}`
    });
  }

  const versionInfo = API_VERSIONS[requestedVersion];
  
  // Check if version is deprecated
  if (versionInfo.deprecated) {
    res.set('X-API-Deprecated', 'true');
    res.set('X-API-Deprecation-Date', versionInfo.supportedUntil);
    res.set('Warning', `299 - "API version ${requestedVersion} is deprecated. Please migrate to ${CURRENT_VERSION}"`);
  }

  // Add version info to request
  req.apiVersion = requestedVersion;
  req.versionInfo = versionInfo;

  // Add version headers to response
  res.set('X-API-Version', requestedVersion);
  res.set('X-API-Current-Version', CURRENT_VERSION);
  
  next();
};

/**
 * Route mapping for backward compatibility
 */
export const mapLegacyRoute = (originalPath, version) => {
  const compatibility = COMPATIBILITY_MATRIX[version];
  
  if (!compatibility || !compatibility.endpoints) {
    return originalPath;
  }

  // Check if this is a legacy route that needs mapping
  const mappedRoute = compatibility.endpoints[originalPath];
  return mappedRoute || originalPath;
};

/**
 * Response transformer for version compatibility
 */
export const transformResponse = (data, version, endpoint) => {
  if (version === CURRENT_VERSION) {
    return data; // No transformation needed for current version
  }

  // Apply version-specific transformations
  switch (version) {
    case 'v1':
      return transformToV1Format(data, endpoint);
    default:
      return data;
  }
};

/**
 * Transform response to v1 format
 */
const transformToV1Format = (data, endpoint) => {
  // Example transformations for v1 compatibility
  if (endpoint.includes('/security/ssl')) {
    // v1 expected simpler SSL response format
    if (data.subject && typeof data.subject === 'object') {
      return {
        ...data,
        subject: data.subject.CN || 'Unknown',
        issuer: data.issuer.CN || 'Unknown'
      };
    }
  }

  if (endpoint.includes('/network/dns')) {
    // v1 expected different DNS format
    if (data.A && Array.isArray(data.A)) {
      return {
        ...data,
        A: data.A.map(record => record.address || record)
      };
    }
  }

  return data;
};

/**
 * Get API version information
 */
export const getVersionInfo = (version = null) => {
  if (version) {
    return API_VERSIONS[version] || null;
  }
  
  return {
    current: CURRENT_VERSION,
    default: DEFAULT_VERSION,
    supported: Object.keys(API_VERSIONS),
    versions: API_VERSIONS
  };
};

/**
 * Generate API version documentation
 */
export const generateVersionDocs = () => {
  const docs = {
    title: 'API Versioning Guide',
    description: 'How to use different versions of the Web-Scan API',
    currentVersion: CURRENT_VERSION,
    defaultVersion: DEFAULT_VERSION,
    versions: {},
    usage: {
      'Accept Header': 'Accept: application/vnd.webscan.v2+json',
      'Query Parameter': '?version=v2',
      'Custom Header': 'X-API-Version: v2',
      'URL Path': '/api/v2/security/ssl'
    },
    migration: {}
  };

  // Add version details
  Object.entries(API_VERSIONS).forEach(([key, info]) => {
    docs.versions[key] = {
      ...info,
      endpoints: COMPATIBILITY_MATRIX[key]?.newEndpoints || [],
      deprecated: info.deprecated,
      supportedUntil: info.supportedUntil
    };
  });

  // Add migration guides
  docs.migration = {
    'v1 to v2': {
      description: 'Migration guide from v1 to v2',
      changes: [
        'Endpoints reorganized into categories (security/, network/, utils/)',
        'Added AI-powered analysis endpoints',
        'Enhanced response formats with additional metadata',
        'Added rate limiting and caching',
        'Improved error handling and validation'
      ],
      mappings: COMPATIBILITY_MATRIX.v1?.endpoints || {}
    }
  };

  return docs;
};

/**
 * Middleware to handle legacy route redirects
 */
export const legacyRouteHandler = (req, res, next) => {
  const version = extractVersion(req);
  const originalPath = req.path;
  const mappedPath = mapLegacyRoute(originalPath, version);

  if (mappedPath !== originalPath) {
    // Log the legacy route usage
    console.log(`🔄 Legacy route redirect: ${originalPath} -> ${mappedPath} (${version})`);
    
    // Add deprecation warning
    res.set('X-Legacy-Route', 'true');
    res.set('X-New-Route', mappedPath);
    res.set('Warning', `299 - "Route ${originalPath} is deprecated. Use ${mappedPath} instead"`);
    
    // Redirect to new route
    req.url = mappedPath;
    req.path = mappedPath;
  }

  next();
};

export default {
  API_VERSIONS,
  CURRENT_VERSION,
  DEFAULT_VERSION,
  extractVersion,
  versionMiddleware,
  mapLegacyRoute,
  transformResponse,
  getVersionInfo,
  generateVersionDocs,
  legacyRouteHandler
};
