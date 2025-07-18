import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth-service.js';
import { logger } from '../utils/logger.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        name: string;
      };
    }
  }
}

const authService = new AuthService();

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Provide token via Authorization header'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    // Validate the token
    const userInfo = await authService.validateToken(token);
    
    if (!userInfo) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid or expired token'
      });
      return;
    }

    // Add user info to request
    req.user = userInfo;
    
    logger.info('Request authenticated', {
      userId: userInfo.userId,
      email: userInfo.email,
      method: req.method,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      method: req.method,
      path: req.path
    });
    
    res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Middleware specifically for MCP token authentication
 */
export const mcpAuthMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Provide MCP token via Authorization header'
      });
      return;
    }

    const token = authHeader.substring(7);
    
    // Validate MCP token specifically
    const userInfo = await authService.validateMCPToken(token);
    
    if (!userInfo) {
      res.status(401).json({
        error: 'Invalid token type',
        message: 'Use an MCP token obtained from /token'
      });
      return;
    }

    // Add user info to request
    req.user = userInfo;
    
    next();
  } catch (error) {
    logger.error('MCP authentication middleware error', {
      error: error instanceof Error ? error.message : String(error),
      method: req.method,
      path: req.path
    });
    
    res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired MCP token'
    });
  }
};