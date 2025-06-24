# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack project management application built with React + TypeScript + Vite frontend and Express backend. It features AI-powered task creation through natural language using Anthropic's Claude and the Vercel AI SDK.

## Common Commands

- `npm run dev` - Start both frontend and backend servers concurrently
- `npm run dev:client` - Start frontend development server only (port 5173)
- `npm run dev:server` - Start backend server only (port 3001)
- `npm run build` - Build frontend for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally
- `./test-api.sh` - Run comprehensive API tests (requires server to be running)

## Architecture

### Frontend (React + TypeScript + Vite)
- **Framework**: React 19 with TypeScript and Vite for HMR
- **State Management**: React Context (`src/context/ProjectContext.tsx`) for projects and tasks
- **UI Components**: 
  - `src/components/ProjectList.tsx` - Project overview and management
  - `src/components/TaskList.tsx` - Task and subtask management
  - `src/components/ChatInterface.tsx` - AI chat integration with tool calling
  - `src/components/MVPBuilder.tsx` - AI-powered MVP project generator
- **Types**: Centralized type definitions in `src/types/index.ts`
- **Styling**: Tailwind CSS v4 with utility-first approach and responsive design

### Backend (Express + TypeScript)
- **Server**: Express server (`server/index.ts`) with CORS and JSON middleware
- **Data Storage**: In-memory storage (`server/storage/memory-store.ts`) for development
- **API Routes**: 
  - `server/routes/projects.ts` - CRUD operations for projects/tasks/subtasks
  - `server/routes/chat.ts` - AI chat integration with tool calling
  - `server/routes/ai.ts` - AI-powered features (MVP generation, task details)
- **AI Tools**: `server/tools/task-tools.ts` - Tools for creating/managing projects via AI

### AI Integration
- **Provider**: Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) via Vercel AI SDK
- **Chat Interface**: Streaming tool calls with real-time UI updates
- **MVP Builder**: Two-step AI-powered project generation

#### Chat Tools Available:
- `createProject` - Create new projects
- `createTask` - Add tasks to projects
- `createSubtask` - Add subtasks to tasks
- `updateTaskStatus` - Change task status (todo/in_progress/completed)
- `listProjects` - Get all projects
- `getProject` - Get specific project details

#### MVP Builder Tools:
- `generateMVPPlan` - Generate comprehensive MVP plans without creating projects

#### AI Endpoints:
- `/api/chat/stream` - Streaming chat with tool calling for interactive project management
- `/api/ai/generatemvp` - Generate MVP plan from project idea (JSON response)
- `/api/ai/create-mvp-project` - Create complete MVP project from generated plan
- `/api/ai/generate-details` - Generate detailed task descriptions

### API Documentation
- **Interactive Swagger UI**: Available at `http://localhost:3001/api-docs` when server is running
- **Markdown Documentation**: Comprehensive API docs in `API_DOCUMENTATION.md`
- **Testing Script**: Use `./test-api.sh` to test all endpoints
- **Base URL**: `http://localhost:3001/api`

## Data Models

- **Project**: Has name, description, status, tasks array, timestamps
- **Task**: Belongs to project, has title, description, status, priority, due date, subtasks, timestamps
- **Subtask**: Belongs to task, has title, description, status, priority, timestamps
- **Enums**: TaskStatus, ProjectStatus, Priority for type safety

## Environment Setup

1. Set `ANTHROPIC_API_KEY` environment variable for AI functionality
2. Set `VITE_API_BASE_URL` environment variable for API endpoint (defaults to `http://localhost:3001`)
3. Frontend connects directly to backend API (no proxy)
4. Backend serves on port 3001, frontend on port 5173

### Environment Variables

- `VITE_API_BASE_URL` - API base URL (default: `http://localhost:3001`)
- `ANTHROPIC_API_KEY` - Required for AI functionality
- `JWT_SECRET` - JWT signing secret for authentication
- `SENTRY_OAUTH_*` - Sentry OAuth configuration for authentication

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

- Uses ES modules throughout (`"type": "module"`)
- Concurrent development with `concurrently` package
- TypeScript strict mode enabled
- API communication via fetch with error handling
- Real-time UI updates when AI tools modify data
- Memory storage resets on server restart (upgrade to database for persistence)