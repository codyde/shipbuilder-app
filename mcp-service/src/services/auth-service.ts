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
    
    // In production, use the main app URL; in development, use localhost
    this.apiBaseUrl = process.env.API_BASE_URL || 
      (process.env.NODE_ENV === 'production' ? 'https://shipbuilder.app' : 'http://localhost:3001');
    
    logger.info('AuthService initialized', {
      apiBaseUrl: this.apiBaseUrl,
      environment: process.env.NODE_ENV || 'development'
    });
  }

  /**
   * Validate any JWT token (main app, MCP, or service tokens)
   * Consolidated method that handles all token types
   */
  async validateToken(token: string): Promise<UserInfo | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      logger.info('Token validated', {
        userId: decoded.userId,
        email: decoded.email,
        type: decoded.type || 'main-app',
        aud: decoded.aud,
        iss: decoded.iss
      });

      return {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name || decoded.email // Fallback to email if name is not present
      };
    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : String(error),
        tokenLength: token?.length,
        tokenPrefix: token?.substring(0, 20) + '...'
      });
      return null;
    }
  }

  /**
   * Generate MCP access token for OAuth clients
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
   * Generate API-compatible JWT token for service calls
   */
  generateAPIToken(userId: string, email: string, name: string): string {
    const payload = {
      userId,
      email,
      name,
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
   * Get user by ID via API
   */
  async getUserById(userId: string): Promise<{ id: string; email: string; name: string } | null> {
    try {
      // Use service-to-service endpoint with service token
      const serviceToken = process.env.SERVICE_TOKEN || 'default-service-token';
      // Ensure no double slashes in URL
      const baseUrl = this.apiBaseUrl.endsWith('/') ? this.apiBaseUrl.slice(0, -1) : this.apiBaseUrl;
      const url = `${baseUrl}/api/auth/service/user/${userId}`;
      
      logger.info('Making service-to-service user lookup', {
        url,
        userId,
        hasServiceToken: !!serviceToken,
        serviceTokenPrefix: serviceToken?.substring(0, 8) + '...'
      });
      
      const response = await fetch(url, {
        headers: {
          'X-Service-Token': serviceToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const responseText = await response.text();
        let errorDetails = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          errorDetails = errorJson.error || responseText;
        } catch {}
        
        logger.warn('User not found via API', {
          userId,
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
          serviceTokenConfigured: !!serviceToken && serviceToken !== 'default-service-token',
          apiUrl: this.apiBaseUrl
        });
        
        // Log specific guidance for common issues
        if (response.status === 401) {
          logger.error('SERVICE TOKEN MISMATCH: The SERVICE_TOKEN environment variable must be set to the same value in both the main application and MCP service');
        }
        
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
      logger.error('Failed to get user by ID via service API', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });
      return null;
    }
  }

}