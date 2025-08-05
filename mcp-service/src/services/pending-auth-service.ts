import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

export interface PendingAuthRequest {
  id: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  code_challenge: string;
  code_challenge_method: string;
  user_id?: string; // Set after user authentication
  created_at: number;
  expires_at: number;
}

/**
 * Service for managing pending MCP OAuth authorization requests
 * Uses Redis for persistence across service restarts
 */
export class PendingAuthService {
  private redis: Redis | null = null;
  private memoryStore = new Map<string, PendingAuthRequest>();
  private readonly prefix = 'mcp_auth:';
  private readonly defaultTTL = 300; // 5 minutes

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          lazyConnect: true
        });
        
        this.redis.on('error', (error) => {
          logger.error('Redis connection error in PendingAuthService', { error });
          // Fall back to memory storage
          this.redis = null;
        });

        await this.redis.connect();
        logger.info('PendingAuthService connected to Redis');
      } else {
        logger.info('PendingAuthService using memory storage (no REDIS_URL)');
      }
    } catch (error) {
      logger.error('Failed to initialize Redis for PendingAuthService', { error });
      this.redis = null;
    }
  }

  /**
   * Create a new pending authorization request
   */
  async createPendingAuth(params: {
    client_id: string;
    redirect_uri: string;
    scope: string;
    state?: string;
    code_challenge: string;
    code_challenge_method: string;
  }): Promise<string> {
    const authId = uuidv4();
    const now = Date.now();
    
    const request: PendingAuthRequest = {
      id: authId,
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      scope: params.scope,
      state: params.state,
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
      created_at: now,
      expires_at: now + (this.defaultTTL * 1000)
    };

    try {
      if (this.redis) {
        await this.redis.setex(
          `${this.prefix}${authId}`,
          this.defaultTTL,
          JSON.stringify(request)
        );
      } else {
        // Fallback to memory storage
        this.memoryStore.set(authId, request);
        // Auto-cleanup after TTL
        setTimeout(() => {
          this.memoryStore.delete(authId);
        }, this.defaultTTL * 1000);
      }

      logger.info('Created pending MCP authorization', {
        authId,
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        scope: params.scope
      });

      return authId;
    } catch (error) {
      logger.error('Failed to create pending authorization', {
        error: error instanceof Error ? error.message : String(error),
        authId,
        client_id: params.client_id
      });
      throw new Error('Failed to create pending authorization');
    }
  }

  /**
   * Get a pending authorization request by ID
   */
  async getPendingAuth(authId: string): Promise<PendingAuthRequest | null> {
    try {
      let request: PendingAuthRequest | null = null;

      if (this.redis) {
        const data = await this.redis.get(`${this.prefix}${authId}`);
        if (data) {
          request = JSON.parse(data);
        }
      } else {
        // Fallback to memory storage
        request = this.memoryStore.get(authId) || null;
      }

      if (!request) {
        logger.debug('Pending authorization not found', { authId });
        return null;
      }

      // Check if expired
      if (Date.now() > request.expires_at) {
        logger.info('Pending authorization expired', { authId });
        await this.deletePendingAuth(authId);
        return null;
      }

      return request;
    } catch (error) {
      logger.error('Failed to get pending authorization', {
        error: error instanceof Error ? error.message : String(error),
        authId
      });
      return null;
    }
  }

  /**
   * Update a pending authorization with user information after authentication
   */
  async updatePendingAuth(authId: string, userId: string): Promise<boolean> {
    try {
      const request = await this.getPendingAuth(authId);
      if (!request) {
        logger.warn('Cannot update non-existent pending authorization', { authId, userId });
        return false;
      }

      request.user_id = userId;

      if (this.redis) {
        const remainingTTL = Math.max(0, Math.floor((request.expires_at - Date.now()) / 1000));
        await this.redis.setex(
          `${this.prefix}${authId}`,
          remainingTTL,
          JSON.stringify(request)
        );
      } else {
        // Memory storage already has the reference
        this.memoryStore.set(authId, request);
      }

      logger.info('Updated pending authorization with user', {
        authId,
        userId,
        client_id: request.client_id
      });

      return true;
    } catch (error) {
      logger.error('Failed to update pending authorization', {
        error: error instanceof Error ? error.message : String(error),
        authId,
        userId
      });
      return false;
    }
  }

  /**
   * Delete a pending authorization request
   */
  async deletePendingAuth(authId: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(`${this.prefix}${authId}`);
      } else {
        this.memoryStore.delete(authId);
      }

      logger.debug('Deleted pending authorization', { authId });
    } catch (error) {
      logger.error('Failed to delete pending authorization', {
        error: error instanceof Error ? error.message : String(error),
        authId
      });
    }
  }

  /**
   * Clean up expired authorizations (mainly for memory storage)
   */
  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    try {
      if (this.redis) {
        // Redis handles TTL automatically, but we can scan for any that might be stuck
        const keys = await this.redis.keys(`${this.prefix}*`);
        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            const request = JSON.parse(data);
            if (now > request.expires_at) {
              await this.redis.del(key);
              cleanedCount++;
            }
          }
        }
      } else {
        // Clean up memory storage
        for (const [authId, request] of this.memoryStore.entries()) {
          if (now > request.expires_at) {
            this.memoryStore.delete(authId);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired pending authorizations', { count: cleanedCount });
      }
    } catch (error) {
      logger.error('Failed to cleanup pending authorizations', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return cleanedCount;
  }

  /**
   * Get stats about pending authorizations
   */
  async getStats(): Promise<{ total: number; withUser: number }> {
    try {
      let total = 0;
      let withUser = 0;

      if (this.redis) {
        const keys = await this.redis.keys(`${this.prefix}*`);
        total = keys.length;
        
        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            const request = JSON.parse(data);
            if (request.user_id) {
              withUser++;
            }
          }
        }
      } else {
        total = this.memoryStore.size;
        for (const request of this.memoryStore.values()) {
          if (request.user_id) {
            withUser++;
          }
        }
      }

      return { total, withUser };
    } catch (error) {
      logger.error('Failed to get pending authorization stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { total: 0, withUser: 0 };
    }
  }

  /**
   * Shutdown the service and clean up connections
   */
  async shutdown(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }
      this.memoryStore.clear();
      logger.info('PendingAuthService shut down');
    } catch (error) {
      logger.error('Error shutting down PendingAuthService', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Export singleton instance
export const pendingAuthService = new PendingAuthService();