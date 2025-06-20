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
  - `src/components/ChatInterface.tsx` - AI chat integration
- **Types**: Centralized type definitions in `src/types/index.ts`
- **Styling**: Tailwind CSS v4 with utility-first approach and responsive design

### Backend (Express + TypeScript)
- **Server**: Express server (`server/index.ts`) with CORS and JSON middleware
- **Data Storage**: In-memory storage (`server/storage/memory-store.ts`) for development
- **API Routes**: 
  - `server/routes/projects.ts` - CRUD operations for projects/tasks/subtasks
  - `server/routes/chat.ts` - AI chat integration with tool calling
- **AI Tools**: `server/tools/task-tools.ts` - Tools for creating/managing projects via AI

### AI Integration
- **Provider**: Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) via Vercel AI SDK
- **Tools Available**:
  - `createProject` - Create new projects
  - `createTask` - Add tasks to projects
  - `createSubtask` - Add subtasks to tasks
  - `updateTaskStatus` - Change task status (todo/in_progress/completed)
  - `listProjects` - Get all projects
  - `getProject` - Get specific project details

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
2. Frontend proxies `/api/*` requests to backend (port 3001)
3. Backend serves on port 3001, frontend on port 5173

## Development Notes

- Uses ES modules throughout (`"type": "module"`)
- Concurrent development with `concurrently` package
- TypeScript strict mode enabled
- API communication via fetch with error handling
- Real-time UI updates when AI tools modify data
- Memory storage resets on server restart (upgrade to database for persistence)