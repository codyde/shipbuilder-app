import crypto from 'crypto';
import { logger } from '../lib/logger.js';

interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
  client_id: string;
  scope?: string;
  created_at: Date;
  user_id?: string;
  approved?: boolean;
  denied?: boolean;
}

interface DeviceFlowResult {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

/**
 * In-memory storage for device codes
 * In production, this should be Redis or database
 */
const deviceCodes = new Map<string, DeviceCode>();

/**
 * Generate a human-readable user code
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // No 0/O confusion
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) result += '-'; // Format: ABCD-1234
  }
  return result;
}

/**
 * Generate a secure device code
 */
function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Clean up expired device codes
 */
function cleanupExpiredCodes() {
  const now = new Date();
  for (const [key, code] of deviceCodes.entries()) {
    const expiresAt = new Date(code.created_at.getTime() + (code.expires_in * 1000));
    if (now > expiresAt) {
      deviceCodes.delete(key);
      logger.info('Cleaned up expired device code', { device_code: key });
    }
  }
}

// Clean up expired codes every 5 minutes
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

export class DeviceFlowService {
  /**
   * Generate device and user codes for OAuth device flow
   */
  static generateDeviceCode(
    clientId: string, 
    scope?: string,
    baseUrl?: string
  ): DeviceFlowResult {
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const expiresIn = 15 * 60; // 15 minutes
    const interval = 5; // Poll every 5 seconds

    const verificationUri = `${baseUrl || 'http://localhost:5173'}/device`;
    const verificationUriComplete = `${verificationUri}?user_code=${userCode}`;

    const codeData: DeviceCode = {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      expires_in: expiresIn,
      interval,
      client_id: clientId,
      scope,
      created_at: new Date(),
    };

    deviceCodes.set(deviceCode, codeData);

    logger.info('Generated device code', {
      device_code: deviceCode,
      user_code: userCode,
      client_id: clientId,
      expires_in: expiresIn,
    });

    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: verificationUriComplete,
      expires_in: expiresIn,
      interval,
    };
  }

  /**
   * Get device code by device_code
   */
  static getDeviceCode(deviceCode: string): DeviceCode | null {
    const code = deviceCodes.get(deviceCode);
    if (!code) return null;

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(code.created_at.getTime() + (code.expires_in * 1000));
    if (now > expiresAt) {
      deviceCodes.delete(deviceCode);
      return null;
    }

    return code;
  }

  /**
   * Get device code by user_code
   */
  static getDeviceCodeByUserCode(userCode: string): DeviceCode | null {
    for (const code of deviceCodes.values()) {
      if (code.user_code === userCode) {
        // Check if expired
        const now = new Date();
        const expiresAt = new Date(code.created_at.getTime() + (code.expires_in * 1000));
        if (now > expiresAt) {
          deviceCodes.delete(code.device_code);
          return null;
        }
        return code;
      }
    }
    return null;
  }

  /**
   * Approve device code (user grants access)
   */
  static approveDeviceCode(deviceCode: string, userId: string): boolean {
    const code = deviceCodes.get(deviceCode);
    if (!code) return false;

    code.user_id = userId;
    code.approved = true;
    code.denied = false;

    logger.info('Device code approved', {
      device_code: deviceCode,
      user_id: userId,
      client_id: code.client_id,
    });

    return true;
  }

  /**
   * Deny device code (user denies access)
   */
  static denyDeviceCode(deviceCode: string): boolean {
    const code = deviceCodes.get(deviceCode);
    if (!code) return false;

    code.denied = true;
    code.approved = false;

    logger.info('Device code denied', {
      device_code: deviceCode,
      client_id: code.client_id,
    });

    return true;
  }

  /**
   * Check if device code is approved and get user info
   */
  static checkDeviceCodeStatus(deviceCode: string): {
    status: 'pending' | 'approved' | 'denied' | 'expired';
    userId?: string;
    clientId?: string;
  } {
    const code = this.getDeviceCode(deviceCode);
    
    if (!code) {
      return { status: 'expired' };
    }

    if (code.denied) {
      return { status: 'denied', clientId: code.client_id };
    }

    if (code.approved && code.user_id) {
      return { 
        status: 'approved', 
        userId: code.user_id, 
        clientId: code.client_id 
      };
    }

    return { status: 'pending', clientId: code.client_id };
  }

  /**
   * Consume device code (delete after successful token exchange)
   */
  static consumeDeviceCode(deviceCode: string): void {
    deviceCodes.delete(deviceCode);
    logger.info('Device code consumed', { device_code: deviceCode });
  }

  /**
   * Get all device codes (for debugging)
   */
  static getAllDeviceCodes(): DeviceCode[] {
    return Array.from(deviceCodes.values());
  }
}