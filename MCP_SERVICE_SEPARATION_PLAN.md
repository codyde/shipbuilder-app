# MCP Service Separation Implementation Plan

## **Executive Summary**

This plan outlines the complete migration of MCP functionality from the main Shipbuilder application to a dedicated `mcp.shipbuilder.app` service. The new architecture will provide cleaner separation of concerns, better scalability, and eliminate proxy complexity.

## **Architecture Overview**

### **Current State**
```
shipbuilder.app (Frontend) → Vite Proxy → api.shipbuilder.app (Backend)
                                      ↳ MCP routes embedded in main app
```

### **Target State**
```
shipbuilder.app (Frontend) → api.shipbuilder.app (Main Backend)
                        ↳ → mcp.shipbuilder.app (Dedicated MCP Service)
```

### **Service Boundaries**
- **Frontend** (`shipbuilder.app`): React app, OAuth consent UI, user management
- **Main Backend** (`api.shipbuilder.app`): Core application APIs, user auth, project management
- **MCP Service** (`mcp.shipbuilder.app`): MCP protocol implementation, OAuth for MCP clients

## **Phase 1: Project Structure Setup**

### **1.1 Create MCP Service Directory**
```bash
mkdir mcp-service
cd mcp-service
```

### **1.2 Initialize MCP Service Package**
```json
// mcp-service/package.json
{
  "name": "shipbuilder-mcp-service",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "@modelcontextprotocol/sdk": "^1.16.0",
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.3",
    "cors": "^2.8.5",
    "@sentry/node": "^7.99.0",
    "helmet": "^7.1.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/cors": "^2.8.17",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.1",
    "@typescript-eslint/parser": "^6.19.1"
  }
}
```

### **1.3 MCP Service Directory Structure**
```
mcp-service/
├── src/
│   ├── index.ts                    # Main server entry point
│   ├── config/
│   │   ├── mcp-config.ts          # MCP configuration (migrated)
│   │   └── mcp-tools.ts           # MCP tools (migrated)
│   ├── services/
│   │   ├── mcp-server.ts          # MCP server implementation (migrated)
│   │   ├── auth-service.ts        # Authentication service
│   │   └── database-service.ts    # Database service (shared logic)
│   ├── routes/
│   │   ├── mcp.ts                 # MCP routes (migrated)
│   │   └── auth.ts                # OAuth routes for MCP
│   ├── middleware/
│   │   ├── auth.ts                # JWT validation middleware
│   │   ├── cors.ts                # CORS configuration
│   │   └── logging.ts             # Request logging
│   ├── utils/
│   │   ├── jwt.ts                 # JWT utilities
│   │   └── logger.ts              # Logging utilities
│   └── types/
│       └── index.ts               # Type definitions
├── dist/                          # Compiled JavaScript
├── tests/                         # Test files
├── .env.example                   # Environment variables template
├── .env.local                     # Local development environment
├── .env.production                # Production environment
├── Dockerfile                     # Docker configuration
├── docker-compose.yml             # Local development setup
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # Service documentation
```

## **Phase 2: Code Migration**

### **2.1 Database Configuration**
```typescript
// mcp-service/src/config/database.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

// Import schemas from main app (shared)
export { users, projects, tasks, comments } from '../../server/db/schema.js';
```

### **2.2 Authentication Service**
```typescript
// mcp-service/src/services/auth-service.ts
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { users } from '../config/database.js';
import { eq } from 'drizzle-orm';

export class AuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET!;
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  /**
   * Validate JWT token issued by main application
   */
  async validateMainAppToken(token: string): Promise<{ userId: string; email: string; name: string } | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Verify user still exists in database
      const user = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
      
      if (!user.length) {
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      };
    } catch (error) {
      console.error('Token validation failed:', error);
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
      scope: 'projects:read tasks:read',
      iat: Math.floor(Date.now() / 1000),
      ...(clientId && { aud: clientId })
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: '30d' });
  }

  /**
   * Validate MCP token
   */
  async validateMCPToken(token: string): Promise<{ userId: string; email: string; name: string } | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      if (decoded.type !== 'mcp') {
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name
      };
    } catch (error) {
      console.error('MCP token validation failed:', error);
      return null;
    }
  }
}
```

