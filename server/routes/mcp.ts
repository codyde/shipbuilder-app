import express from 'express';
import { ShipbuilderMCPServer } from '../services/mcp-server.js';
import { authenticateUser } from '../middleware/auth.js';
import { OAuthService } from '../services/oauth-service.js';
import { logger } from '../lib/logger.js';
import jwt from 'jsonwebtoken';
import * as Sentry from '@sentry/node';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

export const mcpRoutes = express.Router();

/**
 * OAuth 2.1 Discovery Endpoints
 */

/**
 * GET /.well-known/oauth-authorization-server - OAuth Authorization Server Metadata (RFC 8414)
 */
mcpRoutes.get('/.well-known/oauth-authorization-server', (req: any, res: any) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/mcp/token`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256', 'plain'],
    scopes_supported: ['projects:read', 'tasks:read'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    introspection_endpoint: `${baseUrl}/mcp/introspect`,
    revocation_endpoint: `${baseUrl}/mcp/revoke`,
  });
});

/**
 * GET /.well-known/oauth-protected-resource - Protected Resource Metadata
 */
mcpRoutes.get('/.well-known/oauth-protected-resource', (req: any, res: any) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/mcp`,
    scopes_supported: ['projects:read', 'tasks:read'],
    // Add explicit URLs for debugging
    mcp_endpoint: `${baseUrl}/mcp`,
    base_url: baseUrl,
  });
});



// Store active MCP sessions with transport
const mcpSessions = new Map<string, { 
  mcpServer: ShipbuilderMCPServer; 
  transport: SSEServerTransport;
  userId: string; 
  createdAt: Date 
}>();

/**
 * Cleanup old sessions (run every 30 minutes)
 */
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of mcpSessions.entries()) {
    // Remove sessions older than 2 hours
    if (now - session.createdAt.getTime() > 2 * 60 * 60 * 1000) {
      session.mcpServer.clearAuthContext();
      session.transport.close();
      mcpSessions.delete(sessionId);
      logger.info('Cleaned up expired MCP session', { sessionId, userId: session.userId });
    }
  }
}, 30 * 60 * 1000);

/**
 * GET /mcp - Provides server info OR establishes SSE connection
 */
mcpRoutes.get('/', async (req: any, res: any) => {
  // Check if this is an SSE connection request (has Authorization header)
  const authHeader = req.headers.authorization;
  const acceptHeader = req.headers.accept || '';
  
  if (authHeader && acceptHeader.includes('text/event-stream')) {
    // This is an SSE connection request - delegate to SSE handler
    return mcpSSEHandler(req, res);
  }
  
  // Otherwise, return server info
  res.json({
    name: 'Shipbuilder MCP Server',
    version: '1.0.0',
    description: 'Model Context Protocol server for Shipbuilder project management',
    protocol_version: '2025-03-26',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
      logging: false,
    },
    server_info: {
      name: 'shipbuilder-mcp',
      version: '1.0.0',
    },
    authentication: {
      type: 'oauth',
      oauth_version: '2.1',
      authorization_endpoint: `${req.protocol}://${req.get('host')}/api/auth/authorize`,
      token_endpoint: `${req.protocol}://${req.get('host')}/mcp/token`,
      discovery_endpoint: `${req.protocol}://${req.get('host')}/.well-known/oauth-authorization-server`,
      grants_supported: ['authorization_code'],
      pkce_required: true,
      scopes_supported: ['projects:read', 'tasks:read'],
    },
    tools: [
      {
        name: 'query_projects',
        description: 'Get all projects for the authenticated user',
      },
      {
        name: 'query_tasks', 
        description: 'Get tasks for a specific project',
      },
    ],
    mcp_version: '2025-03-26',
    transport: 'streamable-http',
  });
});

/**
 * POST /mcp/token - OAuth token exchange for MCP access
 * Handles both direct JWT exchange and OAuth code exchange
 */
