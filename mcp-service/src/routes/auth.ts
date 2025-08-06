import express from 'express';
import { AuthService } from '../services/auth-service.js';
import { OAuthService } from '../services/oauth-service.js';
import { pendingAuthService } from '../services/pending-auth-service.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import * as Sentry from '@sentry/node';
import {
  getFrontendUrl,
  getBackendUrl,
  getMCPServiceUrl
} from '../config/mcp-config.js';

const router = express.Router();
const authService = new AuthService();

/**
 * GET /api/auth/authorize - OAuth Authorization Endpoint
 * Redirects to main frontend for user consent
 */
router.get('/authorize', async (req: any, res: any) => {
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

    if (code_challenge_method !== 'S256') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Only S256 code_challenge_method is supported'
      });
    }

    // Check if user is authenticated by trying the Authorization header
    const authHeader = req.headers.authorization;
    let userInfo = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      userInfo = await authService.validateToken(token);
    }

    // If user is not authenticated, create pending authorization and redirect to login
    if (!userInfo) {
      logger.info('User not authenticated for MCP authorization, creating pending auth', {
        client_id,
        redirect_uri
      });

      try {
        // Create pending authorization request
        const authId = await pendingAuthService.createPendingAuth({
          client_id,
          redirect_uri,
          scope: scope || 'projects:read tasks:read',
          state,
          code_challenge,
          code_challenge_method
        });

        // Redirect to main app login with MCP context preserved
        const frontendUrl = getFrontendUrl();
        const loginUrl = `${frontendUrl}/?mcp_auth_id=${authId}&mcp_login=true`;
        
        logger.info('Redirecting to consent screen for authentication', {
          client_id,
          authId,
          loginUrl
        });
        
        return res.redirect(loginUrl);
      } catch (error) {
        logger.error('Failed to create pending authorization', {
          error: error instanceof Error ? error.message : String(error),
          client_id,
          redirect_uri
        });
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to create authorization request'
        });
      }
    }

    // User is authenticated, create pending auth with user info and proceed to consent
    logger.info('User authenticated for MCP authorization, creating pending auth', {
      client_id,
      redirect_uri,
      userId: userInfo.userId
    });

    try {
      // Create pending authorization request with user information
      const authId = await pendingAuthService.createPendingAuth({
        client_id,
        redirect_uri,
        scope: scope || 'projects:read tasks:read',
        state,
        code_challenge,
        code_challenge_method
      });

      // Update with user information
      await pendingAuthService.updatePendingAuth(authId, userInfo.userId);

      logger.info('Created pending authorization for authenticated user', {
        client_id,
        redirect_uri,
        authId,
        userId: userInfo.userId
      });

      // Redirect to frontend consent screen
      const frontendUrl = getFrontendUrl();
      const consentUrl = `${frontendUrl}/mcp-consent?auth_id=${authId}`;
      
      res.redirect(consentUrl);
    } catch (error) {
      logger.error('Failed to create pending authorization for authenticated user', {
        error: error instanceof Error ? error.message : String(error),
        client_id,
        redirect_uri,
        userId: userInfo.userId
      });
      return res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to create authorization request'
      });
    }

  } catch (error) {
    logger.error('OAuth authorization failed', {
      error: error instanceof Error ? error.message : String(error),
      query: req.query
    });

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'mcp_oauth_authorize' },
      });
    }

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process authorization request'
    });
  }
});

/**
 * POST /api/auth/consent - Handle user consent for OAuth authorization
 * Uses pending authorization system instead of direct authorization codes
 */
