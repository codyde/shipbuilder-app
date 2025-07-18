import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { databaseService } from '../db/database-service.js';
import * as Sentry from '@sentry/node';
import { verifyApiKey, isValidApiKeyFormat, hashApiKey, isApiKeyExpired } from '../utils/api-key-utils.js';

// JWT Payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  provider: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

// Extend Request interface to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        provider: string;
      };
    }
  }
}

// Security event logging
enum SecurityEvent {
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGOUT = 'auth.logout',
  TOKEN_REFRESH = 'auth.token.refresh',
  PERMISSION_DENIED = 'auth.permission.denied',
  SUSPICIOUS_ACTIVITY = 'auth.suspicious.activity',
  INVALID_TOKEN = 'auth.token.invalid',
  EXPIRED_TOKEN = 'auth.token.expired',
  API_KEY_SUCCESS = 'auth.apikey.success',
  API_KEY_INVALID = 'auth.apikey.invalid',
  API_KEY_EXPIRED = 'auth.apikey.expired',
  API_KEY_CREATED = 'auth.apikey.created',
  API_KEY_DELETED = 'auth.apikey.deleted'
}

interface AuditLogEntry {
  timestamp: Date;
  event: SecurityEvent;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

function logSecurityEvent(event: SecurityEvent, req: Request, metadata: Record<string, unknown> = {}, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
  
  // Capture high/critical events in Sentry
  if (severity === 'high' || severity === 'critical') {
    Sentry.captureMessage(`Security Event: ${event}`, severity === 'critical' ? 'error' : 'warning');
    Sentry.setTag('security_event', event);
  }
}

// JWT token generation
export function generateJWT(user: { id: string; email: string; provider: string }): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    provider: user.provider,
    aud: 'project-management-app',
    iss: 'auth-service'
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as any,
    algorithm: 'HS256'
  });
}

// JWT token verification
export function verifyJWT(token: string): JWTPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    audience: 'project-management-app',
    issuer: 'auth-service'
  }) as JWTPayload;
}

// JWT authentication middleware
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logSecurityEvent(SecurityEvent.PERMISSION_DENIED, req, { reason: 'missing_auth_header' }, 'medium');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    // Check if token looks like an API key
    if (isValidApiKeyFormat(token)) {
      // Handle API key authentication
      const keyHash = hashApiKey(token);
      const apiKeyData = await databaseService.getApiKeyByHash(keyHash);
      
      if (!apiKeyData || !apiKeyData.isActive) {
        logSecurityEvent(SecurityEvent.API_KEY_INVALID, req, { reason: 'key_not_found' }, 'high');
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }
      
      // Check if API key is expired
      if (isApiKeyExpired(apiKeyData.expiresAt)) {
        logSecurityEvent(SecurityEvent.API_KEY_EXPIRED, req, { 
          keyId: apiKeyData.id,
          userId: apiKeyData.userId,
          expiresAt: apiKeyData.expiresAt?.toISOString()
        }, 'medium');
        res.status(401).json({ error: 'API key expired' });
        return;
      }
      
      // Get user from database
      const user = await databaseService.getUserById(apiKeyData.userId);
      
      if (!user) {
        logSecurityEvent(SecurityEvent.SUSPICIOUS_ACTIVITY, req, { 
          reason: 'valid_apikey_but_user_not_found', 
          keyId: apiKeyData.id,
          userId: apiKeyData.userId 
        }, 'critical');
        res.status(401).json({ error: 'User not found' });
        return;
      }
      
      // Update last used timestamp
      await databaseService.updateApiKeyLastUsed(apiKeyData.id);
      
      // Log successful API key authentication
      logSecurityEvent(SecurityEvent.API_KEY_SUCCESS, req, {
        keyId: apiKeyData.id,
        keyName: apiKeyData.name,
        userId: apiKeyData.userId
      }, 'low');
      
      // Add user to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider || 'unknown'
      };
      
      next();
      return;
    }
    
    // Handle JWT authentication
    let payload: JWTPayload;
    try {
      payload = verifyJWT(token);
    } catch (jwtError) {
      const errorMessage = jwtError instanceof Error ? jwtError.message : 'Invalid token';
      
      if (errorMessage.includes('expired')) {
        logSecurityEvent(SecurityEvent.EXPIRED_TOKEN, req, { error: errorMessage }, 'medium');
        res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        return;
      } else {
        logSecurityEvent(SecurityEvent.INVALID_TOKEN, req, { error: errorMessage }, 'high');
        res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
        return;
      }
    }

    // Get user from database to ensure they still exist
    const user = await databaseService.getUserById(payload.userId);
    
    if (!user) {
      logSecurityEvent(SecurityEvent.SUSPICIOUS_ACTIVITY, req, { 
        reason: 'valid_jwt_but_user_not_found', 
        userId: payload.userId 
      }, 'critical');
      res.status(401).json({ error: 'User not found' });
      return;
    }

    
    // Add user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider || 'unknown'
    };

    next();
  } catch (error) {
    logSecurityEvent(SecurityEvent.SUSPICIOUS_ACTIVITY, req, { 
      error: error instanceof Error ? error.message : 'Unknown auth error' 
    }, 'critical');
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
    return;
  }
}

// Optional authentication middleware (doesn't fail if no auth)
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const payload = verifyJWT(token);
        const user = await databaseService.getUserById(payload.userId);
        
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            provider: user.provider || 'unknown'
          };
        }
      } catch {
        // Silently ignore JWT errors for optional auth
      }
    }

    next();
  } catch {
    // Don't fail on optional auth errors
    next();
  }
}

// Export security event logging for use in other modules
export { SecurityEvent, logSecurityEvent };