mcpRoutes.post('/token', async (req: any, res: any) => {
  try {
    // Debug logging for request details
    logger.info('MCP token request received', {
      headers: req.headers,
      body: req.body,
      contentType: req.headers['content-type'],
      bodyType: typeof req.body,
      hasBody: !!req.body,
      rawBody: req.rawBody,
    });

    // Handle different content types
    let parsedBody = req.body || {};
    
    // If body is empty but we have a content-type, try to parse manually
    if (!req.body && req.headers['content-type']) {
      const contentType = req.headers['content-type'];
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // Body should already be parsed by express.urlencoded()
        parsedBody = req.body || {};
      } else if (contentType.includes('application/json')) {
        // Body should already be parsed by express.json()
        parsedBody = req.body || {};
      }
    }

    const { grant_type, code, redirect_uri, client_id, code_verifier } = parsedBody;
    
    // Handle OAuth 2.1 Authorization Code flow
    if (grant_type === 'authorization_code' && code) {
      try {
        // Validate required parameters
        if (!client_id || !redirect_uri) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing required parameters: client_id, redirect_uri'
          });
        }

        // Validate and consume the authorization code
        const validation = await OAuthService.validateAndConsumeAuthorizationCode({
          authorization_code: code,
          client_id,
          redirect_uri,
          code_verifier,
        });

        if (!validation.valid) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: validation.error || 'Invalid authorization code'
          });
        }

        // Get user details for token
        const { databaseService } = await import('../db/database-service.js');
        const user = await databaseService.getUserById(validation.userId!);
        
        logger.info('User lookup for token generation', {
          userId: validation.userId,
          userFound: !!user,
          userEmail: user?.email,
        });
        
        if (!user) {
          logger.error('User not found for token generation', {
            userId: validation.userId,
          });
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'User not found'
          });
        }

        // Create MCP access token
        const mcpToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            name: user.name,
            type: 'mcp',
            scope: 'projects:read tasks:read',
            aud: client_id, // Resource indicator
          },
          process.env.JWT_SECRET!,
          { expiresIn: '30d' }
        );

        logger.info('MCP token generated via OAuth 2.1 flow', {
          userId: user.id,
          email: user.email,
          clientId: client_id,
        });

        return res.json({
          access_token: mcpToken,
          token_type: 'Bearer',
          expires_in: 30 * 24 * 60 * 60,
          scope: 'projects:read tasks:read',
        });
        
      } catch (error) {
        logger.error('OAuth 2.1 token exchange failed', {
          error: error instanceof Error ? error.message : String(error),
          clientId: client_id,
        });
        
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to process authorization code'
        });
      }
    }
    
    // Handle direct JWT token exchange (existing flow)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        
        if (typeof decoded === 'object' && decoded.userId) {
          const mcpToken = jwt.sign(
            {
              userId: decoded.userId,
              email: decoded.email,
              name: decoded.name,
              type: 'mcp',
            },
            process.env.JWT_SECRET!,
            { expiresIn: '30d' }
          );

          logger.info('MCP token generated via direct JWT exchange', {
            userId: decoded.userId,
            email: decoded.email,
          });

          return res.json({
            access_token: mcpToken,
            token_type: 'Bearer',
            expires_in: 30 * 24 * 60 * 60,
            scope: 'projects:read tasks:read',
            mcp_endpoint: `${req.protocol}://${req.get('host')}/mcp`,
            instructions: {
              usage: 'Use this token in the Authorization header: Bearer <token>',
              endpoint: `${req.protocol}://${req.get('host')}/mcp`,
              headers: {
                'Authorization': 'Bearer <token>',
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'MCP-Protocol-Version': '2025-03-26'
              },
            },
          });
        }
      } catch (jwtError) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    return res.status(400).json({ 
      error: 'invalid_request',
      error_description: 'Missing required parameters. Provide either authorization code or Bearer token.'
    });

  } catch (error) {
    logger.error('Failed to generate MCP token', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });
    
    Sentry.captureException(error, {
      tags: { component: 'mcp_token_generation' },
    });
    
    res.status(500).json({ 
      error: 'server_error',
      error_description: 'Failed to generate MCP token'
    });
  }
});

/**
 * GET /mcp/authorize - OAuth 2.1 Authorization Endpoint
 */
mcpRoutes.get('/authorize', async (req: any, res: any) => {
  try {
    const { 
      response_type, 
      client_id, 
      redirect_uri, 
      scope, 
      state, 
      code_challenge, 
      code_challenge_method 
    } = req.query;

    // Validate required parameters
    if (response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported'
      });
    }

    if (!client_id || !redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri'
      });
    }

    // Validate PKCE parameters (required for OAuth 2.1)
    if (!code_challenge || !code_challenge_method) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'PKCE parameters required: code_challenge, code_challenge_method'
      });
    }

    if (!['S256', 'plain'].includes(code_challenge_method)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'code_challenge_method must be S256 or plain'
      });
    }

    // Generate authorization code
    const authorizationCode = OAuthService.generateAuthorizationCode({
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      scope,
      state,
    });

    logger.info('OAuth authorization initiated', {
      client_id,
      redirect_uri,
      authorization_code: authorizationCode.substring(0, 8) + '...',
    });

    // Store OAuth params for the consent screen
    const oauthParams = {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      authorization_code: authorizationCode,
    };

    // Redirect to consent screen
    const consentUrl = new URL('/mcp-login', process.env.FRONTEND_BASE_URL || 'http://localhost:5173');
    consentUrl.searchParams.set('oauth_params', encodeURIComponent(JSON.stringify(oauthParams)));
    
    res.redirect(consentUrl.toString());

  } catch (error) {
    logger.error('OAuth authorization failed', {
      error: error instanceof Error ? error.message : String(error),
      query: req.query,
    });

    Sentry.captureException(error, {
      tags: { component: 'mcp_oauth_authorize' },
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process authorization request'
    });
  }
});

