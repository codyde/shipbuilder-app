# OAuth Authentication Flow Documentation

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [New User Authentication Flow](#new-user-authentication-flow)
3. [Returning User Authentication Flow](#returning-user-authentication-flow)
4. [Database Schema & Relationships](#database-schema--relationships)
5. [System Dependencies](#system-dependencies)
6. [Error Handling Flows](#error-handling-flows)
7. [Security Mechanisms](#security-mechanisms)
8. [API Endpoints](#api-endpoints)

## System Architecture Overview

The authentication system implements a dual-provider architecture with Sentry OAuth as the primary provider and a fake/demo provider for development.

```mermaid
flowchart TB
    subgraph "Authentication Architecture"
        subgraph "Frontend Layer"
            React["Frontend (React)<br/>- AuthContext<br/>- LoginScreen<br/>- UserProfile"]
        end
        
        subgraph "Backend Layer"
            Express["Express Backend<br/>- Auth Routes<br/>- Middleware<br/>- OAuth Service"]
        end
        
        subgraph "Database Layer"
            PostgreSQL["PostgreSQL Database<br/>- Users Table<br/>- Sessions<br/>- Constraints"]
        end
        
        subgraph "OAuth Provider"
            Sentry["Sentry OAuth 2.0<br/><br/>Authorization: https://sentry.io/oauth/authorize/<br/>Token Exchange: https://sentry.io/oauth/token/<br/>User Info: https://sentry.io/api/0/user/<br/>Fallback: https://sentry.io/api/0/users/me/"]
        end
    end
    
    React <--> Express
    Express <--> PostgreSQL
    Express <--> Sentry
```

## New User Authentication Flow

### Step-by-Step Process for First-Time Users

```mermaid
sequenceDiagram
    participant U as User
    participant LS as LoginScreen Component
    participant AC as AuthContext
    participant ES as Express Server
    participant SO as Sentry OAuth Service
    participant SA as Sentry API
    participant DB as PostgreSQL Database
    participant MA as Main App Interface
    
    Note over U,MA: New User OAuth Flow
    
    U->>LS: [1] Click "Login with Sentry"
    LS->>AC: [2] onClick() trigger
    AC->>ES: [3] GET /api/auth/sentry
    ES->>SO: [4] generateAuthUrl()
    SO-->>ES: [5] OAuth URL generated
    ES-->>AC: [6] 302 Redirect to Sentry
    
    Note over AC,SA: Browser redirects to Sentry OAuth
    AC->>SA: [7] https://sentry.io/oauth/authorize/?client_id=...&redirect_uri=...&state=...
    
    U->>SA: [8] Enter credentials & grant permissions
    SA-->>ES: [9] 302 Redirect with authorization code
    
    Note over ES,SA: Server-side token exchange
    ES->>SO: [10] exchangeCode()
    SO->>SA: [11] POST https://sentry.io/oauth/token/
    SA-->>SO: [12] Returns access_token
    SO-->>ES: [13] Token received
    
    ES->>SO: [14] getUserInfo()
    SO->>SA: [15] GET /api/0/user/ (Bearer token)
    SA-->>SO: [16] Returns user profile data
    SO-->>ES: [17] User data received
    
    ES->>DB: [18] INSERT INTO users (email, name, provider, provider_id, avatar)
    DB-->>ES: [19] Returns new user record
    
    ES-->>AC: [20] 302 Redirect to /oauth-callback?userId=...&email=...&name=...
    AC->>AC: [21] Extract user data from URL
    AC->>AC: [22] Store user ID in localStorage
    AC->>AC: [23] Update authentication state
    AC->>MA: [24] Redirect to authenticated app
    
    Note over U,MA: User now authenticated with access to protected resources
```

### Database Operations for New Users

```sql
-- Step 9: New user creation
INSERT INTO users (
    id,                 -- Generated UUID
    email,              -- From Sentry profile
    name,               -- From Sentry profile  
    provider,           -- 'sentry'
    provider_id,        -- Sentry user ID
    avatar,             -- Sentry avatar URL
    created_at,         -- Current timestamp
    updated_at          -- Current timestamp
) VALUES (
    gen_random_uuid(),
    'user@example.com',
    'John Doe',
    'sentry',
    'sentry_user_123',
    'https://secure.gravatar.com/avatar/...',
    NOW(),
    NOW()
);
```

## Returning User Authentication Flow

### Step-by-Step Process for Existing Users

```mermaid
sequenceDiagram
    participant U as User
    participant LS as LoginScreen Component
    participant AC as AuthContext
    participant ES as Express Server
    participant SO as Sentry OAuth Service
    participant SA as Sentry API
    participant DB as PostgreSQL Database
    participant MA as Main App Interface
    
    Note over U,MA: Returning User OAuth Flow
    
    U->>LS: [1] Click "Login with Sentry"
    LS->>AC: [2] onClick() trigger
    AC->>ES: [3] GET /api/auth/sentry
    
    Note over AC,SA: [4-7] OAuth flow identical to new user
    Note over AC,SA: (Authorization URL → Sentry Login → Callback → Token Exchange)
    
    ES->>SO: [8] getUserInfo() - fetch profile
    SO->>SA: GET /api/0/user/
    SA-->>SO: Returns user profile data
    SO-->>ES: User data received
    
    ES->>DB: [9] SELECT * FROM users WHERE provider='sentry' AND provider_id=?
    DB-->>ES: [10] Returns existing user record
    
    alt User profile changed
        ES->>DB: [11] UPDATE users SET name=?, avatar=?, updated_at=NOW() WHERE id=?
        DB-->>ES: User record updated
    end
    
    ES-->>AC: [12] 302 Redirect to /oauth-callback?userId=existing_uuid&email=...&name=...
    AC->>AC: [13] Extract user data from URL
    AC->>AC: [14] Store user ID in localStorage
    AC->>AC: [15] Update authentication state
    AC->>MA: [16] Redirect to authenticated app
    
    Note over U,MA: User sees existing projects, tasks, and personalized content
```

### Database Operations for Returning Users

```sql
-- Step 9: Check for existing user
SELECT id, email, name, provider, provider_id, avatar, created_at, updated_at
FROM users 
WHERE provider = 'sentry' 
AND provider_id = 'sentry_user_123';

-- Step 10: Update user data if profile changed
UPDATE users SET 
    name = 'Updated Name',
    avatar = 'https://new-avatar-url.com/avatar.jpg',
    updated_at = NOW()
WHERE provider = 'sentry' 
AND provider_id = 'sentry_user_123';
```

## Database Schema & Relationships

### Users Table Structure

```sql
CREATE TABLE "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "provider" text,                    -- OAuth provider ('sentry', 'github', 'google', 'fake')
    "provider_id" text,                 -- Provider-specific user ID
    "avatar" text,                      -- Avatar URL from OAuth provider
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_users_provider_id ON users(provider_id);
CREATE UNIQUE INDEX idx_users_provider_composite ON users(provider, provider_id);
```

### Data Relationships

```mermaid
erDiagram
    USERS {
        uuid id PK
        text email UK
        text name
        text provider
        text provider_id
        text avatar
        timestamp created_at
        timestamp updated_at
    }
    
    PROJECTS {
        uuid id PK
        uuid user_id FK
        text name
        text description
        text status
        timestamp created_at
        timestamp updated_at
    }
    
    TASKS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        text title
        text description
        text status
        text priority
        timestamp due_date
        timestamp created_at
        timestamp updated_at
    }
    
    SUBTASKS {
        uuid id PK
        uuid task_id FK
        uuid user_id FK
        text title
        text description
        text status
        text priority
        timestamp created_at
        timestamp updated_at
    }
    
    USERS ||--o{ PROJECTS : "owns"
    USERS ||--o{ TASKS : "creates"
    USERS ||--o{ SUBTASKS : "creates"
    PROJECTS ||--o{ TASKS : "contains"
    TASKS ||--o{ SUBTASKS : "contains"
```

## System Dependencies

### OAuth Provider Dependencies

```mermaid
flowchart TD
    subgraph "Sentry OAuth Provider"
        S1["Authorization<br/>https://sentry.io/oauth/authorize/"]
        S2["Token Exchange<br/>https://sentry.io/oauth/token/"]
        S3["User Profile (Primary)<br/>https://sentry.io/api/0/user/"]
        S4["User Profile (Fallback)<br/>https://sentry.io/api/0/users/me/"]
    end
    
    subgraph "Environment Variables"
        E1["SENTRY_OAUTH_CLIENT_ID"]
        E2["SENTRY_OAUTH_CLIENT_SECRET"]
        E3["SENTRY_OAUTH_REDIRECT_URI"]
        E4["SENTRY_BASE_URL"]
        E5["ANTHROPIC_API_KEY"]
        E6["DATABASE_URL"]
    end
    
    subgraph "Backend Dependencies"
        B1["@sentry/node<br/>Sentry monitoring"]
        B2["express<br/>Web framework"]
        B3["cors<br/>Cross-origin sharing"]
        B4["dotenv<br/>Environment loading"]
        B5["drizzle-orm<br/>Database ORM"]
        B6["pg<br/>PostgreSQL client"]
        B7["uuid<br/>UUID generation"]
    end
    
    subgraph "Frontend Dependencies"
        F1["@sentry/react<br/>Sentry React integration"]
        F2["react<br/>UI library"]
        F3["react-dom<br/>React DOM renderer"]
        F4["@types/react<br/>TypeScript types"]
        F5["tailwindcss<br/>CSS framework"]
        F6["vite<br/>Build tool"]
    end
    
    E1 --> S1
    E2 --> S2
    E3 --> S1
    E4 --> S1
    B1 --> S1
    B4 --> E1
    F1 --> B1
```

### Service Communication Flow

```mermaid
flowchart LR
    subgraph "Frontend Layer"
        React["Frontend (React)<br/>Port 5173"]
        Storage["Browser Storage<br/>- User ID<br/>- Auth Token<br/>- User Profile"]
    end
    
    subgraph "Backend Layer"
        Express["Backend (Express)<br/>Port 3001"]
        OAuth["OAuth Service<br/>- Auth Routes<br/>- Token Exchange<br/>- User Profile"]
    end
    
    subgraph "Database Layer"
        PostgreSQL["PostgreSQL Database<br/>- Users Table<br/>- Projects<br/>- Tasks<br/>- Subtasks"]
    end
    
    subgraph "External Services"
        Sentry["Sentry.io OAuth API<br/>- /oauth/authorize<br/>- /oauth/token<br/>- /api/0/user"]
    end
    
    React -."localStorage<br/>User Session".-> Storage
    React <-."HTTP/HTTPS<br/>REST API<br/>/api/*".-> Express
    Express -."SQL Queries<br/>Connection Pool<br/>Drizzle ORM".-> PostgreSQL
    OAuth <-."HTTPS/OAuth2.0<br/>Bearer Token<br/>Authorization".-> Sentry
    Express --> OAuth
```

## Error Handling Flows

### OAuth Error Scenarios

```mermaid
flowchart TD
    subgraph "Error Scenario 1: Sentry API Unavailable"
        OS1[OAuth Service<br/>Token Exchange] -->|Request Fails| SA1[Sentry API<br/>Down/Error]
        SA1 -->|HTTP 500/Timeout| EH1[Error Handler]
        EH1 --> EH1A[Log error with Sentry monitoring]
        EH1 --> EH1B[Return user-friendly error message]
        EH1 --> EH1C[Redirect to login with error parameter]
    end
    
    subgraph "Error Scenario 2: Invalid Authorization Code"
        OCH2[OAuth Callback<br/>Handler] -->|Invalid Code| SA2[Sentry API<br/>Token Exchange]
        SA2 -->|HTTP 400 Bad Request| EH2[Error Handler]
        EH2 --> EH2A[Log invalid code attempt]
        EH2 --> EH2B[Clear any partial auth state]
        EH2 --> EH2C[Redirect to login with error]
    end
    
    subgraph "Error Scenario 3: Database Connection Error"
        AR3[Auth Route<br/>User Creation] -->|Query Fails| DB3[PostgreSQL<br/>Connection Error]
        DB3 -->|Connection Timeout| EH3[Error Handler]
        EH3 --> EH3A[Log database error]
        EH3 --> EH3B[Return 500 Internal Server Error]
        EH3 --> EH3C[Maintain OAuth token for retry]
    end
    
    subgraph "Error Scenario 4: User Profile Fetch Failure"
        OS4[OAuth Service<br/>getUserInfo] -->|Primary Fails| UP4[/api/0/user<br/>Primary]
        UP4 -->|HTTP 404/403| FL4[Fallback Logic]
        FL4 -->|Fallback Tries| UF4[/api/0/users/me<br/>Fallback]
        UF4 -->|Success/Failure| CH4[Continue/Error<br/>Handling]
        CH4 --> CH4A[Continue with user data or<br/>Log and return authentication error]
    end
    
    subgraph "Error Scenario 5: Frontend OAuth Callback Error"
        OCC5[OAuth Callback<br/>Component] -->|Missing Params| UP5[URL Parser<br/>No userId]
        UP5 -->|Invalid State| FEH5[Frontend Error<br/>Handler]
        FEH5 --> FEH5A[Show user-friendly error message]
        FEH5 --> FEH5B[Clear localStorage]
        FEH5 --> FEH5C[Redirect to login screen]
        FEH5 --> FEH5D[Log error to Sentry]
    end
```

## Security Mechanisms

### OAuth 2.0 Security Features

```mermaid
mindmap
  root((Security Mechanisms))
    1. CSRF Protection
      State Parameter Generation
        Random state parameter for each OAuth request
        State validated on callback
        Implemented in server/services/sentry-oauth.ts
    2. Secure Token Handling
      Authorization Code Flow
        Uses authorization code flow (not implicit)
        Access tokens never exposed to frontend
        Tokens exchanged server-side only
        Short-lived authorization codes
    3. HTTPS Enforcement
      Transport Layer Security
        All OAuth communications over HTTPS
        Sentry endpoints require HTTPS
        Production deployment must use HTTPS
        Redirect URIs must match registered URLs
    4. Input Validation & Sanitization
      Request Validation
        OAuth callback parameters validated
        User profile data sanitized before DB insertion
        SQL injection prevention via parameterized queries
        Email format validation
    5. Database Security
      Data Protection
        Unique constraints on email and provider combinations
        UUID primary keys (not sequential integers)
        Timestamp tracking for audit trail
        No sensitive data stored (passwords, tokens)
    6. Session Management
      Authentication State
        Header-based authentication (x-user-id)
        No server-side session storage
        User ID validated against database on each request
        Frontend localStorage for session persistence
    7. Error Handling Security
      Information Disclosure Prevention
        Generic error messages to users
        Detailed errors logged server-side only
        No sensitive information in error responses
        Sentry monitoring for security events
    8. CORS Configuration
      Cross-Origin Resource Sharing
        Explicit CORS configuration
        Allowed origins whitelist
        Credentials handling controlled
        Preflight request handling
```

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Authentication | Request Body | Response |
|--------|----------|-------------|----------------|--------------|-----------|
| `POST` | `/api/auth/fake-login` | Demo login for development | None | `{email: string, name: string}` | `{userId: string, email: string, name: string}` |
| `GET` | `/api/auth/me` | Get current user info | Required (`x-user-id`) | None | `{user: UserObject}` |
| `POST` | `/api/auth/logout` | Logout endpoint | Required (`x-user-id`) | None | `{message: "Logged out"}` |
| `GET` | `/api/auth/sentry` | Initiate Sentry OAuth | None | None | `302 Redirect to Sentry` |
| `GET` | `/api/auth/sentry/callback` | OAuth callback handler | None | Query: `code`, `state` | `302 Redirect to frontend` |

### Protected Resource Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| `GET` | `/api/projects` | List user's projects | Required (`x-user-id`) |
| `POST` | `/api/projects` | Create new project | Required (`x-user-id`) |
| `GET` | `/api/projects/:id` | Get specific project | Required (`x-user-id`) |
| `PUT` | `/api/projects/:id` | Update project | Required (`x-user-id`) |
| `DELETE` | `/api/projects/:id` | Delete project | Required (`x-user-id`) |
| `POST` | `/api/chat` | AI chat interface | Required (`x-user-id`) |
| `POST` | `/api/ai/*` | AI tool endpoints | Required (`x-user-id`) |

### Frontend Routes

| Route | Component | Description | Authentication |
|-------|-----------|-------------|----------------|
| `/` | `App.tsx` | Main application | Required (redirects to login) |
| `/oauth-callback` | `AuthContext` | OAuth callback processor | None (processes auth) |
| `/login` (implicit) | `LoginScreen` | Login interface | None (shown when not authenticated) |

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-22  
**Authors**: System Architecture Team  
**Review Status**: Ready for Security Review