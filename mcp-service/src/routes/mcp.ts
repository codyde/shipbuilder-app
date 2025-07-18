import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ShipbuilderMCPServer } from '../services/mcp-server.js';
import { AuthService } from '../services/auth-service.js';
import { OAuthService } from '../services/oauth-service.js';
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
  MCP_SESSION_CLEANUP_INTERVAL,
  MCP_SESSION_MAX_AGE,
  MCP_DETAILED_CAPABILITIES,
  MCP_SERVER_INFO,
  getMCPServiceUrl,
  getFrontendUrl,
  generateOAuthDiscoveryMetadata,
  generateOAuthProtectedResourceMetadata,
  generateMCPServerInfo
} from '../config/mcp-config.js';

const router = express.Router();
const authService = new AuthService();

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
    // Remove sessions older than configured max age
    if (now - session.createdAt.getTime() > MCP_SESSION_MAX_AGE) {
      session.mcpServer.clearAuthContext();
      session.transport.close();
      mcpSessions.delete(sessionId);
      logger.info('Cleaned up expired MCP session', { sessionId, userId: session.userId });
    }
  }
}, MCP_SESSION_CLEANUP_INTERVAL);

/**
 * GET / - Provides server info OR establishes SSE connection
 */
router.get('/', async (req: any, res: any) => {
  // Check if this is an SSE connection request (has Authorization header)
  const authHeader = req.headers.authorization;
  const acceptHeader = req.headers.accept || '';
  
  if (authHeader && acceptHeader.includes('text/event-stream')) {
    // This is an SSE connection request - delegate to SSE handler
    return mcpSSEHandler(req, res);
  }
  
  const baseUrl = getMCPServiceUrl(req);
  
  logger.info('MCP server info request', {
    baseUrl,
    userAgent: req.headers['user-agent'],
  });
  
  // Return server info with tools list
  const serverInfo = generateMCPServerInfo(baseUrl);
  res.json({
    ...serverInfo,
    tools: MCP_TOOLS_BASIC,
  });
});

/**
 * POST /token - OAuth token exchange for MCP access
 */
router.post('/token', async (req: any, res: any) => {
  try {
    logger.info('MCP token request received', {
      grant_type: req.body?.grant_type,
      client_id: req.body?.client_id,
      contentType: req.headers['content-type'],
    });

    const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;
    
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
        const user = await authService.getUserById(validation.userId!);
        
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
        const mcpToken = authService.generateMCPToken(
          user.id,
          user.email,
          user.name,
          client_id
        );

        logger.info('MCP token generated via OAuth 2.1 flow', {
          userId: user.id,
          email: user.email,
          clientId: client_id,
        });

        return res.json({
          access_token: mcpToken,
          token_type: 'Bearer',
          expires_in: MCP_TOKEN_EXPIRY_SECONDS,
          scope: MCP_OAUTH_SCOPES.join(' '),
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
    
    // Handle direct JWT token exchange (fallback for development)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const userInfo = await authService.validateMainAppToken(token);
        
        if (userInfo) {
          const mcpToken = authService.generateMCPToken(
            userInfo.userId,
            userInfo.email,
            userInfo.name
          );

          logger.info('MCP token generated via direct JWT exchange', {
            userId: userInfo.userId,
            email: userInfo.email,
          });

          return res.json({
            access_token: mcpToken,
            token_type: 'Bearer',
            expires_in: MCP_TOKEN_EXPIRY_SECONDS,
            scope: MCP_OAUTH_SCOPES.join(' '),
            mcp_endpoint: getMCPServiceUrl(req),
            instructions: {
              usage: 'Use this token in the Authorization header: Bearer <token>',
              endpoint: getMCPServiceUrl(req),
              headers: {
                'Authorization': 'Bearer <token>',
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'MCP-Protocol-Version': MCP_PROTOCOL_VERSION
              },
            },
          });
        }
      } catch (error) {
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
      body: req.body
    });
    
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'mcp_token_generation' },
      });
    }
    
    res.status(500).json({ 
      error: 'server_error',
      error_description: 'Failed to generate MCP token'
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

    const userInfo = await authService.validateMCPToken(token);
    if (!userInfo) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid or expired MCP token'
      });
    }

    logger.info('MCP SSE connection request', {
      userId: userInfo.userId,
      userAgent: req.headers['user-agent'],
    });

    // Create MCP server instance
    const mcpServer = new ShipbuilderMCPServer();
    mcpServer.setAuthContext({
      userId: userInfo.userId,
      email: userInfo.email,
      name: userInfo.name,
    });

    // Create SSE transport
    const transport = new SSEServerTransport('/', res, {
      enableDnsRebindingProtection: false,
    });

    // Connect server to transport
    await mcpServer.getServer().connect(transport);
    
    // Store session
    mcpSessions.set(transport.sessionId, {
      mcpServer,
      transport,
      userId: userInfo.userId,
      createdAt: new Date(),
    });

    logger.info('MCP SSE transport connected', {
      sessionId: transport.sessionId,
      userId: userInfo.userId,
    });

    // Handle transport events
    transport.onclose = () => {
      logger.info('MCP transport closed', {
        sessionId: transport.sessionId,
        userId: userInfo.userId,
      });
      mcpSessions.delete(transport.sessionId);
      mcpServer.clearAuthContext();
    };

    transport.onerror = (error) => {
      logger.error('MCP transport error', {
        sessionId: transport.sessionId,
        userId: userInfo.userId,
        error: error.message,
      });
    };

  } catch (error) {
    logger.error('Failed to establish MCP SSE connection', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.userId
    });

    res.status(500).json({
      error: 'Failed to establish MCP connection',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST / - Handle incoming MCP messages
 */
router.post('/', mcpAuthMiddleware, async (req: any, res: any) => {
  try {
    // Get session ID from header or query parameter, or create session-less flow
    let sessionId = req.headers['mcp-session-id'] || req.query.sessionId;
    
    logger.info('MCP POST message received', {
      sessionId,
      userId: req.user.userId,
      method: req.body?.method,
      hasBody: !!req.body,
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

    // For clients that don't establish SSE first, create a session-less MCP server
    if (!sessionId) {
      logger.info('Creating session-less MCP server for direct request', {
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
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: MCP_DETAILED_CAPABILITIES,
              serverInfo: MCP_SERVER_INFO
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
              tools: MCP_TOOLS
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

          if (!isValidToolName(toolName)) {
            response = {
              jsonrpc: '2.0',
              id: body.id,
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`
              }
            };
          } else {
            try {
              let result;
              if (toolName === 'query_projects') {
                result = await mcpServer.handleQueryProjectsPublic(toolArgs);
              } else if (toolName === 'query_tasks') {
                result = await mcpServer.handleQueryTasksPublic(toolArgs);
              }
              
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
      error: error instanceof Error ? error.message : String(error),
      sessionId: req.headers['mcp-session-id'],
      userId: req.user?.userId,
      method: req.body?.method
    });

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'mcp_post_message' },
        user: { id: req.user?.userId, email: req.user?.email },
      });
    }

    res.status(500).json({
      error: 'Failed to process MCP message',
    });
  }
});

export { router as mcpRoutes };