/**
 * POST /mcp/consent - Handle user consent for OAuth authorization
 */
mcpRoutes.post('/consent', authenticateUser, async (req: any, res: any) => {
  try {
    const { authorization_code, action } = req.body; // action: 'approve' | 'deny'
    const userId = req.user.userId;

    if (!authorization_code) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'authorization_code is required'
      });
    }

    if (!action || !['approve', 'deny'].includes(action)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'action must be "approve" or "deny"'
      });
    }

    const codeDetails = OAuthService.getAuthorizationCodeDetails(authorization_code);
    if (!codeDetails) {
      return res.status(404).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
    }

    if (action === 'approve') {
      const success = OAuthService.approveAuthorizationCode(authorization_code, userId);
      if (!success) {
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to approve authorization'
        });
      }

      logger.info('OAuth authorization approved', {
        authorization_code: authorization_code.substring(0, 8) + '...',
        user_id: userId,
        client_id: codeDetails.client_id,
      });

      // Return success with redirect URL
      const redirectUrl = new URL(codeDetails.redirect_uri);
      redirectUrl.searchParams.set('code', authorization_code);
      if (codeDetails.state) {
        redirectUrl.searchParams.set('state', codeDetails.state);
      }

      res.json({
        success: true,
        redirect_uri: redirectUrl.toString(),
      });
    } else {
      // User denied authorization
      const redirectUrl = new URL(codeDetails.redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User denied authorization');
      if (codeDetails.state) {
        redirectUrl.searchParams.set('state', codeDetails.state);
      }

      res.json({
        success: false,
        redirect_uri: redirectUrl.toString(),
      });
    }

  } catch (error) {
    logger.error('OAuth consent failed', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
      user_id: req.user?.userId,
    });

    Sentry.captureException(error, {
      tags: { component: 'mcp_oauth_consent' },
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process consent'
    });
  }
});

/**
 * Handle SSE connection for MCP
 */
