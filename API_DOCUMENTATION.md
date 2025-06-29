# Project Management API Documentation

## Base URL
```
http://localhost:3001/api
```

## Overview
This is a RESTful API for managing projects, tasks, and subtasks. The API supports full CRUD operations and includes an AI-powered chat interface for natural language project management.

### ID Format
The API uses human-readable slug-based identifiers:
- **Project IDs**: Alphanumeric + hyphens, max 20 characters (e.g., `photoshare`, `awesome-app`)
- **Task IDs**: Project slug + sequential number, max 20 characters (e.g., `photoshare-1`, `awesome-app-12`)
- **User/Comment IDs**: Standard UUIDs

## Content-Type
All requests and responses use `Content-Type: application/json`

---

## Authentication

This API supports two authentication methods:

### 1. JWT Tokens (Web Application)
For web application users, authentication is handled automatically through OAuth login. JWT tokens are included in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

### 2. API Keys (Direct API Access)
For direct API access, you can use API keys generated from your user profile. API keys provide secure, programmatic access to your account data.

**Format:** `sb_<64_hex_characters>`

**Usage:**
```http
Authorization: Bearer sb_1234567890abcdef...
```

**Getting an API Key:**
1. Sign in to the web application
2. Go to Profile → API Keys tab  
3. Create a new API key with a descriptive name
4. Copy the key (shown only once)
5. Use the key in your API requests

**Security Features:**
- Keys are scoped to your user account only
- Optional expiration dates (1-365 days)
- Usage tracking (last used timestamps)
- Secure hashing (keys never stored in plaintext)
- Rate limiting (10 operations per 15 minutes)
- Comprehensive audit logging

**API Key Management Endpoints:**
- `POST /api/api-keys/create` - Create new API key
- `GET /api/api-keys/list` - List your API keys
- `DELETE /api/api-keys/{keyId}` - Delete API key
- `GET /api/api-keys/{keyId}` - Get key details

**Example API Key Creation:**
```bash
curl -X POST \
     -H "Authorization: Bearer <your_jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "Production Server", "expiresInDays": 90}' \
     http://localhost:3001/api/api-keys/create
```

**All protected endpoints require authentication.** Requests without valid authentication will return `401 Unauthorized`.

---

## API Endpoints

### Projects

#### 1. Get All Projects
```http
GET /api/projects
```

**Response:**
```json
[
  {
    "id": "photoshare",
    "name": "PhotoShare App",
    "description": "A social photo sharing platform",
    "status": "active",
    "tasks": [
      {
        "id": "photoshare-1", 
        "projectId": "photoshare",
        "title": "Create user authentication",
        "description": "Implement OAuth login system",
        "status": "in_progress",
        "priority": "high",
        "dueDate": "2024-12-15T00:00:00.000Z",
        "subtasks": [...],
        "createdAt": "2024-12-01T10:00:00.000Z",
        "updatedAt": "2024-12-01T15:30:00.000Z"
      }
    ],
    "createdAt": "string (ISO date)",
    "updatedAt": "string (ISO date)"
  }
]
```

**Example:**
```bash
curl -H "Authorization: Bearer <your_api_key>" \
     http://localhost:3001/api/projects
```

#### 2. Get Project by ID
```http
GET /api/projects/{id}
```

**Parameters:**
- `id` (path, required): Project slug ID (e.g., `website-redesign`)

**Response:**
```json
{
  "id": "website-redesign",
  "name": "Website Redesign",
  "description": "Complete redesign of company website",
  "status": "active",
  "tasks": [...],
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Error Responses:**
- `404`: Project not found

**Example:**
```bash
curl -H "Authorization: Bearer <your_api_key>" \
     http://localhost:3001/api/projects/website-redesign
```

#### 3. Create Project
```http
POST /api/projects
```

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)"
}
```

**Response:** `201 Created`
```json
{
  "id": "new-project",
  "name": "New Project",
  "description": "Project description",
  "status": "active",
  "tasks": [],
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Error Responses:**
- `400`: Missing required fields (name)
- `500`: Server error

**Example:**
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Redesign",
    "description": "Complete redesign of company website"
  }'
```

#### 4. Update Project
```http
PUT /api/projects/{id}
```

