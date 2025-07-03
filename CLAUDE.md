# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack project management application built with React + TypeScript + Vite frontend and Express backend. It features AI-powered task creation through natural language using Anthropic's Claude and the Vercel AI SDK.

## Common Commands

- `npm run dev` - Start both frontend and backend servers concurrently
- `npm run dev:client` - Start frontend development server only (port 5173, waits for backend health check)
- `npm run dev:server` - Start backend server only (port 3001)
- `npm run dev:safe` - Safe development mode with enhanced error handling
- `npm run build` - Build frontend for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally
- `./test-api.sh` - Run comprehensive API tests (requires server to be running)
- `npx drizzle-kit push` - Apply database schema changes

## Architecture

### Frontend (React + TypeScript + Vite)
- **Framework**: React 19 with TypeScript and Vite for HMR
- **State Management**: Multiple React Contexts for application state
  - `src/context/ProjectContext.tsx` - Projects and tasks state management
  - `src/context/AuthContext.tsx` - User authentication and session management
  - `src/context/ThemeContext.tsx` - Theme selection and dark/light mode
- **UI Components**: 
  - `src/components/project-view.tsx` - Project management with table view and status controls
  - `src/components/task-view.tsx` - Task management with Kanban board integration
  - `src/components/all-tasks-view.tsx` - Cross-project task overview and filtering
  - `src/components/ChatInterface.tsx` - AI chat integration with tool calling
  - `src/components/MVPBuilder.tsx` - AI-powered MVP project generator (draggable modal)
  - `src/components/app-sidebar.tsx` - Navigation sidebar with project and view switching
  - `src/components/LoginScreen.tsx` - Authentication interface with OAuth providers
  - `src/components/UserProfile.tsx` - User profile management and settings
  - `src/components/settings-view.tsx` - Theme selection and application settings
  - `src/components/command-menu.tsx` - Command palette (Cmd+K) for quick navigation
  - `src/components/ConnectionStatus.tsx` - Real-time connection status indicator
  - `src/components/TaskHoverCard.tsx` - Task detail preview on hover
  - `src/components/ProjectHoverCard.tsx` - Project detail preview on hover
- **Types**: Centralized type definitions in `src/types/index.ts`
- **Styling**: Tailwind CSS v4 with utility-first approach and responsive design

### Backend (Express + TypeScript)
- **Server**: Express server (`server/index.ts`) with CORS, JSON middleware, and comprehensive security
- **Database**: PostgreSQL with Drizzle ORM for production-ready persistence
  - `server/db/schema.ts` - Database schema definitions (users, projects, tasks, comments)
  - `server/db/database-service.ts` - Database service layer with typed operations
  - `server/db/connection.ts` - Database connection with connection pooling
- **Authentication**: Full OAuth system with JWT tokens
  - `server/routes/auth.ts` - OAuth authentication routes (GitHub, Google, Sentry)
  - `server/services/sentry-oauth.ts` - Sentry OAuth integration service
  - `server/middleware/auth.ts` - JWT authentication middleware
- **API Routes**: 
  - `server/routes/projects.ts` - CRUD operations for projects/tasks (no subtasks implemented)
  - `server/routes/chat.ts` - AI chat integration with tool calling
  - `server/routes/ai.ts` - AI-powered features (MVP generation, task details)
  - `server/routes/auth.ts` - User authentication and OAuth endpoints
- **Middleware**: 
  - `server/middleware/rate-limit.ts` - API rate limiting protection
  - `server/middleware/logging.ts` - Structured request/response logging
  - `server/middleware/auth.ts` - JWT token validation
- **AI Tools**: `server/tools/task-tools.ts` - Tools for creating/managing projects via AI
- **Database Migrations**: Handled via `npx drizzle-kit push` with schema-driven migrations in `/drizzle/`

### AI Integration
- **Provider**: Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) via Vercel AI SDK
- **Chat Interface**: Streaming tool calls with real-time UI updates
- **MVP Builder**: Two-step AI-powered project generation

#### Chat Tools Available:
- `createProject` - Create new projects (generates slug-based IDs)
- `createTask` - Add tasks to projects (generates slug-based IDs)
- `updateTaskStatus` - Change task status (backlog/in_progress/completed)
- `listProjects` - Get all projects
- `getProject` - Get specific project details
- `suggestProjectName` - Generate AI-powered project name suggestions

**Note**: Subtasks are not implemented in the current version despite being defined in TypeScript types.

#### MVP Builder Tools:
- `generateMVPPlan` - Generate comprehensive MVP plans without creating projects
- **Enhanced Workflow**: Generate plan → edit project name → create project with tasks

