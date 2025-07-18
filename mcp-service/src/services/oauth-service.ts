import { randomBytes, createHash } from 'crypto';
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
  status: 'pending' | 'used' | 'expired';
  userId?: string;
}

export class OAuthService {
  private static authorizationCodes = new Map<string, OAuthAuthorizationEntry>();
  
  // Clean up expired codes every 5 minutes
  static {
    setInterval(() => {
      const now = Date.now();
      for (const [authCode, entry] of OAuthService.authorizationCodes.entries()) {
        if (now > entry.expires_at.getTime()) {
          OAuthService.authorizationCodes.delete(authCode);
          logger.info('Cleaned up expired authorization code', { 
            authorization_code: authCode.substring(0, 8) + '...',
            client_id: entry.client_id 
          });
        }
      }
    }, 5 * 60 * 1000);
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
    if (!entry || entry.status !== 'pending') return false;
    
    entry.status = 'used';
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
    
    if (!entry) {
      return { valid: false, error: 'Invalid authorization code' };
    }
    
    if (entry.status !== 'used') {
      return { valid: false, error: 'Authorization code not approved or already used' };
    }
    
    if (Date.now() > entry.expires_at.getTime()) {
      this.authorizationCodes.delete(params.authorization_code);
      return { valid: false, error: 'Authorization code expired' };
    }
    
    if (entry.client_id !== params.client_id) {
      return { valid: false, error: 'Client ID mismatch' };
    }
    
    if (entry.redirect_uri !== params.redirect_uri) {
      return { valid: false, error: 'Redirect URI mismatch' };
    }
    
    // Validate PKCE if used
    if (entry.code_challenge && entry.code_challenge_method) {
      if (!params.code_verifier) {
        return { valid: false, error: 'Code verifier required for PKCE' };
      }
      
      let computedChallenge: string;
      if (entry.code_challenge_method === 'S256') {
        computedChallenge = createHash('sha256')
          .update(params.code_verifier)
          .digest('base64url');
      } else if (entry.code_challenge_method === 'plain') {
        computedChallenge = params.code_verifier;
      } else {
        return { valid: false, error: 'Unsupported code challenge method' };
      }
      
      if (computedChallenge !== entry.code_challenge) {
        return { valid: false, error: 'Invalid code verifier' };
      }
    }
    
    // Mark as consumed and remove
    this.authorizationCodes.delete(params.authorization_code);
    
    logger.info('Authorization code validated and consumed', {
      authorization_code: params.authorization_code.substring(0, 8) + '...',
      user_id: entry.userId,
      client_id: entry.client_id,
    });
    
    return { valid: true, userId: entry.userId };
  }

  static getAuthorizationCodeDetails(authorizationCode: string): OAuthAuthorizationEntry | null {
    return this.authorizationCodes.get(authorizationCode) || null;
  }
}