**Parameters:**
- `id` (path, required): Project ID

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "status": "active | completed | archived (optional)"
}
```

**Response:**
```json
{
  "id": "proj-123",
  "name": "Updated Project Name",
  "description": "Updated description",
  "status": "completed",
  "tasks": [...],
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

**Error Responses:**
- `404`: Project not found
- `500`: Server error

**Example:**
```bash
curl -X PUT http://localhost:3001/api/projects/proj-123 \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name",
    "status": "completed"
  }'
```

#### 5. Delete Project
```http
DELETE /api/projects/{id}
```

**Parameters:**
- `id` (path, required): Project ID

**Response:** `204 No Content`

**Error Responses:**
- `404`: Project not found
- `500`: Server error

**Example:**
```bash
curl -X DELETE http://localhost:3001/api/projects/proj-123 \
  -H "Authorization: Bearer <your_api_key>"
```

---

### Tasks

#### 1. Create Task
```http
POST /api/projects/{projectId}/tasks
```

**Parameters:**
- `projectId` (path, required): Project ID

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "priority": "low | medium | high (optional, default: medium)",
  "dueDate": "string (ISO date, optional)"
}
```

**Response:** `201 Created`
```json
{
  "id": "task-456",
  "projectId": "proj-123",
  "title": "Implement user authentication",
  "description": "Add login and registration functionality",
  "status": "todo",
  "priority": "high",
  "dueDate": "2025-01-30T00:00:00Z",
  "subtasks": [],
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Error Responses:**
- `400`: Missing required fields (title)
- `404`: Project not found
- `500`: Server error

**Example:**
```bash
curl -X POST http://localhost:3001/api/projects/proj-123/tasks \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication",
    "description": "Add login and registration functionality",
    "priority": "high",
    "dueDate": "2025-01-30T00:00:00Z"
  }'
```

#### 2. Get Task by ID
```http
GET /api/projects/{projectId}/tasks/{taskId}
```

**Parameters:**
- `projectId` (path, required): Project ID
- `taskId` (path, required): Task ID

**Response:**
```json
{
  "id": "task-456",
  "projectId": "proj-123",
  "title": "Implement user authentication",
  "description": "Add login and registration functionality",
  "status": "in_progress",
  "priority": "high",
  "dueDate": "2025-01-30T00:00:00Z",
  "subtasks": [...],
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T11:00:00Z"
}
```

**Error Responses:**
- `404`: Task not found

**Example:**
```bash
curl -X GET http://localhost:3001/api/projects/proj-123/tasks/task-456 \
  -H "Authorization: Bearer <your_api_key>"
```

#### 3. Update Task
```http
PUT /api/projects/{projectId}/tasks/{taskId}
```

**Parameters:**
- `projectId` (path, required): Project ID
- `taskId` (path, required): Task ID

**Request Body:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "status": "todo | in_progress | completed (optional)",
  "priority": "low | medium | high (optional)",
  "dueDate": "string (ISO date, optional)"
}
```

**Response:**
```json
{
  "id": "task-456",
  "projectId": "proj-123",
  "title": "Updated task title",
  "description": "Updated description",
  "status": "completed",
  "priority": "medium",
  "dueDate": "2025-01-30T00:00:00Z",
  "subtasks": [...],
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T12:00:00Z"
}
```

**Error Responses:**
- `404`: Task not found
- `500`: Server error

**Example:**
```bash
curl -X PUT http://localhost:3001/api/projects/proj-123/tasks/task-456 \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "title": "User authentication - Completed"
  }'
```

#### 4. Delete Task
```http
DELETE /api/projects/{projectId}/tasks/{taskId}
```

**Parameters:**
- `projectId` (path, required): Project ID
- `taskId` (path, required): Task ID

**Response:** `204 No Content`

**Error Responses:**
- `404`: Task not found
- `500`: Server error

**Example:**
```bash
curl -X DELETE http://localhost:3001/api/projects/proj-123/tasks/task-456 \
  -H "Authorization: Bearer <your_api_key>"
```

---

### Subtasks

#### 1. Create Subtask
```http
POST /api/projects/{projectId}/tasks/{taskId}/subtasks
```

**Parameters:**
- `projectId` (path, required): Project ID
- `taskId` (path, required): Task ID

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "priority": "low | medium | high (optional, default: medium)"
}
```

**Response:** `201 Created`
```json
{
  "id": "subtask-789",
  "taskId": "task-456",
  "title": "Create login form",
  "description": "Design and implement the login form UI",
  "status": "todo",
  "priority": "medium",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

**Error Responses:**
- `400`: Missing required fields (title)
- `404`: Task not found
- `500`: Server error

**Example:**
```bash
curl -X POST http://localhost:3001/api/projects/proj-123/tasks/task-456/subtasks \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Create login form",
    "description": "Design and implement the login form UI",
    "priority": "medium"
  }'
