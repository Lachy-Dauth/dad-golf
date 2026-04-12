# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (server on :3001, client on :5173)
npm run dev

# Build all packages (shared → server → client)
npm run build

# Lint & format
npm run lint            # check
npm run lint:fix        # auto-fix
npm run format:check    # check
npm run format          # auto-fix

# Tests (Node test runner, shared package only)
npm test
npm run test --workspace=shared    # same thing, explicit

# Run a single workspace
npm run dev:server      # server only (tsx watch)
npm run dev:client      # client only (Vite)

# Build a single workspace
npm run build --workspace=shared
npm run build --workspace=server
npm run build --workspace=client
```

After `npm install`, the shared package is automatically built via `postinstall`.

## Architecture

**Monorepo** with three npm workspaces: `shared`, `server`, `client`.

### Shared (`@dad-golf/shared`)

Exports types, Stableford scoring logic, and room code utilities. Both server and client depend on it. ESM-only, outputs `.d.ts` declarations. Must be built before server or client.

### Server (`@dad-golf/server`)

Fastify + `@fastify/websocket`. Raw SQL against PostgreSQL via `pg` (no ORM). Each domain has a `db/*.ts` module (query functions) and a `routes/*.ts` module (HTTP endpoints).

**Route registration pattern**: each file exports `registerXxxRoutes(app: FastifyInstance)`, all called from `routes/index.ts`. Routes use Fastify generics for typing: `app.post<{ Body: {...}; Params: {...} }>("/path", handler)`.

**Auth**: scrypt password hashing, random hex session tokens stored in `sessions` table. Bearer token in `Authorization` header. Helpers in `routes/validation.ts`: `getViewerUser(req)` (optional), `requireUser(req, reply)`, `requireAdmin(req, reply)`.

**Real-time updates**: WebSocket pub/sub via `hub.ts` (`Map<roomCode, Set<WebSocket>>`). Clients connect to `/ws/:code?token=...`. After any mutation (score, join, start), the route rebuilds full `RoundState` via `roundState.ts` and broadcasts to all sockets in the room. Client uses `useRoundSocket.ts` hook which auto-reconnects and updates React state.

**Production serving**: if `client/dist/` exists, Fastify serves it as static files with SPA fallback (non-API 404s → `index.html`).

### Client (`@dad-golf/client`)

React 18 + Vite + TypeScript. Mobile-first. Vite proxies `/api` → `http://localhost:3001` and `/ws` → `ws://localhost:3001` in dev.

Auth state in `AuthContext.tsx` (token in localStorage key `"sf:token"`). Theme toggle in `ThemeContext.tsx`.

### Database

Raw parameterized SQL (`pool.query(sql, [params])`). Schema auto-created via `initDb()` in `db/schema.ts` (CREATE IF NOT EXISTS). Course holes stored as JSON text column. Booleans are INTEGER 0/1.

## Code Style

- **TypeScript**: strict mode, `noUnusedLocals`, `noUnusedParameters` (prefix unused with `_`)
- **Prettier**: 100 char line width, trailing commas
- **ESLint 9**: flat config, TypeScript recommended + React hooks for client
- **Error responses**: `reply.code(status).send({ error: "message" })`

## Maintenance

When adding or removing features, update `README.md` to reflect the change.

## Deployment

Railway with Nixpacks (Node.js 22). Health check at `GET /api/health`. Config in `railway.json` and `nixpacks.toml`.

**Required env**: `DATABASE_URL` (PostgreSQL connection string). Optional: `PORT` (default 3001), `HOST` (default 0.0.0.0), `ADMIN_PASSWORD` (bootstraps admin user on startup if set).

**Optional env** for Google Calendar sync:

- `GOOGLE_CLIENT_ID` — Google OAuth client ID (enables Google Calendar integration)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `APP_URL` — Base URL of the app (used for OAuth redirect and calendar event links)
