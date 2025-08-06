import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import { createSessionStorage, type SessionStorage } from './session-storage.js';

export interface MCPSession {
  // Core session info
  userId: string;
  connectionId: string;
  createdAt: Date;
  lastActivity: Date;
  
  // MCP protocol features
  eventSequence: number;  // For resumable connections
  clientCapabilities: any;
  serverCapabilities: any;
  
  // Connection metadata
  userAgent: string;
  clientVersion?: string;
  
  // Context for multi-step operations
  context: Record<string, any>;
  
  // Active stream tracking
  activeStreams: Set<string>;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalUsers: number;
  avgSessionDuration: number;
}

export class MCPSessionService {
  private storage: SessionStorage;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours (extended for better development UX)
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
  private readonly HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    this.storage = createSessionStorage();
    this.startCleanup();
    logger.info('MCPSessionService initialized', {
      sessionTimeout: this.SESSION_TIMEOUT,
      cleanupInterval: this.CLEANUP_INTERVAL,
      storageType: this.storage.constructor.name
    });
  }
  
  /**
   * Generate session token from JWT token
   * This creates a stable session identifier that doesn't expose the JWT
   */
  private generateSessionToken(jwtToken: string): string {
    return createHash('sha256').update(jwtToken).digest('hex').slice(0, 24);
  }
  
  /**
   * Get or create session for a JWT token
   */
  async getOrCreateSession(jwtToken: string, userInfo: { userId: string; email: string; name: string }, req: any): Promise<MCPSession> {
    const sessionToken = this.generateSessionToken(jwtToken);
    
    let session = await this.storage.get(sessionToken);
    
    if (!session) {
      // Create new session
      session = {
        userId: userInfo.userId,
        connectionId: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        createdAt: new Date(),
        lastActivity: new Date(),
        eventSequence: 0,
        clientCapabilities: {},
        serverCapabilities: {
          tools: { listChanged: false },
          resources: {},
          prompts: {},
          logging: {}
        },
        userAgent: req.headers['user-agent'] || 'unknown',
        clientVersion: req.headers['x-client-version'],
        context: {},
        activeStreams: new Set()
      };
      
      await this.storage.set(sessionToken, session, this.SESSION_TIMEOUT / 1000);
      
      logger.info('Created new MCP session', {
        sessionToken: sessionToken.slice(0, 8) + '...',
        connectionId: session.connectionId,
        userId: userInfo.userId,
        userAgent: session.userAgent
      });
    } else {
      // Update existing session
      session.lastActivity = new Date();
      await this.storage.set(sessionToken, session, this.SESSION_TIMEOUT / 1000);
      
      logger.debug('Retrieved existing MCP session', {
        sessionToken: sessionToken.slice(0, 8) + '...',
        connectionId: session.connectionId,
        userId: userInfo.userId,
        age: Date.now() - session.createdAt.getTime()
      });
    }
    
    return session;
  }
  
  /**
   * Get session by JWT token (if it exists)
   */
  async getSession(jwtToken: string): Promise<MCPSession | null> {
    const sessionToken = this.generateSessionToken(jwtToken);
    const session = await this.storage.get(sessionToken);
    
    if (session) {
      session.lastActivity = new Date();
      await this.storage.set(sessionToken, session, this.SESSION_TIMEOUT / 1000);
    }
    
    return session;
  }
  
  /**
   * Update session context for multi-step operations
   */
  async updateSessionContext(jwtToken: string, context: Partial<Record<string, any>>): Promise<void> {
    const session = await this.getSession(jwtToken);
    if (session) {
      session.context = { ...session.context, ...context };
      await this.storage.set(this.generateSessionToken(jwtToken), session, this.SESSION_TIMEOUT / 1000);
      logger.debug('Updated session context', {
        connectionId: session.connectionId,
        contextKeys: Object.keys(context)
      });
    }
  }
  
  /**
   * Get next event sequence number for resumable connections
   */
  async getNextEventSequence(jwtToken: string): Promise<number> {
    const session = await this.getSession(jwtToken);
    if (session) {
      session.eventSequence++;
      await this.storage.set(this.generateSessionToken(jwtToken), session, this.SESSION_TIMEOUT / 1000);
      return session.eventSequence;
    }
    return 1;
  }
  
  /**
   * Add active stream to session
   */
  async addActiveStream(jwtToken: string, streamId: string): Promise<void> {
    const session = await this.getSession(jwtToken);
    if (session) {
      session.activeStreams.add(streamId);
      await this.storage.set(this.generateSessionToken(jwtToken), session, this.SESSION_TIMEOUT / 1000);
      logger.debug('Added active stream', {
        connectionId: session.connectionId,
        streamId,
        totalStreams: session.activeStreams.size
      });
    }
  }
  
  /**
   * Remove active stream from session
   */
  async removeActiveStream(jwtToken: string, streamId: string): Promise<void> {
    const session = await this.getSession(jwtToken);
    if (session) {
      session.activeStreams.delete(streamId);
      await this.storage.set(this.generateSessionToken(jwtToken), session, this.SESSION_TIMEOUT / 1000);
      logger.debug('Removed active stream', {
        connectionId: session.connectionId,
        streamId,
        remainingStreams: session.activeStreams.size
      });
    }
  }
  
  /**
   * Remove session
   */
  async removeSession(jwtToken: string): Promise<void> {
    const sessionToken = this.generateSessionToken(jwtToken);
    const session = await this.storage.get(sessionToken);
    
    if (session) {
      await this.storage.delete(sessionToken);
      
      logger.info('Removed MCP session', {
        sessionToken: sessionToken.slice(0, 8) + '...',
        connectionId: session.connectionId,
        userId: session.userId,
        duration: Date.now() - session.createdAt.getTime()
      });
    }
  }
  
  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<MCPSession[]> {
    const allSessionKeys = await this.storage.keys('*');
    const sessions: MCPSession[] = [];
    
    for (const key of allSessionKeys) {
      const session = await this.storage.get(key);
      if (session && session.userId === userId) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
  
  /**
   * Get session statistics
   */
  async getStats(): Promise<SessionStats> {
    const storageStats = await this.storage.getStats();
    const allSessionKeys = await this.storage.keys('*');
    
    let activeSessions = 0;
    let totalDuration = 0;
    const now = Date.now();
    
    for (const key of allSessionKeys) {
      const session = await this.storage.get(key);
      if (session) {
        if (now - session.lastActivity.getTime() < this.HEARTBEAT_TIMEOUT) {
          activeSessions++;
        }
        totalDuration += (now - session.createdAt.getTime());
      }
    }
    
    const avgDuration = allSessionKeys.length > 0 ? totalDuration / allSessionKeys.length : 0;
    
    return {
      totalSessions: storageStats.totalSessions,
      activeSessions,
      totalUsers: storageStats.activeUsers,
      avgSessionDuration: avgDuration
    };
  }
  
  /**
   * Start periodic cleanup of expired sessions
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL);
  }
  
  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const cleanedCount = await this.storage.cleanup();
      
      if (cleanedCount > 0) {
        const stats = await this.storage.getStats();
        logger.info('Session cleanup completed', {
          expiredSessions: cleanedCount,
          remainingSessions: stats.totalSessions,
          activeUsers: stats.activeUsers
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Shutdown cleanup
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    try {
      const stats = await this.storage.getStats();
      logger.info('MCPSessionService shutdown', {
        totalSessions: stats.totalSessions,
        totalUsers: stats.activeUsers
      });
      
      await this.storage.shutdown();
    } catch (error) {
      logger.error('Error during session service shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Export singleton instance
export const sessionService = new MCPSessionService();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  await sessionService.shutdown();
});

process.on('SIGINT', async () => {
  await sessionService.shutdown();
});