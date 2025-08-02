import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger.js';

interface OAuthAuthorizationEntry {
  authorization_code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
  expires_at: Date;
  status: 'pending' | 'used';
  userId?: string;
}

export class OAuthService {
  private static authorizationCodes = new Map<string, OAuthAuthorizationEntry>();
  
  // Clean up expired codes every 10 minutes
  static {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];
      
      for (const [authCode, entry] of OAuthService.authorizationCodes.entries()) {
        if (now > entry.expires_at.getTime()) {
          expired.push(authCode);
        }
      }
      
      // Clean up in batch
      for (const authCode of expired) {
        const entry = OAuthService.authorizationCodes.get(authCode);
        OAuthService.authorizationCodes.delete(authCode);
        logger.info('Cleaned up expired authorization code', { 
          authorization_code: authCode.substring(0, 8) + '...',
          client_id: entry?.client_id 
        });
      }
      
      if (expired.length > 0) {
        logger.info(`Cleaned up ${expired.length} expired authorization codes`);
      }
    }, 10 * 60 * 1000);
  }

  static generateAuthorizationCode(params: {
    client_id: string;
    redirect_uri: string;
    code_challenge?: string;
    code_challenge_method?: string;
    scope?: string;
    state?: string;
  }): string {
    const authorizationCode = randomBytes(32).toString('hex');
    const expiresIn = 10 * 60; // 10 minutes
    
    const entry: OAuthAuthorizationEntry = {
      authorization_code: authorizationCode,
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
      scope: params.scope,
      state: params.state,
      expires_at: new Date(Date.now() + expiresIn * 1000),
      status: 'pending',
    };
    
    this.authorizationCodes.set(authorizationCode, entry);
    
    logger.info('Generated authorization code', {
      client_id: params.client_id,
      redirect_uri: params.redirect_uri,
      authorization_code: authorizationCode.substring(0, 8) + '...',
      expires_in: expiresIn,
    });
    
    return authorizationCode;
  }

  static approveAuthorizationCode(authorizationCode: string, userId: string): boolean {
    const entry = this.authorizationCodes.get(authorizationCode);
    if (!entry || entry.status !== 'pending' || Date.now() > entry.expires_at.getTime()) {
      return false;
    }
    
    // Set userId to mark as approved (we check for userId presence in validation)
    entry.userId = userId;
    
    logger.info('Authorization code approved', {
      authorization_code: authorizationCode.substring(0, 8) + '...',
      user_id: userId,
      client_id: entry.client_id,
    });
    
    return true;
  }

  static async validateAndConsumeAuthorizationCode(params: {
    authorization_code: string;
    client_id: string;
    redirect_uri: string;
    code_verifier?: string;
  }): Promise<{ 
    valid: boolean;
    userId?: string;
    error?: string;
  }> {
    const entry = this.authorizationCodes.get(params.authorization_code);
    
    // Check if code exists and hasn't expired
    if (!entry || Date.now() > entry.expires_at.getTime()) {
      if (entry) this.authorizationCodes.delete(params.authorization_code);
      return { valid: false, error: 'Invalid or expired authorization code' };
    }
    
    // Check if code is already used
    if (entry.status === 'used') {
      return { valid: false, error: 'Authorization code already used' };
    }
    
    // Check if code is approved (has userId)
    if (!entry.userId) {
      return { valid: false, error: 'Authorization code not yet approved by user' };
    }
    
    // Validate client and redirect URI
    if (entry.client_id !== params.client_id || entry.redirect_uri !== params.redirect_uri) {
      return { valid: false, error: 'Client ID or redirect URI mismatch' };
    }
    
    // Validate PKCE (only support S256 for security)
    if (entry.code_challenge) {
      if (!params.code_verifier) {
        return { valid: false, error: 'Code verifier required for PKCE' };
      }
      
      if (entry.code_challenge_method !== 'S256') {
        return { valid: false, error: 'Only S256 PKCE method supported' };
      }
      
      const computedChallenge = createHash('sha256')
        .update(params.code_verifier)
        .digest('base64url');
      
      // Use timing-safe comparison to prevent timing attacks
      const expectedBuffer = Buffer.from(entry.code_challenge);
      const computedBuffer = Buffer.from(computedChallenge);
      
      if (expectedBuffer.length !== computedBuffer.length || 
          !timingSafeEqual(expectedBuffer, computedBuffer)) {
        return { valid: false, error: 'Invalid code verifier' };
      }
    }
    
    // Mark as used and schedule cleanup
    entry.status = 'used';
    
    logger.info('Authorization code validated and consumed', {
      authorization_code: params.authorization_code.substring(0, 8) + '...',
      user_id: entry.userId,
      client_id: entry.client_id,
    });
    
    // Clean up after 1 minute
    setTimeout(() => {
      this.authorizationCodes.delete(params.authorization_code);
    }, 60 * 1000);
    
    return { valid: true, userId: entry.userId };
  }

  static getAuthorizationCodeDetails(authorizationCode: string): OAuthAuthorizationEntry | null {
    return this.authorizationCodes.get(authorizationCode) || null;
  }
}