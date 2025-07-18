import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { mcpRoutes } from './routes/mcp.js';
import { authRoutes } from './routes/auth.js';
import { corsMiddleware } from './middleware/cors.js';
import { loggingMiddleware } from './middleware/logging.js';
import { 
  getFrontendUrl, 
  getMCPServiceUrl,
  generateOAuthDiscoveryMetadata,
  generateOAuthProtectedResourceMetadata,
  MCP_OAUTH_SCOPES
} from './config/mcp-config.js';
import { logger } from './utils/logger.js';

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  logger.info('Sentry initialized', { 
    environment: process.env.NODE_ENV || 'development' 
  });
}

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API service
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// CORS configuration
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(loggingMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'shipbuilder-mcp-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// OAuth Discovery routes (must be at root level)
app.get('/.well-known/oauth-authorization-server', (req: any, res: any) => {
  const baseUrl = getMCPServiceUrl(req);
  res.json(generateOAuthDiscoveryMetadata(baseUrl));
});

app.get('/.well-known/oauth-protected-resource', (req: any, res: any) => {
  const baseUrl = getMCPServiceUrl(req);
  res.json(generateOAuthProtectedResourceMetadata(baseUrl));
});

// JWKS endpoint (JSON Web Key Set)
app.get('/.well-known/jwks.json', (req: any, res: any) => {
  // For this MCP service, we use symmetric JWT tokens
  // In a production environment, you might want to use asymmetric keys
  res.json({
    keys: [
      // For symmetric keys used with HS256, we don't expose the actual secret
      // This is a placeholder to satisfy OAuth discovery requirements
      {
        kty: 'oct', // Key type: symmetric key
        use: 'sig', // Usage: signature
        alg: 'HS256', // Algorithm
        k: 'placeholder' // This would normally be the key, but we keep it secret
      }
    ]
  });
});

// OAuth 2.1 Dynamic Client Registration endpoint (RFC 7591 + OAuth 2.1 security requirements)
app.post('/register', (req: any, res: any) => {
  try {
    // Log the incoming request for debugging
    logger.info('Client registration request received', {
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });
    
    const { 
      client_name, 
      redirect_uris, 
      grant_types = ['authorization_code'],
      response_types = ['code'],
      scope,
      token_endpoint_auth_method = 'none'
    } = req.body;
    
    // OAuth 2.1 requires PKCE for public clients
    const isPublicClient = token_endpoint_auth_method === 'none';
    
    // Validate required parameters
    if (!client_name) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_name is required'
      });
    }
    
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'redirect_uris must be a non-empty array'
      });
    }
    
    // OAuth 2.1: Validate that grant_types are secure
    // Note: 'refresh_token' in grant_types means client wants refresh tokens, not that it's a separate grant flow
    const allowedGrantTypes = ['authorization_code', 'refresh_token'];
    if (grant_types.some((type: string) => !allowedGrantTypes.includes(type))) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Only authorization_code and refresh_token grant types are supported (OAuth 2.1 requirement)'
      });
    }
    
    // OAuth 2.1: Strict redirect URI validation
    for (const uri of redirect_uris) {
      try {
        const parsedUri = new URL(uri);
        
        // OAuth 2.1: HTTPS required except for localhost
        if (parsedUri.protocol !== 'https:' && 
            !parsedUri.hostname.match(/^(localhost|127\.0\.0\.1|\[::1\])$/)) {
          return res.status(400).json({
            error: 'invalid_redirect_uri',
            error_description: `OAuth 2.1 requires HTTPS for redirect URIs (except localhost): ${uri}`
          });
        }
        
        // OAuth 2.1: No fragments allowed
        if (parsedUri.hash) {
          return res.status(400).json({
            error: 'invalid_redirect_uri',
            error_description: `OAuth 2.1 prohibits fragments in redirect URIs: ${uri}`
          });
        }
        
      } catch {
        return res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: `Invalid redirect URI format: ${uri}`
        });
      }
    }
    
    // Generate client credentials
    const clientId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientSecret = token_endpoint_auth_method !== 'none' ? 
      `secret_${Date.now()}_${Math.random().toString(36).substr(2, 16)}` : undefined;
    
    // Current timestamp
    const now = Math.floor(Date.now() / 1000);
    
    logger.info('OAuth client registration', {
      client_name,
      client_id: clientId,
      redirect_uris,
      grant_types,
      response_types,
      scope
    });
    
    // Return OAuth 2.1 compliant client registration response
    const response: any = {
      client_id: clientId,
      client_name,
      redirect_uris,
      grant_types: grant_types, // Return the requested grant types
      response_types: ['code'], // OAuth 2.1: Only authorization code flow
      token_endpoint_auth_method: isPublicClient ? 'none' : 'client_secret_basic',
      require_auth_time: false,
      require_pushed_authorization_requests: false,
      client_id_issued_at: now,
      // OAuth 2.1: PKCE is required for public clients
      ...(isPublicClient && { 
        code_challenge_methods_supported: ['S256'],
        require_pkce: true 
      }),
      // Add scope if provided, default to our supported scopes
      scope: scope || MCP_OAUTH_SCOPES.join(' ')
    };
    
    // Add client secret if required
    if (clientSecret) {
      response.client_secret = clientSecret;
      response.client_secret_expires_at = 0; // Never expires
    }
    
    // Set proper headers for OAuth client registration response
    res.set({
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    });
    
    logger.info('Client registration successful', {
      client_id: clientId,
      client_name,
      redirect_uris
    });
    
    res.status(201).json(response);
    
  } catch (error) {
    logger.error('Client registration error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });
    
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error during client registration'
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
// Mount MCP routes at root level
app.use('/', mcpRoutes);

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    available_endpoints: {
      health: 'GET /health',
      mcp: 'GET|POST /',
      oauth_auth: 'GET /api/auth/authorize',
      oauth_consent: 'POST /api/auth/consent',
      oauth_token: 'POST /token',
      oauth_register: 'POST /register',
      oauth_discovery: 'GET /.well-known/oauth-authorization-server',
      oauth_jwks: 'GET /.well-known/jwks.json'
    }
  });
});

// Error handling
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('🚀 MCP Service started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    mcpEndpoint: `http://localhost:${PORT}`,
    frontendUrl: getFrontendUrl(),
    pid: process.pid
  });
  
  console.log(`🚀 MCP Service running on port ${PORT}`);
  console.log(`📡 MCP endpoint: http://localhost:${PORT}`);
  console.log(`🔗 Frontend URL: ${getFrontendUrl()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export { app };