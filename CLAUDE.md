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

# Tests (Node built-in test runner, all packages)
npm test                            # run all workspace tests
npm run test --workspace=shared     # shared only
npm run test --workspace=server     # server only
npm run test --workspace=client     # client only

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

Exports types, Stableford scoring logic, handicap calculation (GA/WHS), badge definitions, and room code utilities. Both server and client depend on it. ESM-only, outputs `.d.ts` declarations. Must be built before server or client.

### Server (`@dad-golf/server`)

Fastify 5 + `@fastify/websocket`. Raw SQL against PostgreSQL via `pg` (no ORM). Each domain has a `db/*.ts` module (query functions) and a `routes/*.ts` module (HTTP endpoints). Security middleware: `@fastify/helmet`, `@fastify/rate-limit` (100/min), `@fastify/cors`.

**Route registration pattern**: each file exports `registerXxxRoutes(app: FastifyInstance)`, all called from `routes/index.ts`. Routes use Fastify generics for typing: `app.post<{ Body: {...}; Params: {...} }>("/path", handler)`.

**Auth**: scrypt password hashing, random hex session tokens stored in `sessions` table. Bearer token in `Authorization` header. Helpers in `routes/validation.ts`: `getViewerUser(req)` (optional), `requireUser(req, reply)`, `requireAdmin(req, reply)`.

**Real-time updates**: WebSocket pub/sub via `hub.ts` (`Map<roomCode, Set<WebSocket>>`). Clients connect to `/ws/:code?token=...`. After any mutation (score, join, start), the route rebuilds full `RoundState` via `roundState.ts` and broadcasts to all sockets in the room. Client uses `useRoundSocket.ts` hook which auto-reconnects and updates React state.

**Calendar integration**: `calendar.ts` generates RFC 5545 `.ics` files, `calendarSync.ts` syncs RSVPs to Google Calendar (fire-and-forget), and `googleCalendar.ts` wraps the Google Calendar API. Calendar feed routes serve a subscribable iCal URL per user.

**Stats**: `routes/stats.ts` serves personal stats, group stats, and head-to-head comparisons. Heavy aggregation queries live in `db/stats.ts`. Shared SQL helpers in `db/helpers.ts`.

**Round completion**: `roundCompletion.ts` orchestrates post-round side effects — badge evaluation via `badgeEvaluator.ts`, activity event logging, and handicap auto-adjustment.

**Location & weather**: `weather.ts` provides Open-Meteo weather lookups and Nominatim (OpenStreetMap) geocoding for course locations. Courses store optional `latitude`, `longitude`, and `location` fields.

**Production serving**: if `client/dist/` exists, Fastify serves it as static files with SPA fallback (non-API 404s → `index.html`).

### Client (`@dad-golf/client`)

React 18 + Vite + TypeScript. Mobile-first. Vite proxies `/api` → `http://localhost:3001` and `/ws` → `ws://localhost:3001` in dev.

Auth state in `AuthContext.tsx` (token in localStorage key `"sf:token"`). Theme toggle in `ThemeContext.tsx`.

### Database

Raw parameterized SQL (`pool.query(sql, [params])`). Schema auto-created via `initDb()` in `db/schema.ts` (CREATE IF NOT EXISTS). Course holes stored as JSON text column. Booleans are INTEGER 0/1.

## Testing

- **Runner**: Node built-in test runner (`node:test`) with `tsx` for TypeScript
- **Assertions**: `node:assert/strict`
- **Location**: co-located next to source (`module.test.ts`)
- **Pattern**: flat `test()` calls, no nested `describe` blocks
- **Imports**: use `.js` extension in test imports (ESM resolution)
- **New features**: every new pure function or utility must include a `.test.ts` file with tests covering happy paths, edge cases, and error paths
- **What to test**: pure functions, validators, data transformations. DB/HTTP/DOM-dependent code is excluded from unit tests.

## Code Style

- **TypeScript**: strict mode, `noUnusedLocals`, `noUnusedParameters` (prefix unused with `_`)
- **Prettier**: 100 char line width, trailing commas
- **ESLint 9**: flat config, TypeScript recommended + React hooks for client
- **Error responses**: `reply.code(status).send({ error: "message" })`

## Maintenance

When adding or removing features, update `README.md` to reflect the change. Keep `docs/roadmap.md` and `docs/features-brainstorm.md` in sync with shipped status.

## Deployment

Railway with Nixpacks (Node.js 22). Health check at `GET /api/health`. Config in `railway.json` and `nixpacks.toml`.

**Required env**: `DATABASE_URL` (PostgreSQL connection string). Optional: `PORT` (default 3001), `HOST` (default 0.0.0.0), `ADMIN_PASSWORD` (bootstraps admin user on startup if set).

**Optional env** for Google Calendar sync:

- `GOOGLE_CLIENT_ID` — Google OAuth client ID (enables Google Calendar integration)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `APP_URL` — Base URL of the app (used for OAuth redirect and calendar event links)
