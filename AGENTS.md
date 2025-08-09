# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript client (Vite). Key areas: `components/`, `pages/`, `hooks/`, `context/`.
- `server/`: Express API (TypeScript). Layout: `routes/`, `services/`, `db/`, `middleware/`, `utils/`, `swagger.ts`.
- `mcp-service/`: Standalone MCP service (Express + TypeScript) with its own scripts and linting.
- `drizzle/` + `drizzle.config.ts`: Database schema and migrations.
- `public/` static assets, `docs/` documentation, `dist/` build outputs.

## Build, Test, and Development Commands
- Root dev: `npm run dev` — runs client, API, and MCP concurrently.
- Client: `npm run dev:client` / `npm run build:client` / `npm run preview`.
- API server: `npm run dev:server`; build all TS: `npm run build:server`.
- MCP: `npm run dev:mcp` / `npm run build:mcp` / `npm run start:mcp`.
- Full build: `npm run build:full`.
- Lint: `npm run lint` (runs root + MCP lint).
- Server DB migrations (from `server/`): `npm run migrate` (drizzle-kit push).
- API flow tests: `./test-api.sh`; OAuth flow: `node test-oauth-flow.js`.
- MCP service tests (from `mcp-service/`): `npm run test-mcp-analytics`, `npm run test-session-flow`.

## Coding Style & Naming Conventions
- Language: TypeScript across client and servers.
- Linting: ESLint (`eslint.config.js`) with React Hooks rules. Fix issues before PRs.
- Indentation: 2 spaces; prefer single quotes; avoid unused exports.
- Components: PascalCase (`AIAssistant.tsx`); hooks: `useX` in `src/hooks/`.
- Views/utilities: kebab-case files where already established (e.g., `components-view.tsx`).
- Types/interfaces: PascalCase in `types/`.

## Testing Guidelines
- No centralized root unit test runner. Use the shell scripts and service-specific test scripts above.
- Add new tests colocated with code (e.g., `feature-name.test.ts`) and document how to run them in your PR.

## Commit & Pull Request Guidelines
- Commit style: Conventional Commits with scope, e.g., `fix(mcp): improve OAuth flow`, `refactor(server): simplify routes`.
- PRs: concise description, linked issues, screenshots for UI, steps to validate (commands and expected results), and note any env vars/migrations.
- Pre-PR checklist: `npm run lint`, run relevant test scripts, and confirm `npm run build:full` succeeds.

## Security & Configuration
- Env files: copy `.env.example` to `.env`; API also uses `server/.env`. Do not commit secrets.
- CORS/rate limiting enabled on the API; prefer least-privilege keys and rotate regularly.
