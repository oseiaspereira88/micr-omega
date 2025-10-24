# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MicrΩ is a Portuguese microscopic exploration game built as a monorepo with React frontend and Cloudflare Worker backend. Players control a bioluminescent organism in continuous evolution, facing enemy waves, collecting organic matter, and activating special abilities in a dynamically reactive aquatic environment.

## Monorepo Structure

This is a TypeScript monorepo with npm workspaces:

- `web/` - React + Vite frontend
- `worker/` - Cloudflare Worker with Durable Objects (realtime multiplayer backend)
- `shared/` - Shared TypeScript types and utilities used by both web and worker

The root `package.json` orchestrates workspace dependencies and scripts. All workspaces share TypeScript configuration via `tsconfig.base.json`.

## Development Commands

### Setup and Installation
```bash
npm install                    # Install all workspace dependencies
```

### Development Servers
```bash
npm run dev:worker            # Start Cloudflare Worker (requires wrangler 4.x)
npm run dev:web               # Start Vite dev server for frontend
```

Both servers must run simultaneously for full development experience. The web app connects to the worker via WebSocket.

### Environment Configuration

**CRITICAL**: Before starting development, create the local environment file:

```bash
# Create web/.env.local with the WebSocket URL
echo "VITE_REALTIME_URL=ws://127.0.0.1:8787" > web/.env.local
```

The worker runs on port `8787` by default via `wrangler dev`, and the frontend needs this URL to connect.

### Testing
```bash
npm run test                  # Run all workspace tests
npm run test -w web           # Web-only: Vitest unit tests for components/store
npm run test -w worker        # Worker-only: Miniflare integration tests for Durable Objects
npm run test:e2e -w web       # End-to-end tests with Playwright
```

### Building and Deployment
```bash
npm run build                 # Build web workspace only (for Cloudflare Pages)
npm run build:all            # Build all workspaces
npm run deploy -w worker      # Deploy worker (alias for wrangler deploy)
```

### Code Quality
```bash
npm run lint                  # Run linters across all workspaces
```

### Development Environment Validation
```bash
npm run validate:dev  # Validate development setup and check if servers are running
```

This script checks:
- If `web/.env.local` exists and is correctly configured
- If dependencies are installed
- If worker (port 8787) and frontend (port 5173) servers are running
- If the worker is responding to HTTP requests

### Observability
```bash
npm run tail:worker           # Start structured logging pipeline (wrangler tail + NDJSON)
npm run report:metrics        # Generate metrics report from log files
```

## Architecture

### Frontend (web/)
- **Game Engine**: Canvas-based rendering with React Context for state management
- **Key Systems**:
  - Game loop in `src/game/engine/useGameLoop.js`
  - State management via `GameContext.jsx` with reducer pattern
  - WebSocket integration in `hooks/useGameSocket.ts`
- **Rendering**: Modular renderers in `src/game/render/` for organisms, enemies, effects, HUD
- **Input**: Unified controller in `src/game/input/` supporting keyboard, mouse, and touch
- **Testing**: Vitest for unit tests, Playwright for E2E

### Backend (worker/)
- **Durable Objects**: `RoomDO.ts` manages game rooms with persistent state
- **Real-time**: WebSocket connections for multiplayer synchronization
- **Game Systems**: AI, progression, skills, world simulation
- **Testing**: Miniflare for Durable Object integration tests with property-based testing

### Shared (shared/)
- Common TypeScript types and validation schemas
- Zod schemas for client-server communication
- Combat system constants and utilities

## Key Conventions

### File Organization
- Game logic split between client-side simulation and server-side authority
- Configuration files in `config/` directories for game balance and settings
- Test files co-located with source code (`*.test.js/ts`)
- CSS Modules for component styling (`*.module.css`)

### State Management
- React Context + useReducer pattern in frontend
- Immutable state updates with action dispatching
- Server state synchronized via WebSocket messages

