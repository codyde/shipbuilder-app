/**
 * MCP Service Configuration
 * Optimized for standalone MCP service deployment
 */

export const MCP_SERVICE_CONFIG = {
  // Service Information
  SERVICE_NAME: 'shipbuilder-mcp-service',
  SERVICE_VERSION: '1.0.0',
  MCP_PROTOCOL_VERSION: '2025-03-26',
  
  // Server Configuration
  SERVER_INFO: {
    name: 'shipbuilder-mcp',
    version: '1.0.0',
    description: 'Model Context Protocol server for Shipbuilder project management'
  },

  // OAuth Configuration
  OAUTH_CONFIG: {
    scopes: ['projects:read', 'tasks:read'],
    responseTypes: ['code'],
    grantTypes: ['authorization_code'],
    codeChallengeMethodsSupported: ['S256', 'plain'],
    tokenEndpointAuthMethods: ['client_secret_basic', 'client_secret_post', 'none'],
    bearerMethodsSupported: ['header']
  },

  // Token Configuration
  TOKEN_CONFIG: {
    expiry: '30d',
    expirySeconds: 30 * 24 * 60 * 60
  },

  // Session Configuration
  SESSION_CONFIG: {
    cleanupInterval: 30 * 60 * 1000, // 30 minutes
    maxAge: 2 * 60 * 60 * 1000 // 2 hours
  },

  // Capabilities
  CAPABILITIES: {
    basic: {
      tools: true,
      resources: false,
      prompts: false,
      logging: false
    },
    detailed: {
      tools: { listChanged: false },
      resources: {},
      prompts: {},
      logging: {}
    }
  }
} as const;

/**
 * MCP Protocol and Server Information
 */
export const MCP_PROTOCOL_VERSION = MCP_SERVICE_CONFIG.MCP_PROTOCOL_VERSION;
export const MCP_SERVER_NAME = MCP_SERVICE_CONFIG.SERVER_INFO.name;
export const MCP_SERVER_VERSION = MCP_SERVICE_CONFIG.SERVER_INFO.version;
export const MCP_SERVER_DISPLAY_NAME = 'Shipbuilder MCP Server';
export const MCP_SERVER_DESCRIPTION = MCP_SERVICE_CONFIG.SERVER_INFO.description;

/**
 * OAuth Configuration
 */
export const MCP_OAUTH_SCOPES = MCP_SERVICE_CONFIG.OAUTH_CONFIG.scopes;
export const MCP_OAUTH_RESPONSE_TYPES = MCP_SERVICE_CONFIG.OAUTH_CONFIG.responseTypes;
export const MCP_OAUTH_GRANT_TYPES = MCP_SERVICE_CONFIG.OAUTH_CONFIG.grantTypes;
export const MCP_OAUTH_CODE_CHALLENGE_METHODS = MCP_SERVICE_CONFIG.OAUTH_CONFIG.codeChallengeMethodsSupported;
export const MCP_OAUTH_TOKEN_AUTH_METHODS = MCP_SERVICE_CONFIG.OAUTH_CONFIG.tokenEndpointAuthMethods;
export const MCP_OAUTH_BEARER_METHODS = MCP_SERVICE_CONFIG.OAUTH_CONFIG.bearerMethodsSupported;

/**
 * Token and Session Configuration
 */
export const MCP_TOKEN_EXPIRY = MCP_SERVICE_CONFIG.TOKEN_CONFIG.expiry;
export const MCP_TOKEN_EXPIRY_SECONDS = MCP_SERVICE_CONFIG.TOKEN_CONFIG.expirySeconds;
export const MCP_SESSION_CLEANUP_INTERVAL = MCP_SERVICE_CONFIG.SESSION_CONFIG.cleanupInterval;
export const MCP_SESSION_MAX_AGE = MCP_SERVICE_CONFIG.SESSION_CONFIG.maxAge;

/**
 * MCP Capabilities
 */
export const MCP_CAPABILITIES = MCP_SERVICE_CONFIG.CAPABILITIES.basic;
export const MCP_DETAILED_CAPABILITIES = MCP_SERVICE_CONFIG.CAPABILITIES.detailed;

/**
 * MCP Server Info Object
 */
export const MCP_SERVER_INFO = MCP_SERVICE_CONFIG.SERVER_INFO;

/**
 * Transport Configuration
 */
export const MCP_TRANSPORT_TYPE = 'streamable-http';

/**
 * Get frontend URL for OAuth redirects
 */
export function getFrontendUrl(): string {
  const frontendUrl = process.env.FRONTEND_BASE_URL || 
    (process.env.NODE_ENV === 'production' ? 'https://shipbuilder.app' : 'http://localhost:5173');
  
  return frontendUrl;
}

/**
 * Get MCP service base URL
 */
export function getMCPServiceUrl(req: any): string {
  // In development, use localhost:3002
  // In production, use the actual domain with forced HTTPS
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:${process.env.PORT || 3002}`;
  }
  
  // Force HTTPS in production (handles load balancer/proxy scenarios)
  return `https://${req.get('host')}`;
}

/**
 * Generate OAuth discovery metadata
 */
export function generateOAuthDiscoveryMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    // OAuth 2.1: Only secure response types
    response_types_supported: ['code'],
    // OAuth 2.1: Authorization code grant with refresh token support
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // OAuth 2.1: PKCE is required, only S256 method
    code_challenge_methods_supported: ['S256'],
    // OAuth 2.1: PKCE is required for all clients
    require_pkce: true,
    scopes_supported: MCP_OAUTH_SCOPES,
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    // OAuth 2.1: Additional security metadata
    revocation_endpoint: `${baseUrl}/revoke`,
    introspection_endpoint: `${baseUrl}/introspect`,
    // OAuth 2.1: Recommended security features
    authorization_response_iss_parameter_supported: true,
    require_signed_request_object: false,
    request_parameter_supported: false,
    request_uri_parameter_supported: false
  };
}

/**
 * Generate OAuth protected resource metadata
 */
export function generateOAuthProtectedResourceMetadata(baseUrl: string) {
  return {
    resource: baseUrl,
    authorization_servers: [baseUrl],
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    bearer_methods_supported: MCP_OAUTH_BEARER_METHODS,
    resource_documentation: baseUrl,
    scopes_supported: MCP_OAUTH_SCOPES,
    mcp_endpoint: baseUrl,
    base_url: baseUrl,
  };
}

/**
 * Generate MCP server info response
 */
export function generateMCPServerInfo(baseUrl: string) {
  return {
    name: MCP_SERVER_DISPLAY_NAME,
    version: MCP_SERVER_VERSION,
    description: MCP_SERVER_DESCRIPTION,
    protocol_version: MCP_PROTOCOL_VERSION,
    capabilities: MCP_CAPABILITIES,
    server_info: MCP_SERVER_INFO,
    authentication: {
      type: 'oauth',
      oauth_version: '2.1',
      authorization_endpoint: `${baseUrl}/api/auth/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      discovery_endpoint: `${baseUrl}/.well-known/oauth-authorization-server`,
      // OAuth 2.1: Secure grant types with refresh token support
      grants_supported: ['authorization_code', 'refresh_token'],
      // OAuth 2.1: PKCE required for all clients
      pkce_required: true,
      pkce_methods_supported: ['S256'],
      scopes_supported: MCP_OAUTH_SCOPES,
      // OAuth 2.1: Security recommendations
      require_https: process.env.NODE_ENV === 'production',
      response_types_supported: ['code']
    },
    mcp_version: MCP_PROTOCOL_VERSION,
    transport: MCP_TRANSPORT_TYPE,
  };
}