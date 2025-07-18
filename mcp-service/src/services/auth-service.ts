import jwt from 'jsonwebtoken';
import { 
  MCP_OAUTH_SCOPES, 
  MCP_TOKEN_EXPIRY 
} from '../config/mcp-config.js';
import { logger } from '../utils/logger.js';

export interface UserInfo {
  userId: string;
  email: string;
  name: string;
}

export class AuthService {
  private jwtSecret: string;
  private apiBaseUrl: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET!;
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  }

  /**
   * Validate JWT token issued by main application
   */
  async validateMainAppToken(token: string): Promise<UserInfo | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Verify user still exists by calling the main API
      const userExists = await this.verifyUserExists(decoded.userId, token);
      
      if (!userExists) {
        logger.warn('User not found via API', { userId: decoded.userId });
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      };
    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Generate MCP-specific token
   */
  generateMCPToken(userId: string, email: string, name: string, clientId?: string): string {
    const payload = {
      userId,
      email,
      name,
      type: 'mcp',
      scope: MCP_OAUTH_SCOPES.join(' '),
      iat: Math.floor(Date.now() / 1000),
      ...(clientId && { aud: clientId })
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: MCP_TOKEN_EXPIRY });
  }

  /**
   * Generate main app compatible JWT token for API calls
   */
  generateMainAppToken(userId: string, email: string, name: string): string {
    const payload = {
      userId,
      email,
      provider: 'mcp-service',
      aud: 'project-management-app',
      iss: 'auth-service'
    };

    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: '1h',
      algorithm: 'HS256'
    });
  }

  /**
   * Validate MCP token
   */
  async validateMCPToken(token: string): Promise<UserInfo | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      if (decoded.type !== 'mcp') {
        logger.warn('Invalid token type', { type: decoded.type });
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      };
    } catch (error) {
      logger.error('MCP token validation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Validate any JWT token (main app or MCP)
   */
  async validateToken(token: string): Promise<UserInfo | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      return {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      };
    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get user by ID via API
   */
  async getUserById(userId: string): Promise<{ id: string; email: string; name: string } | null> {
    try {
      // For user lookup, we'll create a temporary token that matches main app format
      const tempToken = jwt.sign({
        userId,
        email: 'temp@temp.com', // Temporary placeholder, will be overridden by actual user data
        provider: 'mcp-service',
        aud: 'project-management-app',
        iss: 'auth-service'
      }, this.jwtSecret, { 
        expiresIn: '5m',
        algorithm: 'HS256'
      });
      
      const response = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${tempToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return null;
      }

      const responseData = await response.json() as any;
      const user = responseData.user; // Extract user from nested structure
      return {
        id: user.id,
        email: user.email,
        name: user.name
      };
    } catch (error) {
      logger.error('Failed to get user by ID via API', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return null;
    }
  }

  /**
   * Verify if user exists via API
   */
  private async verifyUserExists(userId: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('Failed to verify user exists via API', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return false;
    }
  }
}