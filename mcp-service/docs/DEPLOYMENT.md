# MCP Service Deployment Guide

## Overview

This MCP service requires **Sentry SDK patches** to work correctly with `StreamableHTTPServerTransport`. This guide ensures the patches are applied in all deployment environments.

## Pre-Deployment Checklist

### ✅ Local Development
```bash
# Verify patches are applied
npm run patch-sentry

# Check patch status
grep -q "transport?.sessionId" node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js && echo "✅ SessionId patch applied" || echo "❌ SessionId patch missing"

grep -q "if (!transport)" node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js && echo "✅ Transport patch applied" || echo "❌ Transport patch missing"

grep -q "typeof transport !== 'object'" node_modules/@sentry/core/build/esm/integrations/mcp-server/correlation.js && echo "✅ WeakMap patch applied" || echo "❌ WeakMap patch missing"
```

### ✅ Environment Variables
Ensure these are set in production:

```bash
# Required
SENTRY_DSN=your_sentry_dsn_here
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=your_postgres_connection_string

# OAuth (choose your providers)
SENTRY_OAUTH_CLIENT_ID=your_sentry_oauth_client_id
SENTRY_OAUTH_CLIENT_SECRET=your_sentry_oauth_client_secret
SENTRY_OAUTH_REDIRECT_URI=https://your-domain.com/api/auth/sentry/callback

# Service communication
SERVICE_TOKEN=your_service_token_here
API_BASE_URL=https://your-main-app.com

# Optional - Redis for production session storage
REDIS_URL=your_redis_connection_string
```

## Deployment Strategies

### 1. Railway Deployment (Recommended)

Railway automatically runs `postinstall` scripts, so patches apply automatically:

```bash
# Deploy to Railway
railway up

# Verify deployment
railway logs --tail
```

**Railway Environment Variables**: Set all required environment variables in Railway dashboard.

### 2. Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY scripts/ ./scripts/

# Install dependencies and apply patches
RUN npm ci

# Verify patches were applied
RUN npm run patch-sentry

# Copy source code
COPY . .

# Build application
RUN npm run build

# Health check to verify MCP instrumentation
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3002}/health || exit 1

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t mcp-service .
docker run -p 3002:3002 --env-file .env mcp-service
```

### 3. Manual Server Deployment

```bash
# On target server
git clone <your-repo>
cd mcp-service

# Install dependencies (patches apply via postinstall)
npm ci

# Verify patches
npm run patch-sentry

# Build application
npm run build

# Start with PM2 for production
pm2 start dist/index.js --name mcp-service

# Monitor logs
pm2 logs mcp-service
```

### 4. Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-service
  template:
    metadata:
      labels:
        app: mcp-service
    spec:
      containers:
      - name: mcp-service
        image: your-registry/mcp-service:latest
        ports:
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: "production"
        - name: SENTRY_DSN
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: sentry-dsn
        # ... other environment variables
        livenessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 5
          periodSeconds: 5
```

## CI/CD Pipeline Integration

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy MCP Service

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Apply Sentry patches
      run: npm run patch-sentry
    
    - name: Verify patches applied
      run: |
        echo "Checking sessionId patch..."
        grep -q "transport?.sessionId" node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js
        
        echo "Checking transport patch..."
        grep -q "if (!transport)" node_modules/@sentry/core/build/esm/integrations/mcp-server/attributeExtraction.js
        
        echo "Checking WeakMap patch..."
        grep -q "typeof transport !== 'object'" node_modules/@sentry/core/build/esm/integrations/mcp-server/correlation.js
        
        echo "✅ All patches verified"
    
    - name: Build application
      run: npm run build
    
    - name: Deploy to Railway
      run: railway up
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## Health Checks and Monitoring

### Health Check Endpoint

The service includes a comprehensive health check at `/health`:

```bash
curl http://localhost:3002/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-02T06:35:50.000Z",
  "services": {
    "database": "connected",
    "sentry": "configured",
    "mcp": "operational"
  }
}
```

### Monitoring MCP Functionality

Add this to your monitoring setup:

```bash
# Test MCP authentication flow
curl -X POST http://localhost:3002/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&client_id=test&redirect_uri=http://localhost/callback&code=test&code_verifier=test"

# Test MCP tools endpoint (requires authentication)
curl -X POST http://localhost:3002/ \
  -H "Authorization: Bearer YOUR_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Troubleshooting

### Common Issues

#### 1. Patches Not Applied
**Symptoms**: MCP connection fails with SessionId/Constructor/WeakMap errors

**Solution**:
```bash
# Manually reapply patches
npm run patch-sentry

# Check patch status
ls -la node_modules/@sentry/core/build/*/integrations/mcp-server/
```

#### 2. Postinstall Script Fails
**Symptoms**: Patches don't apply during `npm ci`

**Solution**:
```bash
# Run patches manually after install
npm ci --ignore-scripts
npm run patch-sentry
```

#### 3. Environment Variable Issues
**Symptoms**: Authentication failures, database connection errors

**Solution**:
```bash
# Verify environment variables are set
node -e "console.log(Object.keys(process.env).filter(k => k.includes('SENTRY') || k.includes('JWT') || k.includes('DATABASE')))"
```

#### 4. MCP Client Connection Issues
**Symptoms**: "Authentication successful but server reconnection failed"

**Solution**:
```bash
# Check server logs for specific errors
tail -f logs/app.log | grep -E "(ERROR|sessionId|transport|WeakMap)"

# Test MCP server manually
curl -X POST http://localhost:3002/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

### Debug Commands

```bash
# Check if Sentry wrapper is working
node -e "
const Sentry = require('@sentry/node');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
try {
  const server = Sentry.wrapMcpServerWithSentry(new McpServer({name:'test',version:'1.0'}, {}));
  console.log('✅ Sentry wrapper working');
} catch (e) {
  console.log('❌ Sentry wrapper failed:', e.message);
}
"

# Verify patch files exist and contain expected content
find node_modules/@sentry/core/build -name "*.js" -path "*/mcp-server/*" -exec grep -l "PATCHED" {} \;
```

## Rollback Strategy

If patches cause issues:

1. **Quick rollback**: Remove Sentry wrapper temporarily
   ```typescript
   // In src/services/mcp-server.ts
   this.server = new McpServer(MCP_SERVER_INFO, {
     capabilities: MCP_DETAILED_CAPABILITIES,
   }); // Remove Sentry.wrapMcpServerWithSentry()
   ```

2. **Full rollback**: Revert to previous working version
   ```bash
   git revert <commit-hash>
   npm ci
   npm run build
   ```

## Support

If you encounter issues:

1. Check the server logs for specific error messages
2. Verify all patches are applied using the verification commands
3. Ensure all environment variables are correctly set
4. Test the health check endpoint
5. Review the `UPSTREAM_FIX.md` for detailed technical information

## Production Deployment Checklist

- [ ] Environment variables configured
- [ ] Sentry patches applied and verified
- [ ] Database connection tested
- [ ] Health check endpoint responding
- [ ] MCP authentication flow working
- [ ] Monitoring and alerting configured
- [ ] Rollback plan tested
- [ ] Documentation updated