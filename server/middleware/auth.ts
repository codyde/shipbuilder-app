import { Request, Response, NextFunction } from 'express';
import { databaseService } from '../db/database-service.js';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

// Fake authentication middleware
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for user ID in session/cookie (for fake auth, we'll use a header)
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user from database
    const user = await databaseService.getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    // Add user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Optional authentication middleware (doesn't fail if no auth)
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (userId) {
      const user = await databaseService.getUserById(userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
}