```

#### 2. Update Subtask
```http
PUT /api/projects/tasks/{taskId}/subtasks/{subtaskId}
```

**Parameters:**
- `taskId` (path, required): Task ID
- `subtaskId` (path, required): Subtask ID

**Request Body:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "status": "todo | in_progress | completed (optional)",
  "priority": "low | medium | high (optional)"
}
```

**Response:**
```json
{
  "id": "subtask-789",
  "taskId": "task-456",
  "title": "Updated subtask title",
  "description": "Updated description",
  "status": "completed",
  "priority": "high",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T12:00:00Z"
}
```

**Error Responses:**
- `404`: Subtask not found
- `500`: Server error

**Example:**
```bash
curl -X PUT http://localhost:3001/api/projects/tasks/task-456/subtasks/subtask-789 \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

#### 3. Delete Subtask
```http
DELETE /api/projects/tasks/{taskId}/subtasks/{subtaskId}
```

**Parameters:**
- `taskId` (path, required): Task ID
- `subtaskId` (path, required): Subtask ID

**Response:** `204 No Content`

**Error Responses:**
- `404`: Subtask not found
- `500`: Server error

**Example:**
```bash
curl -X DELETE http://localhost:3001/api/projects/tasks/task-456/subtasks/subtask-789 \
  -H "Authorization: Bearer <your_api_key>"
```

---

### AI Chat Interface

#### 1. AI Chat Stream
```http
POST /api/chat/stream
```

**Description:** 
Interact with the AI assistant for project management tasks. The AI can create projects, tasks, and subtasks using natural language.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user | assistant",
      "content": "string"
    }
  ]
}
```

**Response:** 
Server-Sent Events (SSE) stream with AI responses and tool executions.

**AI Capabilities:**
- Create new projects
- Add tasks to projects
- Create subtasks within tasks
- Update task statuses
- List projects and project details
- Natural language project management

**Example:**
```bash
curl -X POST http://localhost:3001/api/chat/stream \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Create a new project called Website Redesign with a task to implement user authentication"
      }
    ]
  }'
```

**Sample AI Commands:**
- "Create a new project called 'Mobile App Development'"
- "Add a task to implement push notifications to project proj-123"
- "Mark task task-456 as completed"
- "Show me all my projects"
- "Create a subtask for user registration under the authentication task"

---

### Health Check

#### 1. Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

**Example:**
```bash
curl -X GET http://localhost:3001/api/health
```

---

## Data Models

### Enums

#### TaskStatus
- `todo`
- `in_progress` 
- `completed`

#### ProjectStatus
- `active`
- `completed`
- `archived`

#### Priority
- `low`
- `medium`
- `high`

### Project Object
```json
{
  "id": "string (UUID)",
  "name": "string",
  "description": "string (optional)",
  "status": "ProjectStatus",
  "tasks": "Task[]",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)"
}
```

### Task Object
```json
{
  "id": "string (UUID)",
  "projectId": "string (UUID)",
  "title": "string",
  "description": "string (optional)",
  "status": "TaskStatus",
  "priority": "Priority",
  "dueDate": "string (ISO date, optional)",
  "subtasks": "Subtask[]",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)"
}
```

### Subtask Object
```json
{
  "id": "string (UUID)",
  "taskId": "string (UUID)",
  "title": "string",
  "description": "string (optional)",
  "status": "TaskStatus",
  "priority": "Priority",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)"
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": "string (error message)"
}
```

### HTTP Status Codes
- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting
Currently, there are no rate limits implemented.

## CORS
CORS is enabled for all origins (`*`).

## Data Storage
**Important:** This API uses in-memory storage. All data will be lost when the server restarts. For production use, integrate with a persistent database.

---

## Example Workflows

### Creating a Complete Project Structure
```bash
# 1. Create a project
PROJECT_ID=$(curl -s -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Website Redesign", "description": "Complete website overhaul"}' | jq -r '.id')

# 2. Add a task
TASK_ID=$(curl -s -X POST http://localhost:3001/api/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"title": "User Authentication", "priority": "high", "dueDate": "2025-02-01T00:00:00Z"}' | jq -r '.id')

# 3. Add subtasks
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/tasks/$TASK_ID/subtasks \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Create login form", "priority": "medium"}'

curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/tasks/$TASK_ID/subtasks \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement password validation", "priority": "high"}'

# 4. View the complete project
curl -X GET http://localhost:3001/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer <your_api_key>"
```

### Using AI for Project Management
```bash
# Create project and tasks using natural language
curl -X POST http://localhost:3001/api/chat/stream \
  -H "Authorization: Bearer <your_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Create a project called E-commerce Platform with tasks for user registration, product catalog, shopping cart, and payment integration. Make the payment task high priority."
      }
    ]
  }'
```