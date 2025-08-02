import express from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ShipbuilderMCPServer } from '../services/mcp-server.js';
import { AuthService } from '../services/auth-service.js';
import { OAuthService } from '../services/oauth-service.js';
import { sessionService } from '../services/session-service.js';
import { mcpAuthMiddleware, authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import * as Sentry from '@sentry/node';
import { 
  MCP_TOOLS, 
  MCP_TOOLS_BASIC, 
  isValidToolName 
} from '../config/mcp-tools.js';
import {
  MCP_PROTOCOL_VERSION,
  MCP_OAUTH_SCOPES,
  MCP_TOKEN_EXPIRY,
  MCP_TOKEN_EXPIRY_SECONDS,
  MCP_DETAILED_CAPABILITIES,
  MCP_SERVER_INFO,
  getMCPServiceUrl
} from '../config/mcp-config.js';

const router = express.Router();
const authService = new AuthService();

// Global MCP server and transport instances
let globalMcpServer: ShipbuilderMCPServer | null = null;
let globalMcpTransport: StreamableHTTPServerTransport | null = null;
let transportStarted = false;

// Initialize global MCP infrastructure
async function initializeMCPInfrastructure() {
  if (!globalMcpServer || !globalMcpTransport) {
    // Create MCP server
    globalMcpServer = new ShipbuilderMCPServer();
    
    // Create transport
    globalMcpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: async (sessionId: string) => {
        logger.info('MCP session initialized', { sessionId: sessionId.slice(0, 8) + '...' });
      },
      onsessionclosed: async (sessionId: string) => {
        logger.info('MCP session closed', { sessionId: sessionId.slice(0, 8) + '...' });
      },
      enableJsonResponse: false,
      allowedHosts: process.env.NODE_ENV === 'production' ? 
        [process.env.ALLOWED_HOST || 'mcp.shipbuilder.app', 'localhost'] : undefined,
      enableDnsRebindingProtection: process.env.NODE_ENV === 'production'
    });
    
    logger.info('MCP infrastructure initialized');
  }
  
  // Connect server to transport only once
  if (!transportStarted && globalMcpTransport && globalMcpServer) {
    const mcpServerInstance = globalMcpServer.getServer();
    
    // SessionId is now automatically initialized by enhanced Sentry SDK patches
    // No manual pre-initialization needed - Sentry handles this transparently
    await mcpServerInstance.connect(globalMcpTransport);
    
    // IMPORTANT: Don't override onmessage after connect() - this breaks Sentry's instrumentation!
    // Sentry wraps onmessage during connect() to add MCP analytics tracking.
    // Our custom handler was breaking the transport context (this = undefined).
    
    logger.info('MCP server connected to transport with Sentry instrumentation intact');
    
    transportStarted = true;
    logger.info('MCP server connected to transport and message logging installed');
  }
  
  return { server: globalMcpServer, transport: globalMcpTransport };
}

/**
 * Unified MCP Streamable HTTP handler (MCP 2025-03-26 compliant)
 * Handles both GET (SSE) and POST (JSON-RPC) requests through StreamableHTTPServerTransport
 */
async function mcpStreamableHandler(req: any, res: any) {
  try {
    // Initialize MCP infrastructure
    const { server: mcpServer, transport: mcpTransport } = await initializeMCPInfrastructure();
    
    // REQUIRE authentication for ALL MCP requests
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'authentication_required',
        error_description: 'Authorization header is required for MCP access',
        message: 'Please provide a valid Bearer token to access the MCP server'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const userInfo = await authService.validateToken(token);
    
    if (!userInfo) {
      return res.status(401).json({ 
        error: 'invalid_token',
        error_description: 'Invalid or expired MCP token',
        message: 'Please authenticate with a valid token'
      });
    }
    
    // Set auth context on the global connected server instance
    mcpServer.setAuthContext({
      userId: userInfo.userId,
      email: userInfo.email,
      name: userInfo.name
    });
    
    // Verify auth context was set
    const currentAuth = mcpServer.getAuthContext();
    logger.info('Auth context set and verified', {
      userId: currentAuth?.userId,
      email: currentAuth?.email,
      contextSet: !!currentAuth,
      serverConnected: mcpServer.getServer().isConnected(),
      transportStarted: transportStarted
    });
    
    req.auth = {
      userId: userInfo.userId,
      email: userInfo.email,
      name: userInfo.name
    };
    
    // Let the connected transport handle the request directly
    try {
      logger.info('About to process request via transport', {
        method: req.method,
        url: req.url,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        userId: req.auth?.userId
      });
      
      await mcpTransport.handleRequest(req, res, req.body);
      
      logger.info('MCP request processed successfully via transport', {
        method: req.method,
        userId: req.auth?.userId,
        acceptHeader: req.headers.accept,
        responseWritten: res.headersSent,
        statusCode: res.statusCode
      });
    } catch (transportError) {
      logger.error('Transport request handling failed', {
        error: transportError instanceof Error ? transportError.message : String(transportError),
        stack: transportError instanceof Error ? transportError.stack : undefined,
        method: req.method,
        userId: req.auth?.userId
      });
      throw transportError;
    }
    
  } catch (error) {
    logger.error('Error in MCP streamable handler', {
      error: error instanceof Error ? error.message : String(error),
      method: req.method,
      userId: req.auth?.userId
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to handle MCP request'
      });
    }
  }
}