router.post('/consent', async (req: any, res: any) => {
  try {
    const { auth_id, action, main_app_token } = req.body;

    logger.info('Consent request received', {
      auth_id,
      action,
      hasToken: !!main_app_token,
      tokenLength: main_app_token?.length
    });

    // Validate required parameters
    if (!auth_id || !action) {
      logger.error('Missing required parameters in consent request', {
        hasAuthId: !!auth_id,
        hasAction: !!action
      });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'auth_id and action are required'
      });
    }

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'action must be "approve" or "deny"'
      });
    }

    // Get pending authorization
    const pendingAuth = await pendingAuthService.getPendingAuth(auth_id);
    if (!pendingAuth) {
      logger.error('Pending authorization not found or expired', { auth_id });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid or expired authorization request'
      });
    }

    // Validate main app token and update pending auth with user info if needed
    if (!main_app_token) {
      logger.error('Missing main_app_token in consent request');
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'main_app_token is required'
      });
    }
    
    const userInfo = await authService.validateToken(main_app_token);
    if (!userInfo) {
      logger.error('Failed to validate main app token', {
        tokenLength: main_app_token?.length,
        tokenPrefix: main_app_token?.substring(0, 20) + '...'
      });
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired authentication token. Please log in again.'
      });
    }

    // Update pending auth with user info if not already set
    if (!pendingAuth.user_id) {
      await pendingAuthService.updatePendingAuth(auth_id, userInfo.userId);
      pendingAuth.user_id = userInfo.userId; // Update local object
    }

    if (action === 'approve') {
      // Generate authorization code using the pending auth details
      const authorizationCode = OAuthService.generateAuthorizationCode({
        client_id: pendingAuth.client_id,
        redirect_uri: pendingAuth.redirect_uri,
        code_challenge: pendingAuth.code_challenge,
        code_challenge_method: pendingAuth.code_challenge_method,
        scope: pendingAuth.scope,
        state: pendingAuth.state,
      });

      // Approve the authorization
      const success = OAuthService.approveAuthorizationCode(authorizationCode, userInfo.userId);
      if (!success) {
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to approve authorization'
        });
      }

      logger.info('OAuth authorization approved', {
        auth_id,
        authorization_code: authorizationCode.substring(0, 8) + '...',
        user_id: userInfo.userId,
        client_id: pendingAuth.client_id,
      });

      // Build redirect URL
      const redirectUrl = new URL(pendingAuth.redirect_uri);
      redirectUrl.searchParams.set('code', authorizationCode);
      if (pendingAuth.state) {
        redirectUrl.searchParams.set('state', pendingAuth.state);
      }

      // Clean up pending authorization
      await pendingAuthService.deletePendingAuth(auth_id);

      res.json({
        success: true,
        redirect_uri: redirectUrl.toString()
      });
    } else {
      // User denied authorization
      logger.info('OAuth authorization denied', {
        auth_id,
        user_id: userInfo.userId,
        client_id: pendingAuth.client_id
      });

      const redirectUrl = new URL(pendingAuth.redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User denied authorization');
      if (pendingAuth.state) {
        redirectUrl.searchParams.set('state', pendingAuth.state);
      }

      // Clean up pending authorization
      await pendingAuthService.deletePendingAuth(auth_id);

      res.json({
        success: false,
        redirect_uri: redirectUrl.toString()
      });
    }

  } catch (error) {
    logger.error('OAuth consent failed', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'mcp_oauth_consent' },
      });
    }

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process consent'
    });
  }
});

/**
 * GET /api/auth/pending/:authId - Get pending authorization details
 * Used by frontend to retrieve authorization request information
 */
router.get('/pending/:authId', async (req: any, res: any) => {
  try {
    const { authId } = req.params;
    
    if (!authId) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'authId parameter is required'
      });
    }

    logger.info('Getting pending authorization', { authId });

    const pendingAuth = await pendingAuthService.getPendingAuth(authId);
    
    if (!pendingAuth) {
      logger.warn('Pending authorization not found or expired', { authId });
      return res.status(404).json({
        error: 'not_found',
        error_description: 'Pending authorization not found or expired'
      });
    }

    logger.info('Retrieved pending authorization', {
      authId,
      client_id: pendingAuth.client_id,
      hasUser: !!pendingAuth.user_id
    });

    // Return authorization details (without sensitive code_challenge)
    res.json({
      id: pendingAuth.id,
      client_id: pendingAuth.client_id,
      redirect_uri: pendingAuth.redirect_uri,
      scope: pendingAuth.scope,
      user_id: pendingAuth.user_id,
      created_at: pendingAuth.created_at,
      expires_at: pendingAuth.expires_at
    });

  } catch (error) {
    logger.error('Failed to get pending authorization', {
      error: error instanceof Error ? error.message : String(error),
      authId: req.params.authId
    });

    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { component: 'mcp_pending_auth_get' },
      });
    }

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to retrieve pending authorization'
    });
  }
});

export { router as authRoutes };