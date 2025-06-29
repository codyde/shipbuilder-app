# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Slug-based ID System**: Human-readable project and task identifiers
  - Projects: `photoshare`, `my-awesome-app` (alphanumeric + hyphens)
  - Tasks: `photoshare-1`, `photoshare-2` (project-slug + sequential number)
  - Automatic collision handling with numbered suffixes
  - Format validation in API routes
- **AI Project Name Suggestions**: New `suggestProjectName` tool for MVP Builder
- **Enhanced MVP Builder**: Project name editing step with AI-powered suggestions
- API Key Authentication System for programmatic access
- User Profile API Keys management interface
- Comprehensive security logging and audit trails
- Rate limiting for API key operations
- Support for optional API key expiration (1-365 days)
- Usage tracking with last used timestamps
- Secure key generation with PBKDF2 hashing
- API key management endpoints (`/api/api-keys/*`)

### Changed
- **Database Schema**: Updated projects and tasks tables to use varchar(20) slug IDs
- **Database Service**: Implemented slug generation with collision detection and 20-char limits
- **Slug Generation**: Capped project and task IDs at 20 characters maximum
- **TypeScript Types**: Added slug format documentation and validation types
- **AI Tools**: Updated to work with slug-based IDs and enhanced messaging
- **MVP Builder Workflow**: Added name selection/editing step before project creation
- Enhanced authentication middleware to support both JWT and API keys
- Updated User Profile component with tabbed interface
- Updated API documentation with authentication examples
- Enhanced database schema with `api_keys` table

### Removed
- Unused `/api/ai/generate-mvp` route (redundant with streaming version)

### Security
- Implemented cryptographically secure API key generation
- Added comprehensive audit logging for all authentication events
- Keys are stored as hashes, never in plaintext
- Timing-safe comparison to prevent timing attacks
- User-scoped access control - keys cannot access other users' data

## API Key System Details

### Features
- **Dual Authentication**: Web app uses JWT tokens, direct API access uses API keys
- **Secure Generation**: `sb_` prefix + 64 hex characters, PBKDF2 hashed storage
- **User Scoped**: Each key can only access the creating user's projects and tasks
- **Expiration Support**: Optional expiration dates (1-365 days)
- **Usage Tracking**: Last used timestamps for monitoring
- **Rate Limiting**: 10 operations per 15 minutes per IP for key management
- **Audit Logging**: Comprehensive security event tracking

### User Interface
- **Profile Integration**: API Keys tab in User Profile dialog
- **Key Creation**: Form with name and optional expiration
- **Secure Display**: One-time key reveal with show/hide toggle
- **Key Management**: List, view details, and delete functionality
- **Copy Support**: Easy clipboard copy for integration

### API Endpoints
```
POST /api/api-keys/create     - Create new API key
GET  /api/api-keys/list       - List user's API keys  
GET  /api/api-keys/:keyId     - Get key details
DELETE /api/api-keys/:keyId   - Delete API key
```

### Database Schema
```sql
api_keys table:
- id (UUID, primary key)
- user_id (UUID, foreign key to users.id)
- name (text, descriptive name)
- key_hash (text, PBKDF2 hash of key)
- prefix (text, key prefix for identification)
- created_at (timestamp)
- expires_at (timestamp, optional)
- last_used_at (timestamp, tracks usage)
- is_active (text, soft deletion flag)
```

### Usage Examples
```bash
# Create API key (requires web app authentication)
curl -X POST \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "Production Server", "expiresInDays": 90}' \
     http://localhost:3001/api/api-keys/create

# Use API key for direct API access
curl -H "Authorization: Bearer sb_your_api_key_here" \
     http://localhost:3001/api/projects
```

---

## Previous Releases

### [v1.0.0] - 2024-12-XX
- Initial release with project management functionality
- React + TypeScript frontend with Vite
- Express + PostgreSQL backend with Drizzle ORM
- AI-powered task creation with Anthropic Claude
- OAuth authentication system
- Real-time chat interface with tool calling
- MVP Builder for AI-powered project generation
- Kanban board task management
- Comprehensive API documentation
- Swagger/OpenAPI integration