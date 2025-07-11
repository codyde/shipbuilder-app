# Project Management Application

A modern, full-stack project management application with AI-powered task creation and natural language interaction. Built with React, TypeScript, Node.js, and PostgreSQL.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)

## 🚀 Features

### Core Project Management
- **Project Organization**: Create and manage multiple projects with descriptions and status tracking
- **Task Management**: Add tasks with priorities, due dates, and descriptions
- **Subtask Support**: Break down tasks into manageable subtasks
- **Status Tracking**: Track progress with todo, in-progress, and completed states
- **Priority Levels**: Organize work with low, medium, and high priority levels

### AI-Powered Assistance
- **Natural Language Processing**: Create projects and tasks using conversational AI
- **Intelligent Task Creation**: AI understands context and creates structured tasks from descriptions
- **Project Insights**: Get AI-powered suggestions and project status summaries
- **Chat Interface**: Integrated chat sidebar for seamless AI interaction

### Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern Interface**: Clean, intuitive design with Tailwind CSS
- **Real-time Updates**: Live updates when AI tools modify data
- **Interactive Components**: Rich UI components with dialogs, tables, and forms

### Developer Experience
- **Type Safety**: Full TypeScript implementation across frontend and backend
- **API Documentation**: Interactive Swagger UI and comprehensive API docs
- **Database Integration**: Robust PostgreSQL integration with Drizzle ORM
- **Testing Tools**: Comprehensive API testing scripts included

## 🏗️ Technology Stack

### Frontend
- **React 19** - Modern React with latest features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool with HMR
- **Tailwind CSS v4** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Vercel AI SDK** - AI integration

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **TypeScript** - Server-side type safety
- **Drizzle ORM** - Type-safe database interactions
- **PostgreSQL** - Production database (Neon)
- **Swagger** - API documentation

### AI & Integrations
- **Anthropic Claude Sonnet 4 & Opus 4** - Advanced AI capabilities
- **OpenAI GPT-4o & GPT-4o Mini** - Alternative AI model options
- **Tool Calling** - Structured AI function execution
- **Natural Language Processing** - Convert text to structured data
- **Provider Switching** - Choose between Anthropic and OpenAI models in settings

### DevOps & Monitoring
- **Sentry** - Error tracking and performance monitoring
- **ESLint** - Code linting and quality
- **Concurrent Development** - Frontend and backend in parallel

## 📋 Prerequisites

- **Node.js** 20+ 
- **npm** or **yarn**
- **PostgreSQL database** (Neon cloud database recommended)
- **Anthropic API key** OR **OpenAI API key** for AI functionality

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd samplechat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Create `.env` in the root directory:
   ```env
   # Choose one or both AI providers
   ANTHROPIC_API_KEY=your_anthropic_api_key_here  # For Claude models
   OPENAI_API_KEY=your_openai_api_key_here        # For GPT models
   ```
   
   Create `server/.env`:
   ```env
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
   ```

4. **Database Setup**
   ```bash
   # Generate and apply database migrations
   npx drizzle-kit generate
   npx drizzle-kit push
   ```

## 🚀 Development

### Start Development Servers
```bash
# Start both frontend and backend concurrently
npm run dev

# Or start individually:
npm run dev:client  # Frontend only (port 5173)
npm run dev:server  # Backend only (port 3001)
```

### Build for Production
```bash
npm run build
```

### Code Quality
```bash
npm run lint
```

### API Testing
```bash
# Run comprehensive API tests
./test-api.sh
```

## 📚 API Documentation

### Interactive Documentation
- **Swagger UI**: http://localhost:3001/api-docs
- **Markdown Docs**: `./API_DOCUMENTATION.md`

### Core Endpoints
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `POST /api/projects/:id/tasks` - Create task
- `POST /api/chat/stream` - AI chat interface

### Health Check
```bash
curl http://localhost:3001/api/health
```

## 🤖 AI Integration

The application features powerful AI integration that allows users to:

### Natural Language Project Management
```
"Create a new project called Website Redesign with tasks for user research, wireframing, and prototyping"
```

### Available AI Tools
- `createProject` - Create new projects from descriptions
- `createTask` - Add tasks to existing projects
- `createSubtask` - Break down tasks into subtasks
- `updateTaskStatus` - Change task completion status
- `listProjects` - Get overview of all projects
- `getProject` - Detailed project information

