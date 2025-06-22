import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { SecurityEvent, logSecurityEvent } from './auth.js';

// Rate limiting configuration
const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5'), // 5 attempts default
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) => {
    logSecurityEvent(
      SecurityEvent.SUSPICIOUS_ACTIVITY, 
      req, 
      { 
        reason: 'rate_limit_exceeded',
        endpoint: req.path,
        method: req.method
      }, 
      'high'
    );
    
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again later',
      retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000)
    });
  }
};

// Authentication rate limiting (stricter)
export const authRateLimit = rateLimit({
  ...rateLimitConfig,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: {
    error: 'Too many login attempts',
    message: 'Please try again in 15 minutes'
  }
});

// OAuth callback rate limiting
export const oauthCallbackRateLimit = rateLimit({
  ...rateLimitConfig,
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 callbacks per IP
  message: {
    error: 'Too many OAuth callback attempts',
    message: 'Please try again in 5 minutes'
  }
});

// General API rate limiting (more permissive for authenticated users)
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    // More generous limits for authenticated users
    return req.user ? 1000 : 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logSecurityEvent(
      SecurityEvent.SUSPICIOUS_ACTIVITY,
      req,
      { 
        reason: 'api_rate_limit_exceeded',
        endpoint: req.path,
        method: req.method,
        isAuthenticated: !!req.user
      },
      'medium'
    );
    
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please slow down your requests',
      retryAfter: 900 // 15 minutes
    });
  }
});