#### AI Endpoints:
- `/api/chat/stream` - Streaming chat with tool calling for interactive project management
- `/api/ai/generatemvp` - Generate MVP plan from project idea (streaming response)
- `/api/ai/create-mvp-project` - Create complete MVP project from generated plan
- `/api/ai/generate-details` - Generate detailed task descriptions

### API Documentation
- **Interactive Swagger UI**: Available at `http://localhost:3001/api-docs` when server is running
- **Markdown Documentation**: Comprehensive API docs in `API_DOCUMENTATION.md`
- **Testing Script**: Use `./test-api.sh` to test all endpoints
- **Base URL**: `http://localhost:3001/api`

## Data Models

### Database Schema (PostgreSQL + Drizzle ORM)
- **User**: Authentication and profile information
  - `id` (UUID), `email`, `name`, `provider`, `providerId`, `avatar`, timestamps
- **Project**: Has name, description, status, tasks array, timestamps
  - `id` (VARCHAR(20) slug), `userId` (UUID FK), `name`, `description`, `status`, timestamps
  - **ID Format**: `photoshare`, `awesome-app` (max 20 chars, alphanumeric + hyphens)
- **Task**: Belongs to project, has title, description, status, priority, due date, timestamps
  - `id` (VARCHAR(20) slug), `projectId` (VARCHAR(20) FK), `title`, `description`, `details`, `status`, `priority`, `dueDate`, timestamps
  - **ID Format**: `photoshare-1`, `awesome-app-12` (max 20 chars, project-slug + sequential number)
- **Comment**: Task comments and discussions
  - `id` (UUID), `taskId` (FK), `content`, `author`, timestamps
- **API Key**: User API keys for programmatic access
  - `id` (UUID), `userId` (FK), `name`, `keyHash`, `prefix`, `createdAt`, `expiresAt`, `lastUsedAt`, `isActive`

### Enums
- **TaskStatus**: `backlog`, `in_progress`, `completed`
- **ProjectStatus**: `active`, `backlog`, `completed`, `archived`
- **Priority**: `low`, `medium`, `high`

### Slug-based ID System
The application uses human-readable slug-based identifiers for projects and tasks:

#### ID Generation
- **Projects**: Generated from project name using `generateUniqueProjectSlug()`
  - Converts to lowercase, replaces spaces with hyphens
  - Removes special characters, handles collisions with numeric suffixes
  - **Maximum length: 20 characters**
  - Examples: `photoshare`, `task-mgr-2`, `awesome-app`
- **Tasks**: Sequential numbering within each project using `generateUniqueTaskSlug()`
  - Format: `{project-slug}-{number}`
  - **Maximum length: 20 characters** (including project ID and number)
  - Examples: `photoshare-1`, `photoshare-2`, `task-mgr-2-1`

#### Utilities (`server/utils/slug-utils.ts`)
- `generateSlug()` - Convert string to URL-safe slug
- `generateUniqueProjectSlug()` - Generate unique project slug with collision handling
- `generateUniqueTaskSlug()` - Generate sequential task slug
- `validateProjectSlug()` / `validateTaskSlug()` - Format validation
- `getProjectIdFromTaskSlug()` - Extract project ID from task slug

#### Benefits
- **Human-readable**: Easy to reference in APIs, logs, and debugging
- **URL-friendly**: Can be used directly in REST endpoints
- **Collision-safe**: Automatic handling of duplicate names
- **Backwards compatible**: Existing UUIDs still work during transition

### TypeScript Types
- Centralized in `src/types/types.ts` with full type safety
- Added slug format documentation and validation types (`ProjectSlug`, `TaskSlug`)
- **Note**: Subtask types exist in TypeScript but are not implemented in the database or UI

## Environment Setup

### Required Environment Variables

