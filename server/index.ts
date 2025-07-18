import './instrument.js'
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import { projectRoutes } from './routes/projects.js';
import { chatRoutes } from './routes/chat.js';
import { aiRoutes } from './routes/ai.js';
import authRoutes from './routes/auth.js';
import apiKeyRoutes from './routes/api-keys.js';
import { mcpRoutes } from './routes/mcp.js';
import { authenticateUser } from './middleware/auth.js';
import { apiRateLimit } from './middleware/rate-limit.js';
import { loggingMiddleware, errorLoggingMiddleware } from './middleware/logging.js';
import { setupSwagger } from './swagger.js';
import { logger } from './lib/logger.js';
import * as Sentry from "@sentry/node";

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for proper IP detection in rate limiting
app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'baggage', 
    'sentry-trace',
    'X-Requested-With',
    'Accept',
    'Origin',
    'MCP-Protocol-Version',
    'MCP-Session-Id',
    'sessionId'
  ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use(loggingMiddleware);

// Setup Swagger documentation
setupSwagger(app);

Sentry.setupExpressErrorHandler(app);

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes (require authentication and rate limiting)
app.use('/api/projects', apiRateLimit, authenticateUser, projectRoutes);
app.use('/api/chat', apiRateLimit, authenticateUser, chatRoutes);
app.use('/api/ai', apiRateLimit, authenticateUser, aiRoutes);
app.use('/api/api-keys', authenticateUser, apiKeyRoutes); // Note: API key routes have their own rate limiting

// OAuth Discovery routes (must be at root level)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/mcp/token`,
    registration_endpoint: `${baseUrl}/register`,
    scopes_supported: ['projects:read', 'tasks:read'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    authorization_code_expires_in: 600,
    access_token_expires_in: 2592000, // 30 days
    mcp_server_info: {
      name: 'Shipbuilder MCP Server',
      version: '1.0.0',
      mcp_endpoint: `${baseUrl}/mcp`,
    },
  });
});

app.get('/.well-known/oauth-protected-resource', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [`${baseUrl}`],
    scopes_supported: ['projects:read', 'tasks:read'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/mcp`,
    mcp_server_info: {
      name: 'Shipbuilder MCP Server',
      version: '1.0.0',
      tools: ['query_projects', 'query_tasks'],
    },
  });
});

app.post('/register', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  // Generate a simple client ID for this registration
  const clientId = `mcp_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info('MCP client registration request', {
    clientId,
    requestBody: req.body,
    userAgent: req.headers['user-agent'],
  });
  
  // Return a successful client registration
  res.status(201).json({
    client_id: clientId,
    client_name: 'MCP Client',
    grant_types: ['authorization_code'],
    response_types: ['code'],
    redirect_uris: req.body.redirect_uris || [`${baseUrl}/mcp/callback`],
    scope: 'projects:read tasks:read',
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/mcp/token`,
    mcp_endpoint: `${baseUrl}/mcp`,
    registration_client_uri: `${baseUrl}/register/${clientId}`,
    created_at: new Date().toISOString(),
  });
});

// Authorization endpoint - redirect to frontend for login
app.get('/api/auth/authorize', (req, res) => {
  const { response_type, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = req.query;
  
  // Create OAuth params to pass to frontend
  const oauthParams = {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  };
  
  // Encode the OAuth params to pass to frontend
  const encodedParams = encodeURIComponent(JSON.stringify(oauthParams));
  
  // Redirect to frontend with OAuth params
  const frontendUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
  const redirectUrl = `${frontendUrl}/mcp-login?oauth_params=${encodedParams}`;
  
  logger.info('MCP OAuth authorization request', {
    oauthParams,
    redirectUrl,
    userAgent: req.headers['user-agent'],
  });
  
  // Redirect user to frontend for OAuth flow
  res.redirect(redirectUrl);
});

// MCP routes (Model Context Protocol)
app.use('/mcp', mcpRoutes);

<<<<<<< HEAD
// Mount .well-known endpoints at root level for proper discovery
app.use('/.well-known', mcpRoutes);

=======
>>>>>>> origin/main

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add error logging middleware (should be last)
app.use(errorLoggingMiddleware);

const server = app.listen(PORT, () => {
  logger.info(`Server started successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`MCP endpoint available at http://localhost:${PORT}/mcp`);
});