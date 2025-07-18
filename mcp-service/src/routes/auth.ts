import express from 'express';
import { AuthService } from '../services/auth-service.js';
import { OAuthService } from '../services/oauth-service.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import * as Sentry from '@sentry/node';
import {
  getFrontendUrl,
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

    // Redirect to frontend consent screen
    const frontendUrl = getFrontendUrl();
    const mcpServiceUrl = getMCPServiceUrl(req);
    
    const consentUrl = new URL('/mcp-login', frontendUrl);
    consentUrl.searchParams.set('mcp_service', mcpServiceUrl);
    consentUrl.searchParams.set('authorization_code', authorizationCode);
    consentUrl.searchParams.set('client_id', client_id);
    consentUrl.searchParams.set('scope', scope || 'projects:read tasks:read');
    
    res.redirect(consentUrl.toString());

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
 * Handles user consent from frontend
 */
router.post('/consent', async (req: any, res: any) => {
  try {
    const { authorization_code, action, main_app_token } = req.body;

    if (!authorization_code || !action) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'authorization_code and action are required'
      });
    }

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'action must be "approve" or "deny"'
      });
    }

    // Validate main app token
    const userInfo = await authService.validateMainAppToken(main_app_token);
    if (!userInfo) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid main application token'
      });
    }

    // Get authorization request details
    const authRequest = OAuthService.getAuthorizationCodeDetails(authorization_code);
    if (!authRequest) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
    }

    if (action === 'approve') {
      // Approve the authorization
      const success = OAuthService.approveAuthorizationCode(authorization_code, userInfo.userId);
      if (!success) {
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to approve authorization'
        });
      }

      logger.info('OAuth authorization approved', {
        authorization_code: authorization_code.substring(0, 8) + '...',
        user_id: userInfo.userId,
        client_id: authRequest.client_id,
      });

      // Build redirect URL
      const redirectUrl = new URL(authRequest.redirect_uri);
      redirectUrl.searchParams.set('code', authorization_code);
      if (authRequest.state) {
        redirectUrl.searchParams.set('state', authRequest.state);
      }

      res.json({
        success: true,
        redirect_uri: redirectUrl.toString()
      });
    } else {
      // User denied authorization
      const redirectUrl = new URL(authRequest.redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User denied authorization');
      if (authRequest.state) {
        redirectUrl.searchParams.set('state', authRequest.state);
      }

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

export { router as authRoutes };