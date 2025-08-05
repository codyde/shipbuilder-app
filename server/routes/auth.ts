import express from 'express';
import { databaseService } from '../db/database-service.js';
import { sentryOAuthService } from '../services/sentry-oauth.js';
import { googleOAuthService } from '../services/google-oauth.js';
import { generateJWT, SecurityEvent, logSecurityEvent, authenticateUser } from '../middleware/auth.js';
import { oauthCallbackRateLimit } from '../middleware/rate-limit.js';
import * as Sentry from '@sentry/node';

// MCP state validation and security
interface MCPState {
  type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  code_challenge: string;
  code_challenge_method: string;
  mcp_service_url: string;
  originalUrl: string;
  timestamp?: number;
}

function validateMCPState(encodedState: string): MCPState | null {
  try {
    const decoded = JSON.parse(decodeURIComponent(encodedState));
    
    // Validate required fields
    if (decoded.type !== 'mcp_authorization') {
      return null;
    }
    
    if (!decoded.client_id || !decoded.redirect_uri || !decoded.code_challenge || !decoded.code_challenge_method) {
      return null;
    }
    
    // Validate URLs
    try {
      new URL(decoded.redirect_uri);
      new URL(decoded.mcp_service_url);
    } catch {
      return null;
    }
    
    // Check for reasonable expiration (state should not be older than 1 hour)
    if (decoded.timestamp && Date.now() - decoded.timestamp > 3600000) {
      return null;
    }
    
    return decoded as MCPState;
  } catch {
    return null;
  }
}

const router = express.Router();

// Service-to-service user lookup endpoint (for MCP service)
router.get('/service/user/:userId', async (req: any, res: any) => {
  try {
    // Verify service token from MCP service
    const serviceToken = req.headers['x-service-token'];
    const expectedServiceToken = process.env.SERVICE_TOKEN || 'default-service-token';
    
    if (!serviceToken || serviceToken !== expectedServiceToken) {
      return res.status(401).json({ error: 'Invalid service token' });
    }
    
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user from database
    const user = await databaseService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user data (safe for service-to-service communication)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider
      }
    });
    
  } catch (error) {
    console.error('Service user lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Get current user endpoint (now uses JWT authentication)
router.get('/me', authenticateUser, async (req: any, res: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        provider: req.user.provider
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  if (req.user) {
    logSecurityEvent(SecurityEvent.LOGOUT, req, { userId: req.user.id }, 'low');
  }
  res.json({ message: 'Logged out successfully' });
});

// Developer mode login endpoint
router.post('/developer', async (req: any, res: any) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Transform email to demo format: user@domain.com -> user+demo@domain.com
    const emailParts = email.split('@');
    if (emailParts.length !== 2) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const [localPart, domain] = emailParts;
    const demoEmail = `${localPart}+demo@${domain}`;
    
    // Check if user already exists
    let user = await databaseService.getUserByEmail(demoEmail);
    
    if (!user) {
      // Create new developer user
      try {
        user = await databaseService.createUser(
          demoEmail,
          localPart, // Use the local part as the name
          'developer',
          `dev_${Date.now()}`, // Unique provider ID for developer accounts
          undefined // No avatar for developer accounts
        );
        
        logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, req, { 
          userId: user.id, 
          provider: 'developer',
          originalEmail: email,
          demoEmail: demoEmail
        }, 'low');
        
      } catch (dbError) {
        console.error('Failed to create developer user:', dbError);
        return res.status(500).json({ error: 'Failed to create developer account' });
      }
    } else {
      logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, req, { 
        userId: user.id, 
        provider: 'developer',
        originalEmail: email,
        demoEmail: demoEmail
      }, 'low');
      
    }
    
    // Generate JWT token
    const token = generateJWT({
      id: user.id,
      email: user.email,
      provider: user.provider || 'developer'
    });
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider
      },
      token
    });
  } catch (error) {
    console.error('Developer login error:', error);
    logSecurityEvent(SecurityEvent.LOGIN_FAILURE, req, { 
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'developer'
    }, 'medium');
    res.status(500).json({ error: 'Developer login failed' });
  }
});

