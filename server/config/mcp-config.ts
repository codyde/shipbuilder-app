/**
 * MCP Configuration Constants
 * 
 * This file contains all configuration constants for the Shipbuilder MCP server.
 * Centralizes protocol versions, server info, OAuth scopes, timeouts, and other
 * hardcoded values that were previously scattered throughout the codebase.
 */

/**
 * MCP Protocol and Server Information
 */
export const MCP_PROTOCOL_VERSION = '2025-03-26';
export const MCP_SERVER_NAME = 'shipbuilder-mcp';
export const MCP_SERVER_VERSION = '1.0.0';
export const MCP_SERVER_DISPLAY_NAME = 'Shipbuilder MCP Server';
export const MCP_SERVER_DESCRIPTION = 'Model Context Protocol server for Shipbuilder project management';

/**
 * OAuth Configuration
 */
export const MCP_OAUTH_SCOPES = ['projects:read', 'tasks:read'];
export const MCP_OAUTH_RESPONSE_TYPES = ['code'];
export const MCP_OAUTH_GRANT_TYPES = ['authorization_code'];
export const MCP_OAUTH_CODE_CHALLENGE_METHODS = ['S256', 'plain'];
export const MCP_OAUTH_TOKEN_AUTH_METHODS = ['client_secret_basic', 'client_secret_post', 'none'];
export const MCP_OAUTH_BEARER_METHODS = ['header'];

/**
 * Token and Session Configuration
 */
export const MCP_TOKEN_EXPIRY = '30d';
export const MCP_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds
export const MCP_SESSION_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
export const MCP_SESSION_MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

/**
 * MCP Capabilities
 */
export const MCP_CAPABILITIES = {
  tools: true,
  resources: false,
  prompts: false,
  logging: false,
} as const;

/**
 * Detailed MCP Capabilities for initialization
 */
export const MCP_DETAILED_CAPABILITIES = {
  tools: {
    listChanged: false
  },
  resources: {},
  prompts: {},
  logging: {}
} as const;

/**
 * MCP Server Info Object
 */
export const MCP_SERVER_INFO = {
  name: MCP_SERVER_NAME,
  version: MCP_SERVER_VERSION,
} as const;

/**
 * Transport Configuration
 */
export const MCP_TRANSPORT_TYPE = 'streamable-http';

/**
 * Default Frontend URL (used for OAuth redirects and proxy detection)
 */
export const DEFAULT_FRONTEND_URL = 'http://localhost:5173';

/**
 * Helper function to get base URL based on request headers
 */
export function getBaseUrl(req: { headers: Record<string, string | string[] | undefined>; protocol: string; get: (name: string) => string | undefined }): string {
  const isProxiedRequest = req.headers['x-forwarded-host'] || req.headers['x-forwarded-proto'] || req.headers['x-forwarded-for'];
  
  if (isProxiedRequest) {
    const frontendUrl = process.env.FRONTEND_BASE_URL || DEFAULT_FRONTEND_URL;
    return `http://${frontendUrl.replace(/^https?:\/\//, '')}`;
  }
  
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * Generate OAuth discovery metadata
 */
export function generateOAuthDiscoveryMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/mcp/token`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: MCP_OAUTH_RESPONSE_TYPES,
    grant_types_supported: MCP_OAUTH_GRANT_TYPES,
    code_challenge_methods_supported: MCP_OAUTH_CODE_CHALLENGE_METHODS,
    scopes_supported: MCP_OAUTH_SCOPES,
    token_endpoint_auth_methods_supported: MCP_OAUTH_TOKEN_AUTH_METHODS,
    introspection_endpoint: `${baseUrl}/mcp/introspect`,
    revocation_endpoint: `${baseUrl}/mcp/revoke`,
  };
}

/**
 * Generate OAuth protected resource metadata
 */
export function generateOAuthProtectedResourceMetadata(baseUrl: string) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    bearer_methods_supported: MCP_OAUTH_BEARER_METHODS,
    resource_documentation: `${baseUrl}/mcp`,
    scopes_supported: MCP_OAUTH_SCOPES,
    mcp_endpoint: `${baseUrl}/mcp`,
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
      token_endpoint: `${baseUrl}/mcp/token`,
      discovery_endpoint: `${baseUrl}/.well-known/oauth-authorization-server`,
      grants_supported: MCP_OAUTH_GRANT_TYPES,
      pkce_required: true,
      scopes_supported: MCP_OAUTH_SCOPES,
    },
    mcp_version: MCP_PROTOCOL_VERSION,
    transport: MCP_TRANSPORT_TYPE,
  };
}