/**
 * GET / - Streamable HTTP transport: SSE stream endpoint
 */
router.get('/', mcpStreamableHandler);

/**
 * POST / - Streamable HTTP transport: JSON-RPC message endpoint
 */
router.post('/', mcpStreamableHandler);

/**
 * POST /token - OAuth token exchange for MCP access
 */
router.post('/token', async (req: any, res: any) => {
  try {
    logger.info('MCP token request received', {
      grant_type: req.body?.grant_type,
      client_id: req.body?.client_id,
      redirect_uri: req.body?.redirect_uri,
      code: req.body?.code?.substring(0, 8) + '...',
      code_verifier: req.body?.code_verifier ? 'present' : 'missing',
      contentType: req.headers['content-type'],
    });

    const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;
    
    // Validate grant_type parameter
    if (!grant_type) {
      logger.error('Missing grant_type parameter', { body: req.body });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameter: grant_type'
      });
    }
    
    // Handle OAuth 2.1 Authorization Code flow
    if (grant_type === 'authorization_code' && code) {
      try {
        // Validate required parameters
        if (!client_id || !redirect_uri) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing required parameters: client_id and redirect_uri'
          });
        }
        
        // Validate authorization code with PKCE
        const validation = await OAuthService.validateAndConsumeAuthorizationCode({
          authorization_code: code,
          client_id,
          redirect_uri,
          code_verifier
        });
        
        if (!validation.valid) {
          logger.warn('Authorization code validation failed', {
            client_id,
            redirect_uri,
            error: validation.error
          });
          
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: validation.error || 'Invalid authorization code'
          });
        }
        
        // Get real user data from the main app
        const userData = await authService.getUserById(validation.userId!);
        
        if (!userData) {
          logger.error('Failed to get user data for OAuth token generation', {
            userId: validation.userId,
            client_id
          });
          return res.status(500).json({
            error: 'server_error',
            error_description: 'Failed to retrieve user information'
          });
        }
        
        // Generate MCP access token with real user data
        const mcpToken = authService.generateMCPToken(
          userData.id,
          userData.email,
          userData.name,
          client_id
        );
        
        logger.info('MCP token generated successfully', {
          user_id: validation.userId,
          client_id,
          redirect_uri,
          token_prefix: mcpToken.substring(0, 16) + '...'
        });
        
        // Return OAuth 2.1 compliant token response
        res.json({
          access_token: mcpToken,
          token_type: 'Bearer',
          expires_in: MCP_TOKEN_EXPIRY_SECONDS,
          scope: MCP_OAUTH_SCOPES.join(' ')
        });
        
      } catch (error) {
        logger.error('OAuth code exchange error', {
          error: error instanceof Error ? error.message : String(error),
          client_id,
          redirect_uri
        });
        
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error during token exchange'
        });
      }
    }
    // Handle JWT token exchange (for development/testing)
    else if (grant_type === 'urn:ietf:params:oauth:grant-type:jwt-bearer') {
      const { assertion } = req.body;
      
      if (!assertion) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing assertion parameter for JWT bearer grant'
        });
      }
      
      try {
        // Validate the JWT assertion
        const userInfo = await authService.validateToken(assertion);
        
        if (!userInfo) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid JWT assertion'
          });
        }
        
        // Generate MCP token from JWT
        const mcpToken = authService.generateMCPToken(
          userInfo.userId,
          userInfo.email,
          userInfo.name
        );
        
        logger.info('JWT to MCP token exchange successful', {
          user_id: userInfo.userId,
          email: userInfo.email,
          token_prefix: mcpToken.substring(0, 16) + '...'
        });
        
        res.json({
          access_token: mcpToken,
          token_type: 'Bearer',
          expires_in: MCP_TOKEN_EXPIRY_SECONDS,
          scope: MCP_OAUTH_SCOPES.join(' ')
        });
        
      } catch (error) {
        logger.error('JWT exchange error', {
          error: error instanceof Error ? error.message : String(error)
        });
        
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error during JWT exchange'
        });
      }
    }
    else {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: `Grant type '${grant_type}' is not supported`
      });
    }
    
  } catch (error) {
    logger.error('Token exchange endpoint error', {
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
      error_description: 'Internal server error'
    });
  }
});

/**
 * GET /sessions/stats - Get session statistics (for monitoring)
 */
router.get('/sessions/stats', authMiddleware, async (req: any, res: any) => {
  try {
    const stats = await sessionService.getStats();
    const userSessions = await sessionService.getUserSessions(req.user.userId);
    
    res.json({
      global: stats,
      user: {
        sessions: userSessions.length,
        connections: userSessions.map(s => ({
          connectionId: s.connectionId,
          createdAt: s.createdAt,
          lastActivity: s.lastActivity,
          activeStreams: s.activeStreams.size,
          userAgent: s.userAgent
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get session stats', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId
    });
    
    res.status(500).json({ error: 'Failed to get session stats' });
  }
});

export { router as mcpRoutes };