// Sentry OAuth initiation endpoint
router.get('/sentry', (req, res) => {
  try {
    // Check for MCP state parameter and preserve it
    const mcpState = req.query.mcp_state as string;
    const state = req.query.state as string;
    
    // If MCP state is present, we need to preserve it through the OAuth flow
    let oauthState = state;
    if (mcpState) {
      // Combine original state with MCP state preservation marker
      oauthState = mcpState;
    }
    
    const authUrl = sentryOAuthService.getAuthorizationUrl(oauthState);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Sentry OAuth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// Sentry OAuth callback endpoint
router.get('/sentry/callback', oauthCallbackRateLimit, async (req, res) => {
  const { logger } = Sentry;
  
  logger.info('OAuth callback received', {
    query: req.query,
    headers: req.headers,
    url: req.url
  });

  try {
    const { code, error, state } = req.query;

    if (error) {
      logger.error(logger.fmt`OAuth authorization failed: ${error}`, { error, state });
      Sentry.captureException(new Error(`OAuth authorization failed: ${error}`), {
        tags: { oauth_step: 'authorization' },
        extra: { error, state, query: req.query }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=${encodeURIComponent(error as string)}`);
    }

    if (!code) {
      logger.error('OAuth callback missing authorization code', { query: req.query });
      Sentry.captureException(new Error('OAuth callback missing authorization code'), {
        tags: { oauth_step: 'callback' },
        extra: { query: req.query }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=missing_code`);
    }

    logger.info(logger.fmt`Starting OAuth flow with code: ${code}`);

    // Complete OAuth flow
    let sentryUser;
    try {
      const result = await sentryOAuthService.completeOAuthFlow(code as string);
      sentryUser = result.user;
      
      
      logger.info('Successfully got Sentry user', {
        id: sentryUser.id,
        email: sentryUser.email,
        name: sentryUser.name
      });
    } catch (oauthError) {
      logger.error('Failed to complete OAuth flow with Sentry', {
        error: oauthError,
        code,
        message: oauthError instanceof Error ? oauthError.message : String(oauthError)
      });
      Sentry.captureException(oauthError instanceof Error ? oauthError : new Error('Failed to complete OAuth flow with Sentry'), {
        tags: { oauth_step: 'token_exchange' },
        extra: { code, originalError: String(oauthError) }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=oauth_failed`);
    }

    // Check if user exists in our database
    logger.info(logger.fmt`Looking up user by email: ${sentryUser.email}`);
    let user = await databaseService.getUserByEmail(sentryUser.email);
    
    if (!user) {
      logger.info('Creating new user with Sentry provider');
      try {
        user = await databaseService.createUser(
          sentryUser.email, 
          sentryUser.name, 
          'sentry', 
          sentryUser.id,
          sentryUser.avatar?.avatarUrl
        );
        logger.info('Successfully created user', { id: user.id, email: user.email });
      } catch (dbError) {
        logger.error('Failed to create user in database', { error: dbError, sentryUser });
        Sentry.captureException(dbError instanceof Error ? dbError : new Error('Failed to create user in database'), {
          tags: { oauth_step: 'user_creation' },
          extra: { sentryUser, originalError: String(dbError) }
        });
        return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=user_creation_failed`);
      }
    } else if (user.provider !== 'sentry') {
      logger.info('Updating existing user to link with Sentry');
      try {
        user = await databaseService.updateUser(user.id, {
          provider: 'sentry',
          providerId: sentryUser.id,
          avatar: sentryUser.avatar?.avatarUrl,
        }) || undefined;
        logger.info('Successfully updated user', { id: user?.id, email: user?.email });
      } catch (dbError) {
        logger.error('Failed to update user in database', { error: dbError, userId: user?.id, sentryUser });
        Sentry.captureException(dbError instanceof Error ? dbError : new Error('Failed to update user in database'), {
          tags: { oauth_step: 'user_update' },
          extra: { userId: user?.id, sentryUser, originalError: String(dbError) }
        });
        return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=user_update_failed`);
      }
    } else {
      logger.info('User already exists with Sentry provider', { id: user.id, email: user.email });
    }

    if (!user) {
      logger.error('User object is null after database operation', { sentryUser });
      Sentry.captureException(new Error('User object is null after database operation'), {
        tags: { oauth_step: 'user_verification' },
        extra: { sentryUser }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=user_not_found`);
    }

    // Generate JWT token for OAuth user
    const token = generateJWT({
      id: user.id,
      email: user.email,
      provider: user.provider || 'sentry'
    });

    logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, req, { 
      userId: user.id, 
      provider: 'sentry' 
    }, 'low');

    // MCP flow is now handled directly by the MCP service
    // No need for complex state management in OAuth callbacks

    // Normal post-login redirect to dashboard
    const redirectUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?success=true&token=${encodeURIComponent(token)}`;
    logger.info('OAuth flow completed successfully', { redirectUrl, userId: user.id });
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Unexpected error in OAuth callback', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      query: req.query
    });
    Sentry.captureException(error instanceof Error ? error : new Error('Unexpected error in OAuth callback'), {
      tags: { oauth_step: 'unexpected' },
      extra: { 
        query: req.query,
        originalError: String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=oauth_failed`);
  }
});

// Google OAuth initiation endpoint
router.get('/google', (req, res) => {
  try {
    // Check for MCP state parameter and preserve it
    const mcpState = req.query.mcp_state as string;
    const state = req.query.state as string;
    
    // If MCP state is present, we need to preserve it through the OAuth flow
    let oauthState = state;
    if (mcpState) {
      // Combine original state with MCP state preservation marker
      oauthState = mcpState;
    }
    
    const authUrl = googleOAuthService.getAuthorizationUrl(oauthState);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate Google OAuth flow' });
  }
});

// Google OAuth callback endpoint
router.get('/google/callback', oauthCallbackRateLimit, async (req, res) => {
  const { logger } = Sentry;
  
  logger.info('Google OAuth callback received', {
    query: req.query,
    headers: req.headers,
    url: req.url
  });

  try {
    const { code, error, state } = req.query;

    if (error) {
      logger.error(logger.fmt`Google OAuth authorization failed: ${error}`, { error, state });
      Sentry.captureException(new Error(`Google OAuth authorization failed: ${error}`), {
        tags: { oauth_service: 'google', oauth_step: 'authorization' },
        extra: { error, state, query: req.query }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=${encodeURIComponent(error as string)}`);
    }

    if (!code) {
      logger.error('Google OAuth callback missing authorization code', { query: req.query });
      Sentry.captureException(new Error('Google OAuth callback missing authorization code'), {
        tags: { oauth_service: 'google', oauth_step: 'callback' },
        extra: { query: req.query }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=missing_code`);
    }

    logger.info(logger.fmt`Starting Google OAuth flow with code: ${code}`);

    // Complete OAuth flow
    let googleUser;
    try {
      const result = await googleOAuthService.completeOAuthFlow(code as string);
      googleUser = result.user;
      
      
      logger.info('Successfully got Google user', {
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        verified_email: googleUser.verified_email
      });
    } catch (oauthError) {
      logger.error('Failed to complete OAuth flow with Google', {
        error: oauthError,
        code,
        message: oauthError instanceof Error ? oauthError.message : String(oauthError)
      });
      Sentry.captureException(oauthError instanceof Error ? oauthError : new Error('Failed to complete OAuth flow with Google'), {
        tags: { oauth_service: 'google', oauth_step: 'token_exchange' },
        extra: { code, originalError: String(oauthError) }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=oauth_failed`);
    }

    // Check if user exists in our database
    logger.info(logger.fmt`Looking up user by email: ${googleUser.email}`);
    let user = await databaseService.getUserByEmail(googleUser.email);
    
    if (!user) {
      logger.info('Creating new user with Google provider');
      try {
        user = await databaseService.createUser(
          googleUser.email, 
          googleUser.name, 
          'google', 
          googleUser.id,
          googleUser.picture
        );
        logger.info('Successfully created user', { id: user.id, email: user.email });
      } catch (dbError) {
        logger.error('Failed to create user in database', { error: dbError, googleUser });
        Sentry.captureException(dbError instanceof Error ? dbError : new Error('Failed to create user in database'), {
          tags: { oauth_service: 'google', oauth_step: 'user_creation' },
          extra: { googleUser, originalError: String(dbError) }
        });
        return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=user_creation_failed`);
      }
    } else if (user.provider !== 'google') {
      logger.info('Updating existing user to link with Google');
      try {
        user = await databaseService.updateUser(user.id, {
          provider: 'google',
          providerId: googleUser.id,
          avatar: googleUser.picture,
        }) || undefined;
        logger.info('Successfully updated user', { id: user?.id, email: user?.email });
      } catch (dbError) {
        logger.error('Failed to update user in database', { error: dbError, userId: user?.id, googleUser });
        Sentry.captureException(dbError instanceof Error ? dbError : new Error('Failed to update user in database'), {
          tags: { oauth_service: 'google', oauth_step: 'user_update' },
          extra: { userId: user?.id, googleUser, originalError: String(dbError) }
        });
        return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=user_update_failed`);
      }
    } else {
      logger.info('User already exists with Google provider', { id: user.id, email: user.email });
    }

    if (!user) {
      logger.error('User object is null after database operation', { googleUser });
      Sentry.captureException(new Error('User object is null after database operation'), {
        tags: { oauth_service: 'google', oauth_step: 'user_verification' },
        extra: { googleUser }
      });
      return res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=user_not_found`);
    }

    // Generate JWT token for OAuth user
    const token = generateJWT({
      id: user.id,
      email: user.email,
      provider: user.provider || 'google'
    });

    logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, req, { 
      userId: user.id, 
      provider: 'google' 
    }, 'low');

    // MCP flow is now handled directly by the MCP service
    // No need for complex state management in OAuth callbacks

    // Normal post-login redirect to dashboard
    const redirectUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?success=true&token=${encodeURIComponent(token)}`;
    logger.info('Google OAuth flow completed successfully', { redirectUrl, userId: user.id });
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Unexpected error in Google OAuth callback', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      query: req.query
    });
    Sentry.captureException(error instanceof Error ? error : new Error('Unexpected error in Google OAuth callback'), {
      tags: { oauth_service: 'google', oauth_step: 'unexpected' },
      extra: { 
        query: req.query,
        originalError: String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    res.redirect(`${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/?error=oauth_failed`);
  }
});

// Update AI provider preference
router.put('/ai-provider', authenticateUser, async (req: any, res: any) => {
  try {
    
    const userId = req.user?.id;
    
    if (!userId) {
      console.error('No user ID found in request:', { user: req.user });
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { provider } = req.body;
    
    if (!provider || !['anthropic', 'openai', 'xai'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid AI provider. Must be "anthropic", "openai", or "xai"' });
    }

    // Update user's AI provider preference
    const { AIProviderService } = await import('../services/ai-provider.js');
    await AIProviderService.updateUserProvider(userId, provider as 'anthropic' | 'openai' | 'xai');

    res.json({ success: true, provider });
  } catch (error) {
    console.error('Error updating AI provider:', error);
    res.status(500).json({ error: 'Failed to update AI provider preference' });
  }
});


// Get available AI providers
router.get('/ai-providers', authenticateUser, async (req: any, res: any) => {
  try {
    const { AIProviderService } = await import('../services/ai-provider.js');
    const availableProviders = AIProviderService.getAvailableProviders();
    
    // Get user's current provider preference if authenticated
    let currentProvider = null;
    if (req.user?.id) {
      const user = await databaseService.getUserById(req.user.id);
      currentProvider = user?.aiProvider || 'anthropic';
    }
    
    res.json({ 
      providers: availableProviders,
      current: currentProvider
    });
  } catch (error) {
    console.error('Error getting AI providers:', error);
    res.status(500).json({ error: 'Failed to get AI providers' });
  }
});

export default router;