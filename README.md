# Dad Golf

A real-time, multi-player Stableford scoring app for casual golf rounds. Up to 10 players join a round from their phones, enter scores hole-by-hole, and watch a live leaderboard update as the round progresses.

## What it does

- **Set up a round** — one player creates a round and picks (or builds) a course
- **Players join** — up to 10 players join via a short room code or shareable link, each entering their name and handicap
- **Score on your phone** — every player enters their own scores for each hole on their own device
- **Stableford scoring** — points are calculated automatically using the player's handicap and the course's stroke index
- **Live leaderboard** — everyone sees the standings update in real time as scores come in

## Stableford scoring (the rules we follow)

Stableford gives points per hole based on net score (gross score minus handicap strokes received on that hole):

| Net score vs. par   | Points |
| ------------------- | ------ |
| Albatross (-3)      | 5      |
| Eagle (-2)          | 4      |
| Birdie (-1)         | 3      |
| Par                 | 2      |
| Bogey (+1)          | 1      |
| Double bogey worse  | 0      |

**Handicap strokes received:**
A player with handicap *H* receives strokes on the hardest holes first (by stroke index). If `H >= 18`, they get one stroke on every hole, plus an additional stroke on holes with stroke index `<= H - 18`, and so on.

## Course data

A course needs: name, 18 holes (or 9), and for each hole: par + stroke index.

You can add a course in two ways:

1. **Search the web** — fetch course details from a public source (see plan.md for the data source decision)
2. **Manual entry** — type in par and stroke index for each hole. Saved courses are reusable for future rounds

## Architecture at a glance

```
┌──────────────┐         ┌─────────────────┐         ┌──────────────┐
│  Phone (P1)  │◄───────►│                 │◄───────►│  Phone (P2)  │
└──────────────┘         │                 │         └──────────────┘
┌──────────────┐         │   Server        │         ┌──────────────┐
│  Phone (P3)  │◄───────►│   (WebSocket    │◄───────►│  Phone (P4)  │
└──────────────┘         │    + REST)      │         └──────────────┘
       ...               │                 │                ...
┌──────────────┐         │                 │         ┌──────────────┐
│  Phone (P10) │◄───────►│                 │◄───────►│  Leaderboard │
└──────────────┘         └────────┬────────┘         └──────────────┘
                                  │
                                  ▼
                          ┌──────────────┐
                          │   Database   │
                          │ (rounds,     │
                          │  courses,    │
                          │  scores)     │
                          └──────────────┘
```

- **Frontend** — mobile-first web app (no install required, just open a link)
- **Backend** — REST for setup actions + WebSocket for live score broadcasting
- **State** — server is the single source of truth; clients subscribe to round updates
- **Rooms** — each round has a short code (e.g. `GOLF-7K2P`) so players can join from any device

## Tech stack (proposed)

See `plan.md` for the rationale. Short version:

- **Frontend:** React + Vite + TypeScript, mobile-first responsive layout
- **Backend:** Node.js + Fastify + WebSockets (`ws` or Socket.IO)
- **Database:** SQLite for simplicity (single file, easy hosting), can swap to Postgres later
- **Hosting:** A single small VM or a platform like Fly.io / Railway

## Key user flows

### Creating a round
1. Open the app → tap "New round"
2. Pick a course (search or pick from saved courses, or add a new one)
3. Get a room code + share link
4. Other players use the link → enter name + handicap → join
5. Host taps "Start round" once everyone's in

### Scoring a hole
1. On the current hole's screen, each player taps their gross score
2. App calculates net score and Stableford points using their handicap and the hole's stroke index
3. Score is sent to the server → broadcast to everyone → leaderboard updates

### Watching the leaderboard
- Open at any time during the round
- Sorted by total Stableford points (highest first)
- Shows: name, handicap, holes played, total points, points back from leader

## Project status

Pre-implementation. See `plan.md` for the detailed build plan.

## Getting started

Once implemented:

```bash
# clone
git clone https://github.com/Lachy-Dauth/dad-golf.git
cd dad-golf

# install
npm install

# run dev
npm run dev
```

(These commands will work after the project is scaffolded — see `plan.md` Phase 1.)

## License

MIT
