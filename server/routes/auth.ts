import express from 'express';
import { databaseService } from '../db/database-service.js';
import { sentryOAuthService } from '../services/sentry-oauth.js';
import { generateJWT, SecurityEvent, logSecurityEvent, authenticateUser } from '../middleware/auth.js';
import { authRateLimit, oauthCallbackRateLimit } from '../middleware/rate-limit.js';
import * as Sentry from '@sentry/node';

const router = express.Router();

// Fake login endpoint - creates or finds user by email
router.post('/fake-login', authRateLimit, async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      logSecurityEvent(SecurityEvent.LOGIN_FAILURE, req, { reason: 'missing_credentials' }, 'low');
      return res.status(400).json({ error: 'Email and name are required' });
    }

    // Check if user exists
    let user = await databaseService.getUserByEmail(email);
    
    if (!user) {
      // Create new user
      user = await databaseService.createUser(email, name, 'fake');
    }

    // Generate JWT token
    const token = generateJWT({
      id: user.id,
      email: user.email,
      provider: user.provider || 'fake'
    });

    logSecurityEvent(SecurityEvent.LOGIN_SUCCESS, req, { 
      userId: user.id, 
      provider: 'fake' 
    }, 'low');

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
      message: 'Login successful',
    });
  } catch (error) {
    logSecurityEvent(SecurityEvent.LOGIN_FAILURE, req, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'medium');
    console.error('Fake login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user endpoint (now uses JWT authentication)
router.get('/me', authenticateUser, async (req, res) => {
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

// Sentry OAuth initiation endpoint
router.get('/sentry', (req, res) => {
  try {
    const state = req.query.state as string;
    const authUrl = sentryOAuthService.getAuthorizationUrl(state);
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
      return res.redirect(`http://localhost:5173/login?error=${encodeURIComponent(error as string)}`);
    }

    if (!code) {
      logger.error('OAuth callback missing authorization code', { query: req.query });
      Sentry.captureException(new Error('OAuth callback missing authorization code'), {
        tags: { oauth_step: 'callback' },
        extra: { query: req.query }
      });
      return res.redirect('http://localhost:5173/login?error=missing_code');
    }

    logger.info(logger.fmt`Starting OAuth flow with code: ${code}`);

    // Complete OAuth flow
    let sentryUser;
    try {
      const result = await sentryOAuthService.completeOAuthFlow(code as string);
      sentryUser = result.user;
      
      // Detailed logging for profile data analysis
      logger.info('=== SENTRY OAUTH PROFILE DATA ===', {
        timestamp: new Date().toISOString(),
        fullSentryUser: sentryUser,
        userFields: {
          id: sentryUser.id,
          email: sentryUser.email,
          name: sentryUser.name,
          username: sentryUser.username,
          avatar: sentryUser.avatar,
        },
        accessToken: result.accessToken ? 'present' : 'missing',
        accessTokenLength: result.accessToken ? result.accessToken.length : 0
      });
      
      console.log('\n=== SENTRY USER PROFILE DATA ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Raw Sentry User Object:', JSON.stringify(sentryUser, null, 2));
      console.log('User ID:', sentryUser.id);
      console.log('Email:', sentryUser.email);
      console.log('Name:', sentryUser.name);
      console.log('Username:', sentryUser.username);
      console.log('Avatar:', sentryUser.avatar);
      console.log('Access Token Present:', !!result.accessToken);
      console.log('================================\n');
      
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
      return res.redirect('http://localhost:5173/login?error=oauth_failed');
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
          sentryUser.avatar
        );
        logger.info('Successfully created user', { id: user.id, email: user.email });
      } catch (dbError) {
        logger.error('Failed to create user in database', { error: dbError, sentryUser });
        Sentry.captureException(dbError instanceof Error ? dbError : new Error('Failed to create user in database'), {
          tags: { oauth_step: 'user_creation' },
          extra: { sentryUser, originalError: String(dbError) }
        });
        return res.redirect('http://localhost:5173/login?error=user_creation_failed');
      }
    } else if (user.provider !== 'sentry') {
      logger.info('Updating existing user to link with Sentry');
      try {
        user = await databaseService.updateUser(user.id, {
          provider: 'sentry',
          providerId: sentryUser.id,
          avatar: sentryUser.avatar,
        });
        logger.info('Successfully updated user', { id: user?.id, email: user?.email });
      } catch (dbError) {
        logger.error('Failed to update user in database', { error: dbError, userId: user.id, sentryUser });
        Sentry.captureException(dbError instanceof Error ? dbError : new Error('Failed to update user in database'), {
          tags: { oauth_step: 'user_update' },
          extra: { userId: user.id, sentryUser, originalError: String(dbError) }
        });
        return res.redirect('http://localhost:5173/login?error=user_update_failed');
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
      return res.redirect('http://localhost:5173/login?error=user_not_found');
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

    // Redirect to frontend with JWT token
    const redirectUrl = `http://localhost:5173/login?success=true&token=${encodeURIComponent(token)}`;
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
    res.redirect('http://localhost:5173/login?error=oauth_failed');
  }
});

export default router;