### **2.3 MCP Service Configuration**
```typescript
// mcp-service/src/config/mcp-config.ts
/**
 * MCP Service Configuration
 * Optimized for standalone MCP service deployment
 */

export const MCP_SERVICE_CONFIG = {
  // Service Information
  SERVICE_NAME: 'shipbuilder-mcp-service',
  SERVICE_VERSION: '1.0.0',
  MCP_PROTOCOL_VERSION: '2025-03-26',
  
  // Server Configuration
  SERVER_INFO: {
    name: 'shipbuilder-mcp',
    version: '1.0.0',
    description: 'Model Context Protocol server for Shipbuilder project management'
  },

  // OAuth Configuration
  OAUTH_CONFIG: {
    scopes: ['projects:read', 'tasks:read'],
    responseTypes: ['code'],
    grantTypes: ['authorization_code'],
    codeChallengeMethodsSupported: ['S256', 'plain'],
    tokenEndpointAuthMethods: ['client_secret_basic', 'client_secret_post', 'none'],
    bearerMethodsSupported: ['header']
  },

  // Token Configuration
  TOKEN_CONFIG: {
    expiry: '30d',
    expirySeconds: 30 * 24 * 60 * 60
  },

  // Session Configuration
  SESSION_CONFIG: {
    cleanupInterval: 30 * 60 * 1000, // 30 minutes
    maxAge: 2 * 60 * 60 * 1000 // 2 hours
  },

  // Capabilities
  CAPABILITIES: {
    basic: {
      tools: true,
      resources: false,
      prompts: false,
      logging: false
    },
    detailed: {
      tools: { listChanged: false },
      resources: {},
      prompts: {},
      logging: {}
    }
  }
} as const;

/**
 * Get frontend URL for OAuth redirects
 */
export function getFrontendUrl(): string {
  const frontendUrl = process.env.FRONTEND_BASE_URL || 
    (process.env.NODE_ENV === 'production' ? 'https://shipbuilder.app' : 'http://localhost:5173');
  
  return frontendUrl;
}

/**
 * Get MCP service base URL
 */
export function getMCPServiceUrl(req: any): string {
  // In development, use localhost:3002
  // In production, use the actual domain
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:${process.env.PORT || 3002}`;
  }
  
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * Generate OAuth discovery metadata
 */
export function generateOAuthDiscoveryMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/mcp/token`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: MCP_SERVICE_CONFIG.OAUTH_CONFIG.responseTypes,
    grant_types_supported: MCP_SERVICE_CONFIG.OAUTH_CONFIG.grantTypes,
    code_challenge_methods_supported: MCP_SERVICE_CONFIG.OAUTH_CONFIG.codeChallengeMethodsSupported,
    scopes_supported: MCP_SERVICE_CONFIG.OAUTH_CONFIG.scopes,
    token_endpoint_auth_methods_supported: MCP_SERVICE_CONFIG.OAUTH_CONFIG.tokenEndpointAuthMethods,
    introspection_endpoint: `${baseUrl}/mcp/introspect`,
    revocation_endpoint: `${baseUrl}/mcp/revoke`
  };
}
```

### **2.4 Main Service Entry Point**
```typescript
// mcp-service/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { mcpRoutes } from './routes/mcp.js';
import { authRoutes } from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';
import { loggingMiddleware } from './middleware/logging.js';
import { getFrontendUrl } from './config/mcp-config.js';

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API service
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// CORS configuration
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(loggingMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'shipbuilder-mcp-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// OAuth Discovery routes (must be at root level)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const baseUrl = getMCPServiceUrl(req);
  res.json(generateOAuthDiscoveryMetadata(baseUrl));
});

app.get('/.well-known/oauth-protected-resource', (req, res) => {
  const baseUrl = getMCPServiceUrl(req);
  res.json(generateOAuthProtectedResourceMetadata(baseUrl));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/mcp', mcpRoutes);

// Error handling
app.use(Sentry.Handlers.errorHandler());

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MCP Service running on port ${PORT}`);
  console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🔗 Frontend URL: ${getFrontendUrl()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app };
```

### **2.5 Cross-Domain OAuth Routes**
```typescript
// mcp-service/src/routes/auth.ts
import express from 'express';
import { AuthService } from '../services/auth-service.js';
import { getFrontendUrl, getMCPServiceUrl } from '../config/mcp-config.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const authService = new AuthService();

/**
 * OAuth Authorization Endpoint
 * Redirects to main frontend for user consent
 */