#### Backend (Server) Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `ANTHROPIC_API_KEY` - Required for AI functionality
- `JWT_SECRET` - JWT signing secret for authentication
- `JWT_EXPIRES_IN` - JWT token expiration time (default: "7d")
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default: 3001)
- `FRONTEND_BASE_URL` - Frontend URL for CORS (default: http://localhost:5173)

#### OAuth Configuration (Sentry)
- `SENTRY_DSN` - Sentry project DSN for error tracking
- `SENTRY_OAUTH_CLIENT_ID` - OAuth client ID for Sentry authentication
- `SENTRY_OAUTH_CLIENT_SECRET` - OAuth client secret for Sentry authentication
- `SENTRY_OAUTH_REDIRECT_URI` - OAuth callback URL for Sentry (e.g., `http://localhost:3001/api/auth/sentry/callback`)
- `SENTRY_BASE_URL` - Sentry instance URL (default: https://sentry.io)

#### OAuth Configuration (Google)
- `GOOGLE_OAUTH_CLIENT_ID` - OAuth client ID for Google authentication
- `GOOGLE_OAUTH_CLIENT_SECRET` - OAuth client secret for Google authentication  
- `GOOGLE_OAUTH_REDIRECT_URI` - OAuth callback URL for Google (e.g., `http://localhost:3001/api/auth/google/callback`)

#### Frontend (Client) Variables
- `VITE_API_BASE_URL` - API base URL (default: `http://localhost:3001`)
- `VITE_SENTRY_DSN` - Client-side Sentry DSN for error tracking

### Setup Instructions
1. Copy `.env.example` to `.env` and configure required variables
2. Set up PostgreSQL database and configure `DATABASE_URL`
3. Obtain Anthropic API key for AI functionality
4. **Configure OAuth Providers:**
   - **Sentry OAuth**: Configure Sentry OAuth credentials and redirect URI
   - **Google OAuth**: Set up Google Cloud Console project, enable Google+ API, and configure OAuth credentials
5. Run `npx drizzle-kit push` to initialize database schema
6. Frontend serves on port 5173, backend on port 3001

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API (or Google People API)
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set authorized redirect URIs to include your callback URL (e.g., `http://localhost:3001/api/auth/google/callback`)
6. Copy the Client ID and Client Secret to your `.env` file

## Authentication System

### OAuth Integration
The application uses a comprehensive OAuth authentication system with JWT tokens for session management.

#### Supported Providers
- **Sentry OAuth** - Primary authentication provider with organization-based access
- **Google OAuth** - Fully implemented Google OAuth 2.0 integration with email verification
- **GitHub OAuth** - Alternative provider (configured but may need setup)
- **Developer Mode** - Email-based development authentication for testing

#### Authentication Flow
1. **Login**: User clicks "Login with Sentry" on LoginScreen
2. **OAuth Redirect**: Browser redirects to Sentry OAuth authorization
3. **Callback**: OAuth provider redirects back with authorization code
4. **Token Exchange**: Server exchanges code for user information
5. **JWT Creation**: Server creates JWT token with user data
6. **Client Storage**: JWT stored in localStorage for session persistence
7. **API Authorization**: JWT included in Authorization header for protected routes

#### API Endpoints
- `GET /api/auth/sentry` - Initiate Sentry OAuth flow
- `GET /api/auth/sentry/callback` - Handle Sentry OAuth callback and create session
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Handle Google OAuth callback and create session
- `POST /api/auth/developer` - Developer mode login for testing
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/logout` - Clear user session

#### Security Features
- **JWT Tokens**: Secure session management with configurable expiration
- **Rate Limiting**: API endpoints protected with rate limiting middleware
- **CORS Protection**: Configured CORS headers for secure cross-origin requests
- **Input Validation**: Comprehensive validation for all authentication data
- **Error Tracking**: Sentry integration for monitoring authentication issues

#### User Management
- **Automatic User Creation**: New users automatically created on first OAuth login
- **Profile Management**: User profile data synchronized from OAuth provider
- **Session Persistence**: Login state maintained across browser sessions
- **Secure Logout**: Complete session cleanup on logout

## API Key System

The application includes a comprehensive API key system for programmatic access to user accounts via direct API calls.

### Overview
API keys provide secure, token-based authentication for direct API access outside of the web application. Each key is scoped to a specific user account and cannot access other users' data.

### Key Features
- **Secure Generation**: Cryptographically secure random keys with PBKDF2 hashing
- **User-Scoped Access**: Keys can only access the creating user's projects and tasks
- **Optional Expiration**: Keys can be set to expire after 1-365 days
- **Usage Tracking**: Last used timestamps for monitoring and audit purposes
- **Rate Limiting**: 10 API key operations per 15 minutes per IP address
- **Comprehensive Logging**: All API key operations logged for security auditing

### API Key Format
- **Prefix**: `sb_` (shipbuilder)
- **Length**: 64 hexadecimal characters
- **Example**: `sb_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

### User Interface
API key management is integrated into the User Profile component:
- **Tabbed Interface**: Profile tab + API Keys tab
- **Key Creation Form**: Name and optional expiration
- **Secure Display**: One-time key reveal with show/hide toggle
- **Key Management**: List, view details, and delete existing keys
- **Copy Functionality**: Easy clipboard copy for integration

### API Endpoints
- `POST /api/api-keys/create` - Create new API key (requires JWT auth)
- `GET /api/api-keys/list` - List user's API keys (requires JWT auth)
- `DELETE /api/api-keys/{keyId}` - Delete API key (requires JWT auth)
- `GET /api/api-keys/{keyId}` - Get key details (requires JWT auth)

### Database Schema
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  prefix TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NULL,
  last_used_at TIMESTAMP NULL,
  is_active TEXT DEFAULT 'true'
);
```

### Security Implementation
- **Hashed Storage**: Keys stored as PBKDF2 hashes, never plaintext
- **Timing-Safe Comparison**: Prevents timing attacks during verification
- **Comprehensive Audit Logging**: All creation, usage, and deletion events logged
- **Automatic Expiration**: Expired keys automatically rejected
- **Soft Deletion**: Keys marked inactive rather than hard deleted for audit trail

### Authentication Flow
1. **Key Detection**: Middleware checks if Bearer token matches API key format
2. **Hash Verification**: Computes hash and compares with stored hash
3. **Validation**: Checks expiration, active status, and user existence
4. **Usage Tracking**: Updates last_used_at timestamp
5. **User Context**: Attaches user information to request for authorization

### Integration with Existing Auth
- **Dual Authentication**: Supports both JWT tokens (web app) and API keys (direct API)
- **Unified Middleware**: Single authentication middleware handles both methods
- **Consistent Authorization**: Same user-scoped data access patterns
- **Seamless Switching**: Web app and API access use same underlying permissions

## MVP Builder Feature

The MVP Builder is a sophisticated AI-powered feature that helps users generate complete project plans from natural language descriptions.

### Two-Step Process

1. **Plan Generation** (`/api/ai/generatemvp`):
   - User enters project idea (minimum 10 characters, maximum 500)
   - AI generates comprehensive MVP plan using `generateText()` (not streaming)
   - Returns JSON with project name, description, tech stack, features, and tasks
   - User reviews complete plan before committing

2. **Project Creation** (`/api/ai/create-mvp-project`):
   - User approves plan and clicks "Create Project"
   - Uses streaming tool calls with `createProject` and `createTask` tools
   - Real-time status updates show project and task creation progress
   - Shows confirmation with task count and refreshes project list automatically

### MVP Plan Structure

```typescript
interface MVPPlan {
  projectName: string;
  description: string;
  features: string[];
  techStack: {
    frontend: string;
    backend: string;
    database: string;
    hosting?: string;
  };
  tasks: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}
```

### UI Components

- **MVPBuilder** (`src/components/MVPBuilder.tsx`): Draggable modal with two-step flow
- **Input Form**: Project idea textarea with validation and example ideas
- **Plan Preview**: Organized display of project details, tech stack, features, and tasks
- **Action Buttons**: "Create Project" and "Start Over" for user control

### Key Design Decisions

- **Two-step architecture**: Plan generation uses simple JSON for reliability, project creation uses streaming tool calls for real-time feedback
- **Preview before creation**: User sees complete plan and decides whether to proceed
- **Modular tool usage**: Project creation reuses the same `createProject` and `createTask` tools as the chat interface
- **Real-time feedback**: Streaming tool calls provide live status updates during project and task creation
- **Error handling**: Comprehensive validation and user-friendly error messages
- **Consistent architecture**: Uses the same tool calling patterns as the chat interface (`maxSteps: 25` for multiple sequential tool calls)

## Development Notes

### Core Architecture
- Uses ES modules throughout (`"type": "module"`)
- Concurrent development with `concurrently` package for frontend/backend
- TypeScript strict mode enabled with comprehensive type safety
- Database migrations handled via `npx drizzle-kit push` for schema changes

### Advanced Features
- **Theme System**: Multiple theme options with dark/light mode support
- **Drag & Drop**: Advanced Kanban board with @dnd-kit for task management
- **Command Palette**: Cmd+K command menu for quick navigation and actions
- **Real-time Updates**: Live UI updates when AI tools modify data
- **Hover Cards**: Rich preview cards for tasks and projects
- **Responsive Design**: Mobile-first responsive layout with Tailwind CSS

### Security & Performance
- **Rate Limiting**: API protection with configurable rate limits
- **Structured Logging**: Comprehensive request/response logging with metadata
- **Error Tracking**: Sentry integration for production error monitoring
- **Connection Pooling**: PostgreSQL connection pooling for performance
- **Input Validation**: Comprehensive validation for all API endpoints

### Development Tools
- **API Testing**: Comprehensive test suite with `./test-api.sh`
- **Swagger Documentation**: Interactive API docs at `/api-docs`
- **Hot Module Replacement**: Vite HMR for fast development iteration
- **Debug Scripts**: Various debugging utilities in project root

### Code Organization
- **Modular Components**: Reusable UI components with consistent patterns
- **Type Safety**: Centralized types with runtime validation
- **Context-based State**: Multiple React contexts for different concerns
- **Service Layer**: Clean separation between database operations and API routes
- **Middleware Architecture**: Composable Express middleware for cross-cutting concerns