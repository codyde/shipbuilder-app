import crypto from 'crypto';

// API Key configuration
const API_KEY_LENGTH = 32; // bytes
const HASH_ITERATIONS = 100000;
const HASH_KEY_LENGTH = 64;
const HASH_ALGORITHM = 'sha256';

export interface GeneratedApiKey {
  keyId: string;
  plainKey: string; // Only returned once during generation
  keyHash: string;
  prefix: string;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  keyId?: string;
  userId?: string;
}

/**
 * Generate a new API key with secure random bytes
 */
export function generateApiKey(): GeneratedApiKey {
  // Generate random bytes for the key
  const keyBytes = crypto.randomBytes(API_KEY_LENGTH);
  const keyId = crypto.randomUUID();
  
  // Create the full key string
  const prefix = 'sb_'; // shipbuilder prefix
  const keyString = keyBytes.toString('hex');
  const plainKey = `${prefix}${keyString}`;
  
  // Hash the key for storage
  const keyHash = hashApiKey(plainKey);
  
  return {
    keyId,
    plainKey,
    keyHash,
    prefix,
  };
}

/**
 * Hash an API key using PBKDF2 with salt
 */
export function hashApiKey(plainKey: string): string {
  // Extract the actual key part (remove prefix)
  const keyWithoutPrefix = plainKey.startsWith('sb_') ? plainKey.slice(3) : plainKey;
  
  // Use a consistent salt based on the key itself to ensure same key always produces same hash
  // This is necessary for verification, but we add entropy with iterations
  const salt = crypto.createHash('sha256').update(keyWithoutPrefix).digest();
  
  const hash = crypto.pbkdf2Sync(keyWithoutPrefix, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM);
  
  return hash.toString('hex');
}

/**
 * Verify if a plain API key matches a stored hash
 */
export function verifyApiKey(plainKey: string, storedHash: string): boolean {
  try {
    const computedHash = hashApiKey(plainKey);
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (error) {
    // If any error occurs during verification, return false
    return false;
  }
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // API key should start with 'sb_' and be followed by 64 hex characters
  const apiKeyRegex = /^sb_[a-f0-9]{64}$/;
  return apiKeyRegex.test(key);
}

/**
 * Extract prefix from API key
 */
export function extractKeyPrefix(plainKey: string): string {
  if (plainKey.startsWith('sb_')) {
    return 'sb_';
  }
  return '';
}

/**
 * Generate a shortened display version of the API key for UI
 */
export function getDisplayKey(plainKey: string): string {
  if (plainKey.length < 10) return plainKey;
  
  const prefix = extractKeyPrefix(plainKey);
  const keyPart = plainKey.slice(prefix.length);
  
  return `${prefix}${keyPart.slice(0, 8)}...${keyPart.slice(-4)}`;
}

/**
 * Check if an API key is expired
 */
export function isApiKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // No expiration set
  return new Date() > expiresAt;
}