router.get('/authorize', async (req, res) => {
  try {
    const { 
      response_type, 
      client_id, 
      redirect_uri, 
      scope, 
      state, 
      code_challenge, 
      code_challenge_method 
    } = req.query;

    // Validate required parameters
    if (response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported'
      });
    }

    if (!client_id || !redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri'
      });
    }

    // Validate PKCE parameters
    if (!code_challenge || !code_challenge_method) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'PKCE parameters required: code_challenge, code_challenge_method'
      });
    }

    // Generate authorization code
    const authorizationCode = generateAuthorizationCode();
    
    // Store authorization request
    await storeAuthorizationRequest(authorizationCode, {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      scope,
      state
    });

    // Redirect to frontend consent screen
    const frontendUrl = getFrontendUrl();
    const mcpServiceUrl = getMCPServiceUrl(req);
    
    const consentUrl = new URL('/mcp-login', frontendUrl);
    consentUrl.searchParams.set('mcp_service', mcpServiceUrl);
    consentUrl.searchParams.set('authorization_code', authorizationCode);
    consentUrl.searchParams.set('client_id', client_id);
    consentUrl.searchParams.set('scope', scope || 'projects:read tasks:read');
    
    res.redirect(consentUrl.toString());

  } catch (error) {
    logger.error('OAuth authorization failed', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process authorization request'
    });
  }
});

/**
 * OAuth Consent Endpoint
 * Handles user consent from frontend
 */
router.post('/consent', async (req, res) => {
  try {
    const { authorization_code, action, main_app_token } = req.body;

    if (!authorization_code || !action) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'authorization_code and action are required'
      });
    }

    // Validate main app token
    const userInfo = await authService.validateMainAppToken(main_app_token);
    if (!userInfo) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid main application token'
      });
    }

    // Get authorization request details
    const authRequest = await getAuthorizationRequest(authorization_code);
    if (!authRequest) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
    }

    if (action === 'approve') {
      // Approve the authorization
      await approveAuthorizationRequest(authorization_code, userInfo.userId);
      
      // Build redirect URL
      const redirectUrl = new URL(authRequest.redirect_uri);
      redirectUrl.searchParams.set('code', authorization_code);
      if (authRequest.state) {
        redirectUrl.searchParams.set('state', authRequest.state);
      }

      res.json({
        success: true,
        redirect_uri: redirectUrl.toString()
      });
    } else {
      // User denied authorization
      const redirectUrl = new URL(authRequest.redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'User denied authorization');
      if (authRequest.state) {
        redirectUrl.searchParams.set('state', authRequest.state);
      }

      res.json({
        success: false,
        redirect_uri: redirectUrl.toString()
      });
    }

  } catch (error) {
    logger.error('OAuth consent failed', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process consent'
    });
  }
});