### TypeScript Usage
- Strict TypeScript configuration across all workspaces
- Shared types defined in `shared/` workspace
- Zod for runtime validation of network messages

### Testing Strategy
- Unit tests for pure functions and components
- Integration tests for Durable Object behavior
- Property-based testing for game logic validation
- E2E tests for full user workflows

## Development Workflow

1. Start both development servers (`dev:worker` and `dev:web`)
2. Frontend connects to local worker via WebSocket
3. Make changes - both servers support hot reload
4. Run tests before committing
5. Use `lint` command to check code quality

## Deployment

- **Frontend**: Cloudflare Pages with `npm ci && npm run build`
- **Worker**: `wrangler deploy` from worker directory
- **Environment Variables**: Configure in Cloudflare dashboard or `wrangler.toml`

The worker serves WebSocket connections on the root path with HTTPS/WSS routing via dedicated subdomain (e.g., `realtime.example.com`).

## Troubleshooting

### Frontend stuck on "Conectando..." (Connecting)

This happens when the frontend cannot establish a WebSocket connection with the worker. Common causes and solutions:

1. **Missing or incorrect `.env.local` configuration**
   - **Problem**: `web/.env.local` doesn't exist or has wrong WebSocket URL
   - **Solution**: Create/update the file:
     ```bash
     echo "VITE_REALTIME_URL=ws://127.0.0.1:8787" > web/.env.local
     ```
   - **Verify**: Check browser console for connection attempts to wrong URL

2. **Worker not running**
   - **Problem**: The Cloudflare Worker dev server is not running
   - **Solution**: Start the worker in a separate terminal:
     ```bash
     npm run dev:worker
     ```
   - **Verify**: Check if port 8787 is listening: `curl http://127.0.0.1:8787/health`

3. **Port conflict**
   - **Problem**: Another process is using port 8787
   - **Solution**: Find and stop the conflicting process, or configure a different port in `worker/wrangler.toml`:
     ```toml
     [dev]
     port = 8788  # Use alternative port
     ```
     Then update `web/.env.local` to match

4. **CORS issues**
   - **Problem**: Browser blocks WebSocket upgrade due to CORS
   - **Solution**: Ensure worker's `index.ts` includes CORS headers (already implemented)
   - **Verify**: Check browser console for CORS-related errors

5. **Frontend cache issues**
   - **Problem**: Vite cached old environment variables
   - **Solution**:
     ```bash
     # Stop frontend dev server (Ctrl+C)
     # Delete .env.local from cache
     rm -rf web/node_modules/.vite
     # Restart frontend
     npm run dev:web
     ```

### Debugging WebSocket Connection

Enable debug logs in development mode by opening browser console. Look for messages prefixed with `[useGameSocket]`:

```
[useGameSocket] Conectando ao WebSocket: { url: "ws://127.0.0.1:8787", ... }
[useGameSocket] WebSocket conectado com sucesso
```

If you see connection errors, check:
- Network tab in browser DevTools (WS filter)
- Worker logs in terminal where `dev:worker` is running
- Response from health endpoint: `curl http://127.0.0.1:8787/health`

### Quick Validation

Run the validation script to check your development environment:

```bash
npm run validate:dev
```

This will report:
- ✓ Configuration files present
- ✓ Dependencies installed
- ✓ Servers running on correct ports
- ✓ Worker responding to requests

### Common Development Workflow

1. **First time setup**:
   ```bash
   npm install
   echo "VITE_REALTIME_URL=ws://127.0.0.1:8787" > web/.env.local
   ```

2. **Start development** (requires 2 terminals):
   ```bash
   # Terminal 1
   npm run dev:worker

   # Terminal 2 (wait for worker to start)
   npm run dev:web
   ```

3. **Validate setup**:
   ```bash
   npm run validate:dev
   ```

4. **Access application**:
   - Frontend: http://localhost:5173
   - Worker health: http://127.0.0.1:8787/health