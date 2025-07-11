# Changelog

All notable changes to the ShipBuilder project will be documented in this file.

## [Unreleased]

### Added
- **AI Provider Switching**: Users can now choose between Anthropic Claude and OpenAI models
  - Added support for OpenAI GPT-4o, GPT-4o Mini, and GPT-4 Turbo models
  - New AI provider selection in Settings screen
  - Dynamic provider switching affects all AI features (chat, MVP builder, task generation)
  - Automatic detection of available providers based on configured API keys
  - Database schema updated to store user's AI provider preference
- **Human-Readable ID System**: Complete slug-based identifier implementation
  - Project IDs: `photoshare`, `awesome-app` (max 20 chars, alphanumeric + hyphens)
  - Task IDs: `photoshare-1`, `awesome-app-12` (max 20 chars, project-slug + number)
  - Automatic collision handling with intelligent truncation
  - Format validation in API routes and database
  - Copyable ID components in all frontend views
- **Enhanced MVP Builder Experience**:
  - AI-powered project name suggestions with `suggestProjectName` tool
  - Interactive name editing step before project creation
  - Real-time validation and user feedback
  - Seamless integration with slug generation system
- **API Key Authentication System**: Complete programmatic access solution
  - User Profile API Keys management interface with tabbed design
  - Secure key generation with PBKDF2 hashing and `sb_` prefix format
  - Optional expiration dates (1-365 days) with usage tracking
  - Comprehensive security logging and audit trails
  - Rate limiting (10 operations per 15 minutes) for security
  - Full CRUD API endpoints (`/api/api-keys/*`)

### Changed
- **Complete Database Architecture Overhaul**:
  - Projects and tasks now use varchar(20) slug IDs for efficiency
  - Added `api_keys` table with comprehensive security features
  - Optimized foreign key relationships for slug-based references
- **Frontend User Experience Enhancements**:
  - All table views now display copyable IDs with click-to-copy functionality
  - Enhanced MVP Builder workflow with name customization
  - Updated User Profile with tabbed interface for API key management
- **Backend Infrastructure Improvements**:
  - Dual authentication system supporting both JWT and API keys
  - Enhanced slug generation with collision detection and length limits
  - Updated AI tools to work seamlessly with new ID structure
  - Comprehensive API documentation with realistic examples

### Removed
- Unused `/api/ai/generate-mvp` route (redundant with streaming version)

### Technical Impact
This release represents a major enhancement to developer experience and API usability:

**Developer Benefits:**
- **Human-readable APIs**: Replace complex UUIDs with intuitive slugs (`photoshare-1` vs `a1b2c3d4-e5f6-7890`)
- **Better debugging**: Meaningful identifiers in logs, errors, and API calls
- **Improved documentation**: Self-documenting API endpoints with readable examples
- **Enhanced productivity**: Quick ID copying from UI, easier API integration

**System Improvements:**
- **Database efficiency**: Smaller varchar(20) indexes vs UUID storage
- **Consistent length**: Predictable 20-character maximum for all IDs
- **Collision safety**: Intelligent truncation and numbering prevents conflicts
- **Backward compatibility**: Existing systems continue to work during transition

**User Experience:**
- **Intuitive project references**: Easy to communicate project IDs in team discussions
- **One-click copying**: Instant access to IDs from any table view
- **AI-enhanced creation**: Smart name suggestions for better slug generation
- **Visual clarity**: Clean, monospace ID display for immediate recognition

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