export { router as authRoutes };
```

## **Phase 3: Frontend Integration**

### **3.1 Update Frontend OAuth Handler**
```typescript
// src/components/MCPConsentScreen.tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function MCPConsentScreen() {
  const [searchParams] = useSearchParams();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mcpService = searchParams.get('mcp_service');
  const authorizationCode = searchParams.get('authorization_code');
  const clientId = searchParams.get('client_id');
  const scope = searchParams.get('scope');

  const handleConsent = async (action: 'approve' | 'deny') => {
    if (!mcpService || !authorizationCode || !token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${mcpService}/api/auth/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorization_code: authorizationCode,
          action,
          main_app_token: token
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to the client's callback URL
        window.location.href = data.redirect_uri;
      } else {
        setError(data.error_description || 'Failed to process consent');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-600 mb-4">Please log in to authorize MCP access</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            MCP Authorization Request
          </h1>
          <p className="text-gray-600">
            A Model Context Protocol client is requesting access to your Shipbuilder data
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">Requested Permissions:</h2>
          <ul className="text-sm text-gray-700 space-y-1">
            {scope?.split(' ').map(s => (
              <li key={s} className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                {s === 'projects:read' ? 'Read your projects' : 
                 s === 'tasks:read' ? 'Read your tasks' : s}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Client ID:</strong> {clientId}
          </p>
          <p className="text-sm text-blue-800 mt-1">
            <strong>Service:</strong> {mcpService}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={() => handleConsent('deny')}
            disabled={loading}
            className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Deny'}
          </button>
          <button
            onClick={() => handleConsent('approve')}
            disabled={loading}
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Approve'}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          By approving, you allow this client to access your Shipbuilder data according to the requested permissions.
        </p>
      </div>
    </div>
  );
}
```

### **3.2 Add MCP Route to Frontend**
```typescript
// src/App.tsx
import { MCPConsentScreen } from './components/MCPConsentScreen';

// Add to your router configuration
<Route path="/mcp-login" element={<MCPConsentScreen />} />
```

## **Phase 4: Development Setup**

### **4.1 Update Root Package.json**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\" \"npm run dev:mcp\"",
    "dev:client": "vite",
    "dev:server": "cd server && npm run dev",
    "dev:mcp": "cd mcp-service && npm run dev",
    "build": "npm run build:client && npm run build:server && npm run build:mcp",
    "build:client": "vite build",
    "build:server": "cd server && npm run build",
    "build:mcp": "cd mcp-service && npm run build"
  }
}
```

### **4.2 Docker Configuration**
```dockerfile
# mcp-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env.production .env

EXPOSE 3002

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml (for local development)
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://localhost:3001
      - VITE_MCP_SERVICE_URL=http://localhost:3002
    depends_on:
      - backend
      - mcp-service

  backend:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/shipbuilder
      - JWT_SECRET=your-jwt-secret
      - FRONTEND_BASE_URL=http://localhost:5173
    depends_on:
      - db

  mcp-service:
    build: ./mcp-service
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/shipbuilder
      - JWT_SECRET=your-jwt-secret
      - FRONTEND_BASE_URL=http://localhost:5173
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=shipbuilder
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```

## **Phase 5: Migration Strategy**

### **5.1 Migration Steps**

#### **Step 1: Preparation**
1. Create feature branch: `git checkout -b feature/mcp-service-separation`
2. Set up MCP service directory structure
3. Install dependencies and configure TypeScript
4. Create basic health check endpoint

#### **Step 2: Code Migration**
1. Copy MCP-related files to new service
2. Update imports and dependencies
3. Create authentication service
4. Set up database connection
5. Test basic functionality

#### **Step 3: Integration**
1. Update frontend OAuth flow
2. Add MCP consent screen
3. Configure CORS for cross-domain requests
4. Test OAuth flow end-to-end

#### **Step 4: Development Environment**
1. Update development scripts
2. Configure Docker Compose
3. Test all three services running together
4. Verify MCP client connection

#### **Step 5: Production Deployment**
1. Configure production environment variables
2. Set up `mcp.shipbuilder.app` subdomain
3. Deploy MCP service
4. Update DNS records
5. Test production OAuth flow

#### **Step 6: Cleanup**
1. Remove MCP routes from main backend
2. Clean up unused dependencies
3. Update documentation
4. Remove development proxy configuration

### **5.2 Testing Strategy**

#### **Unit Tests**
```typescript
// mcp-service/tests/auth-service.test.ts
import { AuthService } from '../src/services/auth-service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('validateMainAppToken', () => {
    it('should validate valid token', async () => {
      // Test implementation
    });

    it('should reject invalid token', async () => {
      // Test implementation
    });
  });
});
```

#### **Integration Tests**
```typescript
// mcp-service/tests/oauth-flow.test.ts
import request from 'supertest';
import { app } from '../src/index';

describe('OAuth Flow', () => {
  it('should redirect to consent screen', async () => {
    const response = await request(app)
      .get('/api/auth/authorize')
      .query({
        response_type: 'code',
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256'
      });

    expect(response.status).toBe(302);
    expect(response.header.location).toContain('/mcp-login');
  });
});
```

#### **MCP Client Tests**
```typescript
// mcp-service/tests/mcp-client.test.ts
describe('MCP Client Integration', () => {
  it('should connect to MCP service', async () => {
    // Test MCP client connection
  });

  it('should discover available tools', async () => {
    // Test tool discovery
  });

  it('should execute tools with authentication', async () => {
    // Test tool execution
  });
});
```

## **Phase 6: Production Considerations**

### **6.1 Environment Variables**

#### **MCP Service Production Environment**
```bash
# mcp-service/.env.production
NODE_ENV=production
PORT=3002
DATABASE_URL=postgresql://user:password@db.shipbuilder.app:5432/shipbuilder
JWT_SECRET=your-production-jwt-secret
FRONTEND_BASE_URL=https://shipbuilder.app
SENTRY_DSN=your-sentry-dsn
```

#### **Main Backend Environment**
```bash
# server/.env.production
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@db.shipbuilder.app:5432/shipbuilder
JWT_SECRET=your-production-jwt-secret
FRONTEND_BASE_URL=https://shipbuilder.app
MCP_SERVICE_URL=https://mcp.shipbuilder.app
```

#### **Frontend Environment**
```bash
# .env.production
VITE_API_BASE_URL=https://api.shipbuilder.app
VITE_MCP_SERVICE_URL=https://mcp.shipbuilder.app
```

### **6.2 Deployment Configuration**

#### **DNS Configuration**
```
A     mcp.shipbuilder.app → [MCP Service IP]
A     api.shipbuilder.app → [Main Backend IP]
A     shipbuilder.app → [Frontend CDN/IP]
```

#### **SSL Certificates**
```bash
# Using Let's Encrypt
certbot certonly --standalone -d mcp.shipbuilder.app
certbot certonly --standalone -d api.shipbuilder.app
certbot certonly --standalone -d shipbuilder.app
```

#### **Load Balancer Configuration**
```yaml
# If using load balancer
backends:
  - name: mcp-service
    servers:
      - address: "localhost:3002"
        weight: 100
  - name: main-backend
    servers:
      - address: "localhost:3001"
        weight: 100
```

### **6.3 Monitoring and Logging**

#### **Health Check Endpoints**
```typescript
// Add to each service
app.get('/health', (req, res) => {
  res.json({
    service: 'mcp-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: await checkDatabaseConnection()
  });
});
```

#### **Logging Configuration**
```typescript
// Structured logging for production
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## **Phase 7: Rollback Strategy**

### **7.1 Rollback Plan**
1. **Immediate Rollback**: Keep original MCP routes in main backend (commented out)
2. **DNS Rollback**: Point `mcp.shipbuilder.app` to main backend temporarily
3. **Code Rollback**: Revert frontend changes to use original proxy
4. **Database Rollback**: No database changes required

### **7.2 Feature Flags**
```typescript
// Feature flag for MCP service
const USE_SEPARATE_MCP_SERVICE = process.env.USE_SEPARATE_MCP_SERVICE === 'true';

if (USE_SEPARATE_MCP_SERVICE) {
  // New MCP service logic
} else {
  // Original embedded MCP logic
}
```

## **Phase 8: Success Metrics**

### **8.1 Technical Metrics**
- **Response Time**: MCP service response time < 200ms
- **Uptime**: 99.9% availability
- **Error Rate**: < 0.1% error rate
- **OAuth Success Rate**: > 99% successful OAuth flows

### **8.2 Operational Metrics**
- **Deployment Time**: < 5 minutes deployment time
- **Resource Usage**: < 512MB memory usage per service
- **Database Connections**: Optimal connection pool usage
- **SSL Certificate**: Valid SSL certificates for all domains

## **Phase 9: Documentation**

### **9.1 API Documentation**
```markdown
# MCP Service API

## Base URL
- Development: `http://localhost:3002`
- Production: `https://mcp.shipbuilder.app`

## Authentication
Uses JWT tokens from main Shipbuilder application.

## Endpoints

### GET /mcp
Returns MCP server information and capabilities.

### POST /mcp
Handles MCP protocol messages.

### GET /api/auth/authorize
Initiates OAuth authorization flow.

### POST /api/auth/consent
Handles user consent for OAuth.
```

### **9.2 Deployment Guide**
```markdown
# MCP Service Deployment

## Prerequisites
- Node.js 18+
- PostgreSQL database
- SSL certificates

## Environment Variables
[List all required environment variables]

## Deployment Steps
1. Build the service: `npm run build`
2. Set environment variables
3. Start the service: `npm start`
4. Verify health check: `curl https://mcp.shipbuilder.app/health`
```

## **Conclusion**

This implementation plan provides a comprehensive approach to separating the MCP functionality into a dedicated service. The migration strategy ensures minimal disruption while providing a cleaner architecture that's easier to maintain and scale.

**Key Benefits:**
- **Separation of Concerns**: MCP protocol isolated from main application
- **Better Scalability**: MCP service can be scaled independently
- **Simplified Development**: No proxy configuration needed
- **Production Ready**: Proper authentication and security measures

**Timeline Estimate:**
- **Phase 1-2**: 2-3 days (setup and migration)
- **Phase 3-4**: 1-2 days (frontend integration and dev setup)
- **Phase 5**: 2-3 days (testing and migration)
- **Phase 6-7**: 1-2 days (production deployment)
- **Total**: 1-2 weeks

The plan maintains backward compatibility during migration and provides clear rollback strategies if issues arise.