### Usage Examples
- "List all my projects"
- "Create a task to implement user authentication"
- "Mark the login task as completed"
- "Show me the status of my current tasks"

## 🗃️ Database Schema

### Projects
- `id` (UUID) - Primary key
- `name` (String) - Project name
- `description` (String, optional) - Project description
- `status` (Enum) - active, completed, archived
- `created_at`, `updated_at` (Timestamp)

### Tasks
- `id` (UUID) - Primary key
- `project_id` (UUID) - Foreign key to projects
- `title` (String) - Task title
- `description` (String, optional)
- `status` (Enum) - todo, in_progress, completed
- `priority` (Enum) - low, medium, high
- `due_date` (Timestamp, optional)
- `created_at`, `updated_at` (Timestamp)

### Subtasks
- `id` (UUID) - Primary key
- `task_id` (UUID) - Foreign key to tasks
- `title` (String) - Subtask title
- `description` (String, optional)
- `status` (Enum) - todo, in_progress, completed
- `priority` (Enum) - low, medium, high
- `created_at`, `updated_at` (Timestamp)

## 🔧 Configuration

### Frontend Proxy
The frontend development server proxies API requests to the backend:
```
/api/* → http://localhost:3001/api/*
```

### Environment Variables

#### Root `.env`
```env
ANTHROPIC_API_KEY=your_anthropic_api_key
```

#### Server `server/.env`
```env
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
NODE_ENV=development
```

## 📁 Project Structure

```
samplechat/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript type definitions
│   └── lib/               # Utility functions
├── server/                # Backend Node.js application
│   ├── db/                # Database schema and services
│   ├── routes/            # Express API routes
│   ├── tools/             # AI tool definitions
│   └── storage/           # Legacy memory storage
├── drizzle/              # Database migrations
├── public/               # Static frontend assets
└── docs/                 # Documentation
```

## 🔒 Security

- **Environment Variables**: Sensitive data stored in `.env` files (excluded from git)
- **Type Safety**: Full TypeScript coverage prevents runtime errors
- **Input Validation**: API request validation and sanitization
- **Database Security**: Parameterized queries prevent SQL injection
- **SSL/TLS**: Secure database connections required

## 🧪 Testing

### API Testing
```bash
# Comprehensive API test suite
./test-api.sh

# Manual endpoint testing
curl http://localhost:3001/api/projects
```

### Development Testing
- Health check endpoint for server status
- Database connection verification
- AI tool function testing

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Environment Setup
1. Set production environment variables
2. Configure production database
3. Update CORS settings for production domains
4. Set up error monitoring (Sentry)

### Database Migration
```bash
# Apply migrations to production database
DATABASE_URL="production_url" npx drizzle-kit push
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Documentation**: `./API_DOCUMENTATION.md`
- **Project Guide**: `./CLAUDE.md`
- **API Testing**: `./test-api.sh`
- **Interactive API Docs**: http://localhost:3001/api-docs

## 💡 Tips

- Use the AI chat interface for natural language project management
- Check the API documentation for detailed endpoint information
- Run the test script to verify all functionality
- Monitor the Sentry dashboard for production issues

---

Built with ❤️ using modern web technologies and AI-powered assistance.

## 🤖 AI Provider Configuration

ShipBuilder now supports both Anthropic Claude and OpenAI models. You can switch between providers in the Settings screen.

### Supported Models

**Anthropic:**
- Claude Sonnet 4 (Default) - Balanced performance for most tasks
- Claude Opus 4 - Most powerful model for complex tasks

**OpenAI:**
- GPT-4o - Latest model with strong performance
- GPT-4o Mini - Faster, more cost-effective option
- GPT-4 Turbo - Previous generation high-performance model

### Switching Providers

1. Navigate to Settings (gear icon in sidebar)
2. Find the "AI Provider" section
3. Select your preferred provider
4. The change takes effect immediately for all AI features

### API Key Requirements

- **For Anthropic**: Set `ANTHROPIC_API_KEY` in your `.env` file
- **For OpenAI**: Set `OPENAI_API_KEY` in your `.env` file
- You can configure both to allow users to switch between providers
- Only providers with valid API keys will be available in settings