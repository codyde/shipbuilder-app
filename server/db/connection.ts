import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

// Configure SSL settings based on environment and provider
const isDevelopment = process.env.NODE_ENV === 'development';
const isRailwayDb = process.env.DATABASE_URL?.includes('railway.app') || process.env.DATABASE_URL?.includes('rlwy.net');
const isNeonDb = process.env.DATABASE_URL?.includes('neon.tech');

const poolConfig: any = {
  connectionString: process.env.DATABASE_URL,
};

// Handle SSL configuration based on provider and environment
if (!isDevelopment) {
  // Production environment
  if (isRailwayDb) {
    // Railway requires SSL in production but with specific settings
    poolConfig.ssl = {
      rejectUnauthorized: false,
      require: true
    };
  } else if (isNeonDb) {
    // NeonDB requires SSL in production
    poolConfig.ssl = true;
  } else {
    // Default cloud PostgreSQL SSL config
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }
} else if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  // Development with explicit SSL requirement
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

export const db = drizzle(pool, { schema });