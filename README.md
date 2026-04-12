# Dad Golf

A real-time, multi-player Stableford scoring app for casual golf rounds. Up to 10 players join a round from their phones, enter scores hole-by-hole, and watch a live leaderboard update as the round progresses.

**Live app:** https://golf-stableford-production.up.railway.app/

## What it does

- **Set up a round** — one player creates a round and picks (or builds) a course
- **Players join** — up to 10 players join via a short room code or shareable link, each entering their name and handicap
- **Score on your phone** — every player enters their own scores for each hole on their own device
- **Stableford scoring** — points are calculated automatically using the player's handicap and the course's stroke index
- **Live leaderboard** — everyone sees the standings update in real time as scores come in
- **Round replay** — post-round summary with full scorecard, leaderboard progression chart, per-player stats, and competition results; browse past rounds via personal history or group pages
- **Hole competitions** — closest-to-pin and longest drive contests on selected holes
- **Weather** — live weather conditions displayed for the course location
- **Handicap tracker** — track your last 20 rounds and auto-calculate your GA Handicap Index using Australia's World Handicap System; optionally auto-updates when you complete rounds
- **Groups** — create groups, invite members, assign admin/member roles, and track rounds together
- **Schedule rounds** — group admins schedule upcoming rounds (date, time, course); members RSVP (going/maybe/can't); admins start the round and accepted players are added automatically; dedicated Upcoming Rounds page shows all scheduled rounds across groups
- **Calendar integration** — export scheduled rounds to .ics (Apple Calendar), Google Calendar (web link), or Outlook; optional Google Calendar OAuth sync automatically creates/updates/deletes events when you RSVP; subscribable iCal feed URL for auto-sync in any calendar app (Apple Calendar, Google Calendar, Outlook)
- **Admin dashboard** — view stats, manage users, and monitor activity
- **Dark / light mode** — theme toggle that respects your preference
- **PWA support** — install the app to your home screen for a native feel

## Stableford scoring (the rules we follow)

Stableford gives points per hole based on net score (gross score minus handicap strokes received on that hole):

| Net score vs. par  | Points |
| ------------------ | ------ |
| Albatross (-3)     | 5      |
| Eagle (-2)         | 4      |
| Birdie (-1)        | 3      |
| Par                | 2      |
| Bogey (+1)         | 1      |
| Double bogey worse | 0      |

**Handicap strokes received:**
A player with handicap _H_ receives strokes on the hardest holes first (by stroke index). If `H >= 18`, they get one stroke on every hole, plus an additional stroke on holes with stroke index `<= H - 18`, and so on.

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript, mobile-first responsive layout
- **Backend:** Node.js + Fastify + WebSocket (`@fastify/websocket`)
- **Database:** PostgreSQL (production) / SQLite (local development)
- **Shared:** `@dad-golf/shared` package with types, Stableford scoring logic, and room code generation
- **Tooling:** ESLint 9 (flat config) + Prettier + strict TypeScript
- **Hosting:** Railway

## Project structure

```
dad-golf/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── pages/           # Route pages (Home, Round, Courses, Groups, Admin, …)
│       ├── components/      # Round sub-views (Lobby, Scoring, Leaderboard, Replay, Scorecard, Weather)
│       ├── AuthContext.tsx   # Session & user state
│       └── ThemeContext.tsx  # Dark / light mode
├── server/                  # Fastify backend
│   └── src/
│       ├── db/              # Database layer (pool, schema, per-domain modules)
│       │   ├── users.ts     # User CRUD, auth, sessions
│       │   ├── courses.ts   # Course CRUD + favourites
│       │   ├── groups.ts    # Groups, members, invites
│       │   ├── rounds.ts    # Round lifecycle
│       │   ├── players.ts   # Player management
│       │   ├── scores.ts    # Score tracking
│       │   ├── competitions.ts # Hole competitions (CTP, longest drive)
│       │   ├── handicapRounds.ts # Handicap round history
│       │   ├── scheduledRounds.ts # Scheduled rounds + RSVPs
│       │   ├── googleCalendar.ts # Google Calendar OAuth connections
│       │   ├── calendarFeed.ts # Calendar feed token management
│       │   └── admin.ts     # Admin queries + stats
│       ├── routes/          # REST API routes (per-domain modules)
│       │   ├── auth.ts      # /api/auth/*
│       │   ├── courses.ts   # /api/courses/*
│       │   ├── groups.ts    # /api/groups/*
│       │   ├── rounds.ts    # /api/rounds/*
│       │   ├── weather.ts   # /api/weather/*
│       │   ├── handicap.ts  # /api/handicap/*
│       │   ├── scheduledRounds.ts # /api/groups/:groupId/scheduled-rounds/*
│       │   ├── googleCalendar.ts # /api/google-calendar/* (OAuth + sync settings)
│       │   ├── calendarFeed.ts # /api/calendar-feed/* (iCal feed subscription)
│       │   └── admin.ts     # /api/admin/*
│       ├── calendar.ts      # iCalendar (.ics) generation
│       ├── calendarSync.ts  # Google Calendar sync logic (fire-and-forget)
│       ├── googleCalendar.ts # Google Calendar API client (raw fetch)
│       ├── hub.ts           # WebSocket pub/sub hub
│       ├── ws.ts            # WebSocket handler for live round updates
│       └── seed.ts          # Sample data seeding
├── shared/                  # Shared types, scoring logic, room codes
├── tsconfig.base.json       # Shared TypeScript config (strict, noUnused*)
├── eslint.config.mjs        # ESLint 9 flat config
└── prettier.config.mjs      # Prettier config
```

## Getting started

```bash
# clone
git clone https://github.com/Lachy-Dauth/dad-golf.git
cd dad-golf

# install (auto-builds the shared package)
npm install

# run in dev (server on :3001, client on :5173)
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/ws` to
the backend on `:3001`. Two sample courses are seeded on first run, so you
can create a round immediately.

### Environment variables

| Variable               | Default   | Description                                               |
| ---------------------- | --------- | --------------------------------------------------------- |
| `PORT`                 | `3001`    | Server port                                               |
| `HOST`                 | `0.0.0.0` | Server bind address                                       |
| `DATABASE_URL`         | —         | PostgreSQL connection string                              |
| `ADMIN_USER`           | —         | Username to bootstrap as admin                            |
| `GOOGLE_CLIENT_ID`     | —         | Google OAuth client ID (enables Google Calendar sync)     |
| `GOOGLE_CLIENT_SECRET` | —         | Google OAuth client secret                                |
| `APP_URL`              | —         | Base URL of the app (for OAuth redirect + calendar links) |

### Production build

```bash
npm run build    # builds shared, server, and client
npm run start    # starts the Fastify server (serves the built client too)
```

In production the server serves `client/dist/*` on the same port as the API.

### Code quality

```bash
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format:check   # Prettier check
npm run format         # Prettier auto-format
npm test               # Stableford scoring unit tests
```

### Deploying to Railway

Connect the repo, add a Postgres plugin, set `DATABASE_URL`, generate a
domain. The included `railway.json` and `nixpacks.toml` handle the rest.

### How to use

Every page in the app links to a built-in guide at `/help`, or you can
tap the **?** in the top-right of any screen.

## License

MIT
