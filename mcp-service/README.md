# Shipbuilder MCP Service

A standalone Model Context Protocol (MCP) server that provides AI assistants with secure access to Shipbuilder project management data.

## Overview

This service exposes Shipbuilder's project and task data through the standardized MCP protocol, allowing AI assistants and MCP clients to query and interact with your project management data while maintaining full security and user privacy.

## Features

- **MCP Protocol 2025-03-26**: Full compliance with latest MCP specification
- **OAuth 2.1 Authentication**: Secure user consent flow with PKCE
- **API-Based Architecture**: Communicates with main Shipbuilder API (no direct database access)
- **Root-Level Protocol**: Clean URLs without `/mcp` prefix
- **Production Ready**: Comprehensive logging, error handling, and monitoring

## Quick Start

### 1. Environment Setup

Copy the environment template:
```bash
cp .env.example .env
```

Configure your environment variables (see [Environment Variables](#environment-variables) below).

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

The MCP service will be available at `http://localhost:3002`

### 4. Production Build

```bash
npm run build
npm start
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (must match main app) | `your-super-secret-jwt-key` |
| `API_BASE_URL` | Main Shipbuilder API endpoint | `http://localhost:3001` |
| `SERVICE_TOKEN` | Service-to-service authentication token (must match main app) | `your-service-token-here` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | `production` |
| `PORT` | Service port | `3002` | `3002` |
| `FRONTEND_BASE_URL` | Frontend URL for OAuth redirects | `http://localhost:5173` | `https://app.shipbuilder.com` |
| `SENTRY_DSN` | Sentry error tracking DSN | _(none)_ | `https://...@sentry.io/...` |
| `LOG_LEVEL` | Logging level | `info` | `debug`, `warn`, `error` |

### Complete .env Example

```bash
# Required
JWT_SECRET=your-super-secret-jwt-key-that-matches-main-app
API_BASE_URL=http://localhost:3001
SERVICE_TOKEN=your-service-token-here

# Optional
NODE_ENV=development
PORT=3002
FRONTEND_BASE_URL=http://localhost:5173
SENTRY_DSN=https://your-dsn@sentry.io/project-id
LOG_LEVEL=info
```

## Architecture

### Service Flow
```
MCP Client → MCP Service (port 3002) → Main API (port 3001) → Database
```

### Key Components

- **MCP Server**: Handles protocol compliance and tool registration
- **OAuth Service**: Manages user authentication and consent
- **API Service**: Communicates with main Shipbuilder API
- **Auth Service**: JWT token generation and validation

## API Endpoints

### MCP Protocol
- `GET/POST /` - MCP protocol endpoint (root level)
- `POST /token` - OAuth token exchange

### Authentication
- `GET /api/auth/authorize` - OAuth authorization endpoint
- `POST /api/auth/consent` - User consent handling

### Discovery
- `GET /.well-known/oauth-authorization-server` - OAuth discovery metadata
- `GET /.well-known/oauth-protected-resource` - Resource server info
- `POST /register` - Dynamic client registration

### Utility
- `GET /health` - Health check endpoint

## MCP Tools Available

### `query_projects`
Get all projects for the authenticated user.

**Parameters:**
- `status` (optional): Filter by status (`active`, `backlog`, `completed`, `archived`)
- `include_tasks` (optional): Include tasks in response (default: `true`)

**Example:**
```json
{
  "name": "query_projects",
  "arguments": {
    "status": "active",
    "include_tasks": true
  }
}
```

### `query_tasks`
Get tasks for a specific project.

**Parameters:**
- `project_id` (required): Project slug (e.g., `"photoshare"`)
- `status` (optional): Filter by status (`backlog`, `in_progress`, `completed`)
- `priority` (optional): Filter by priority (`low`, `medium`, `high`)

**Example:**
```json
{
  "name": "query_tasks",
  "arguments": {
    "project_id": "photoshare",
    "status": "in_progress",
    "priority": "high"
  }
}
```

## Client Configuration

### For MCP Clients (like Cursor)

```json
{
  "name": "shipbuilder",
  "serverUrl": "http://localhost:3002",
  "authType": "oauth2",
  "protocol": "mcp",
  "version": "2025-03-26"
}
```

### For Production

```json
{
  "name": "shipbuilder",
  "serverUrl": "https://mcp.shipbuilder.app",
  "authType": "oauth2",
  "protocol": "mcp",
  "version": "2025-03-26"
}
```

## Authentication Flow

1. **Client Registration**: MCP client registers with the service
2. **OAuth Authorization**: User is redirected to consent screen
3. **User Consent**: User approves/denies access to their data
4. **Token Exchange**: Client exchanges authorization code for access token
5. **API Access**: Client uses token to make MCP protocol requests

## Development

### Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build TypeScript to JavaScript
npm start        # Start production server
npm run lint     # Run ESLint
npm test         # Run tests
```

### Development Requirements

- Node.js 18+ 
- npm 9+
- Running Shipbuilder main application on port 3001
- Valid JWT_SECRET that matches the main application

### Testing the Service

1. **Health Check**:
   ```bash
   curl http://localhost:3002/health
   ```

2. **MCP Server Info**:
   ```bash
   curl http://localhost:3002
   ```

3. **OAuth Discovery**:
   ```bash
   curl http://localhost:3002/.well-known/oauth-authorization-server
   ```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production API URL in `API_BASE_URL`
3. Set production frontend URL in `FRONTEND_BASE_URL`
4. Configure Sentry DSN for error tracking
5. Ensure JWT_SECRET matches main application

### Security Considerations

- Always use HTTPS in production
- Keep JWT_SECRET synchronized with main application
- Configure CORS properly for your domain
- Enable Sentry for error monitoring
- Use environment variables for all secrets

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3002
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **"JWT_SECRET is required" Error**
   - Ensure `JWT_SECRET` is set in `.env`
   - Verify it matches the main application's JWT secret

2. **"Failed to retrieve projects" Error**
   - Check `API_BASE_URL` points to running main application
   - Verify main application is accessible from MCP service
   - Check network connectivity between services

3. **OAuth Authorization Failures**
   - Verify `FRONTEND_BASE_URL` is correctly configured
   - Check that main application is running and accessible
   - Ensure JWT tokens are being generated correctly

4. **MCP Client Connection Issues**
   - Verify service is running on correct port
   - Check that client is connecting to root URL (not `/mcp`)
   - Ensure OAuth flow completes successfully

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Monitoring

The service provides comprehensive health information:
```bash
curl http://localhost:3002/health
```

Response includes:
- Service status
- Environment
- Version information
- Timestamp

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting: `npm run lint`
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the main Shipbuilder repository
- Check logs with `LOG_LEVEL=debug`
- Verify environment configuration
- Test main API connectivity