async function mcpSSEHandler(req: any, res: any) {
  try {
    // Authenticate the request
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Provide token via Authorization header'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid or expired token'
      });
    }
    
    if (typeof decoded !== 'object' || decoded.type !== 'mcp') {
      return res.status(401).json({ 
        error: 'Invalid token type',
        message: 'Use an MCP token obtained from /mcp/token'
      });
    }

    logger.info('MCP SSE connection request', {
      userId: decoded.userId,
      userAgent: req.headers['user-agent'],
    });

    // Create MCP server instance
    const mcpServer = new ShipbuilderMCPServer();
    mcpServer.setAuthContext({
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name,
    });

    // Create SSE transport
    const transport = new SSEServerTransport('/mcp', res, {
      enableDnsRebindingProtection: false,
    });

    // Connect server to transport
    await mcpServer.getServer().connect(transport);
    
    // Store session
    mcpSessions.set(transport.sessionId, {
      mcpServer,
      transport,
      userId: decoded.userId,
      createdAt: new Date(),
    });

    logger.info('MCP SSE transport connected', {
      sessionId: transport.sessionId,
      userId: decoded.userId,
    });

    // Handle transport events
    transport.onclose = () => {
      logger.info('MCP transport closed', {
        sessionId: transport.sessionId,
        userId: decoded.userId,
      });
      mcpSessions.delete(transport.sessionId);
      mcpServer.clearAuthContext();
    };

    transport.onerror = (error) => {
      logger.error('MCP transport error', {
        sessionId: transport.sessionId,
        userId: decoded.userId,
        error: error.message,
      });
    };

  } catch (error) {
    logger.error('Failed to establish MCP SSE connection', {
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: 'Failed to establish MCP connection',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * MCP Authentication Middleware
 */
const mcpAuthMiddleware = (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Provide token via Authorization header'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    
    if (typeof decoded === 'object' && decoded.type !== 'mcp') {
      return res.status(401).json({ 
        error: 'Invalid token type',
        message: 'Use an MCP token obtained from /mcp/token'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Validate MCP request headers
 */
const validateMCPHeaders = (req: any, res: any, next: any) => {
  const accept = req.headers.accept;
  const mcpVersion = req.headers['mcp-protocol-version'];

  logger.info('MCP message request received', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    hasAccept: !!accept,
    hasMCPVersion: !!mcpVersion,
  });

  if (!accept || (!accept.includes('application/json') && !accept.includes('text/event-stream') && !accept.includes('*/*'))) {
    logger.warn('MCP request missing Accept header', {
      accept,
      headers: req.headers,
    });
    return res.status(400).json({
      error: 'Invalid Accept header',
      message: 'Must include application/json, text/event-stream, or */*',
      received_accept: accept,
    });
  }

  if (!mcpVersion) {
    logger.info('MCP request without MCP-Protocol-Version header - allowing request', {
      method: req.method,
      userAgent: req.headers['user-agent'],
    });
    // Don't require MCP-Protocol-Version header - many clients don't send it
  }

  next();
};

/**
 * MCP Session-based auth middleware - allows authenticated sessions to proceed
 */
const mcpSessionAuthMiddleware = (req: any, res: any, next: any) => {
  // Get session ID from header or query parameter
  const sessionId = req.headers['mcp-session-id'] || req.query.sessionId;
  
  if (sessionId && mcpSessions.has(sessionId)) {
    // Session exists, use the authenticated user from the session
    const session = mcpSessions.get(sessionId);
    const authContext = session!.mcpServer.getAuthContext();
    req.user = {
      userId: session!.userId,
      email: authContext?.email,
      name: authContext?.name,
    };
    return next();
  }
  
  // No valid session, fall back to token auth
  return mcpAuthMiddleware(req, res, next);
};

/**
 * POST /mcp - Handle incoming MCP messages using SDK transport
 */
mcpRoutes.post('/', mcpSessionAuthMiddleware, validateMCPHeaders, async (req: any, res: any) => {
  try {
    // Get session ID from header or query parameter, or create a new one for stateless mode
    let sessionId = req.headers['mcp-session-id'] || req.query.sessionId;
    
    logger.info('MCP POST message received', {
      sessionId,
      userId: req.user.userId,
      method: req.body?.method,
      hasBody: !!req.body,
      hasSessionIdHeader: !!req.headers['mcp-session-id'],
      hasSessionIdQuery: !!req.query.sessionId,
      activeSessions: Array.from(mcpSessions.keys()),
      allHeaders: req.headers,
    });

    // Try to find an active session for this user if no explicit session ID provided
    if (!sessionId) {
      // Look for any active session for this user
      for (const [sid, session] of mcpSessions.entries()) {
        if (session.userId === req.user.userId) {
          sessionId = sid;
          logger.info('Found active session for user', {
            userId: req.user.userId,
            sessionId: sid,
          });
          break;
        }
      }
    }

    // For Claude Code and similar clients that don't establish SSE first,
    // create a session-less MCP server instance for direct requests
    if (!sessionId) {
      logger.info('Creating session-less MCP server for direct request', {
        userId: req.user.userId,
        method: req.body?.method,
      });

      const mcpServer = new ShipbuilderMCPServer();
      mcpServer.setAuthContext({
        userId: req.user.userId,
        email: req.user.email,
        name: req.user.name,
      });

      // Handle the request directly without transport
      const body = req.body;
      
      if (body && body.method) {
        let response;

        // Handle different MCP methods manually
        if (body.method === 'initialize') {
          response = {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {
                tools: {
                  listChanged: false
                },
                resources: {},
                prompts: {},
                logging: {}
              },
              serverInfo: {
                name: 'shipbuilder-mcp',
                version: '1.0.0'
              }
            }
          };
        } else if (body.method === 'notifications/initialized') {
          // Client acknowledges initialization - no response needed
          res.status(204).send();
          return;
        } else if (body.method === 'ping') {
          response = {
            jsonrpc: '2.0',
            id: body.id,
            result: {}
          };
        } else if (body.method === 'tools/list') {
          logger.info('MCP tools/list request received', {
            userId: req.user.userId,
            requestId: body.id,
          });
          
          response = {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              tools: [
                {
                  name: 'query_projects',
                  description: 'Get all projects for the authenticated user',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        enum: ['active', 'backlog', 'completed', 'archived'],
                        description: 'Filter projects by status'
                      },
                      include_tasks: {
                        type: 'boolean',
                        default: true,
                        description: 'Whether to include tasks in the response'
                      }
                    }
                  }
                },
                {
                  name: 'query_tasks',
                  description: 'Get tasks for a specific project',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      project_id: {
                        type: 'string',
                        description: 'Project slug (e.g., "photoshare")'
                      },
                      status: {
                        type: 'string',
                        enum: ['backlog', 'in_progress', 'completed'],
                        description: 'Filter tasks by status'
                      },
                      priority: {
                        type: 'string',
                        enum: ['low', 'medium', 'high'],
                        description: 'Filter tasks by priority'
                      }
                    },
                    required: ['project_id']
                  }
                }
              ]
            }
          };
        } else if (body.method === 'prompts/list') {
          response = {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              prompts: []
            }
          };
        } else if (body.method === 'resources/list') {
          response = {
            jsonrpc: '2.0',
            id: body.id,
            result: {
              resources: []
            }
          };
        } else if (body.method === 'tools/call') {
          // Handle tool calls
          const toolName = body.params?.name;
          const toolArgs = body.params?.arguments || {};

          if (toolName === 'query_projects') {
            try {
              const result = await mcpServer.handleQueryProjectsPublic(toolArgs);
              response = {
                jsonrpc: '2.0',
                id: body.id,
                result
              };
            } catch (error) {
              response = {
                jsonrpc: '2.0',
                id: body.id,
                error: {
                  code: -32603,
                  message: error instanceof Error ? error.message : 'Internal error'
                }
              };
            }
          } else if (toolName === 'query_tasks') {
            try {
              const result = await mcpServer.handleQueryTasksPublic(toolArgs);
              response = {
                jsonrpc: '2.0',
                id: body.id,
                result
              };
            } catch (error) {
              response = {
                jsonrpc: '2.0',
                id: body.id,
                error: {
                  code: -32603,
                  message: error instanceof Error ? error.message : 'Internal error'
                }
              };
            }
          } else {
            response = {
              jsonrpc: '2.0',
              id: body.id,
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`
              }
            };
          }
        } else {
          // Unknown method
          response = {
            jsonrpc: '2.0',
            id: body.id,
            error: {
              code: -32601,
              message: `Method not found: ${body.method}`
            }
          };
        }

        logger.info('Sending MCP response (session-less)', {
          method: body.method,
          id: body.id,
          hasResult: !!response.result,
          hasError: !!response.error,
        });

        mcpServer.clearAuthContext();
        return res.status(200).json(response);
      }
      
      // Clean up
      mcpServer.clearAuthContext();
      return res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid request - no method provided'
        }
      });
    }

    // Session-based flow (for SSE clients)
    const session = mcpSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId,
      });
    }

    // Log the request before delegating to transport
    logger.info('Delegating MCP request to SSE transport', {
      sessionId,
      method: req.body?.method,
      id: req.body?.id,
      userId: req.user.userId,
    });

    // Let the transport handle the POST message
    await session.transport.handlePostMessage(req, res, req.body);

  } catch (error) {
    logger.error('MCP POST message failed', {
      sessionId: req.headers['mcp-session-id'],
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : String(error),
    });

    Sentry.captureException(error, {
      tags: { component: 'mcp_post_message' },
      user: { id: req.user?.userId, email: req.user?.email },
    });

    res.status(500).json({
      error: 'Failed to process MCP message',
    });
  }
});

/**
 * GET /mcp/test - Test MCP functionality with a sample request
 */
mcpRoutes.get('/test', mcpAuthMiddleware, async (req: any, res: any) => {
  try {
    const mcpServer = new ShipbuilderMCPServer();
    mcpServer.setAuthContext({
      userId: req.user.userId,
      email: req.user.email,
      name: req.user.name,
    });

    // Test tools/list
    const toolsResult = await mcpServer.getServer().handleRequest({
      jsonrpc: '2.0',
      id: 'test-1',
      method: 'tools/list',
      params: {},
    });

    // Test query_projects
    const projectsResult = await mcpServer.getServer().handleRequest({
      jsonrpc: '2.0',
      id: 'test-2', 
      method: 'tools/call',
      params: {
        name: 'query_projects',
        arguments: { include_tasks: false },
      },
    });

    mcpServer.clearAuthContext();

    res.json({
      success: true,
      message: 'MCP server test successful',
      user: {
        id: req.user.userId,
        email: req.user.email,
        name: req.user.name,
      },
      test_results: {
        tools_list: toolsResult,
        sample_projects: projectsResult,
      },
      mcp_info: {
        version: '2025-03-26',
        transport: 'streamable-http',
        endpoint: `${req.protocol}://${req.get('host')}/mcp`,
      },
    });

  } catch (error) {
    logger.error('MCP test failed', {
      userId: req.user?.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({ 
      error: 'MCP test failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});