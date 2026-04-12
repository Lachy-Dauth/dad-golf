# Implementation Plan — Dad Golf

This is the build plan for the Stableford scoring app described in `README.md`. It's organized into phases so the app is usable as early as possible, then layered with polish and the harder bits (course search, real-time sync) once the core flow works end-to-end.

---

## Decisions to lock in before coding

A few choices need a definitive answer before scaffolding starts. Defaults are listed but should be confirmed:

| Decision            | Default                           | Notes                                                                                        |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| Frontend framework  | React + Vite + TypeScript         | Mobile-first, no native app needed. Vite gives fast dev loop                                 |
| Backend runtime     | Node.js + Fastify                 | Same language as frontend → fewer context switches. Fastify is light and has good WS support |
| Real-time transport | WebSockets via `ws` (raw)         | Simple broadcast pattern; Socket.IO if we need rooms/reconnect helpers                       |
| Database            | SQLite (via `better-sqlite3`)     | Single file, zero-ops, fine for ≤10 concurrent players per round                             |
| Auth model          | None — room code only             | Casual rounds. Knowing the code = being in the round                                         |
| Hosting target      | Fly.io or Railway                 | Both support persistent volumes for SQLite + WebSockets out of the box                       |
| Course data source  | **Open question** — see Phase 4   | No clean free API exists. Likely: manual entry first, scraped/seeded list of common courses  |
| State on disconnect | Resume by room code + player name | If a phone dies mid-round, rejoining restores their scorecard                                |

---

## Data model

### `course`

- `id` (uuid)
- `name` (string)
- `location` (string, optional)
- `holes` (json: array of `{ number, par, stroke_index }`)
- `created_at`

### `round`

- `id` (uuid)
- `room_code` (short string, e.g. `GOLF-7K2P`)
- `course_id` (fk → course)
- `status` (`waiting` | `in_progress` | `complete`)
- `created_at`
- `started_at` (nullable)

### `player`

- `id` (uuid)
- `round_id` (fk → round)
- `name` (string)
- `handicap` (int, 0–54)
- `joined_at`

### `score`

- `id` (uuid)
- `round_id` (fk → round)
- `player_id` (fk → player)
- `hole_number` (int, 1–18)
- `strokes` (int)
- `created_at`
- _unique constraint:_ `(player_id, hole_number)` — one score per player per hole, updates overwrite

Stableford points and net scores are **derived**, not stored. They're computed from `score.strokes`, `player.handicap`, and `course.holes[].stroke_index`. Computing on read keeps the source of truth simple and means rule changes don't require migrations.

---

## Stableford calculation (the one piece of real logic)

```
strokes_received(handicap, stroke_index):
    base = floor(handicap / 18)
    extra = 1 if (handicap mod 18) >= stroke_index else 0
    return base + extra

net_score = strokes - strokes_received(handicap, stroke_index)

points:
    diff = net_score - par
    if diff <= -3: return 5
    if diff == -2: return 4
    if diff == -1: return 3
    if diff ==  0: return 2
    if diff == +1: return 1
    return 0
```

This lives in a single shared module (used by both server, for the leaderboard endpoint, and client, for instant local feedback before the server confirms).

---

## Phase 1 — Project scaffolding

**Goal:** repo runs locally with a hello-world client + server.

- [ ] `npm init` with workspaces (`/client`, `/server`, `/shared`)
- [ ] Vite + React + TS in `/client`
- [ ] Fastify + TS in `/server`
- [ ] Shared `/shared` package for types + the Stableford function
- [ ] ESLint + Prettier + tsconfig base
- [ ] `npm run dev` starts both client and server with hot reload
- [ ] `.gitignore`, basic README pointers

**Done when:** opening `localhost:5173` shows a page that fetches a `GET /health` from the server.

---

## Phase 2 — Core data + offline scoring

**Goal:** one player can run a full round on a single device with hardcoded course data. No multiplayer yet.

- [ ] SQLite setup with schema migration runner
- [ ] CRUD for `course`, `round`, `player`, `score`
- [ ] Seed one or two real courses for testing
- [ ] **Stableford calculation module + unit tests** — this is the bit that has to be exactly right; cover edge cases (handicap 0, 18, 27, 36+, par 3/4/5, all stroke index positions)
- [ ] Round creation flow (pick course, add players manually)
- [ ] Hole-by-hole scoring screen
- [ ] Leaderboard component (computed on the fly from scores)

**Done when:** you can create a round, add 4 fake players, enter scores for 18 holes, and see a correct leaderboard.

---

## Phase 3 — Multiplayer over the network

**Goal:** multiple phones, one round, scores sync live.

- [ ] Room code generation (short, readable, no ambiguous chars: avoid `0/O`, `1/I/L`)
- [ ] Join-by-code flow + share link (`?room=GOLF-7K2P`)
- [ ] WebSocket server: clients subscribe to a `round_id` channel
- [ ] On score submit → server validates → writes to DB → broadcasts to channel
- [ ] Client reconciles incoming scores into local state
- [ ] Reconnect handling: on connect, fetch full round state, then subscribe
- [ ] "Player is on hole X" presence indicator (nice-to-have)
- [ ] Mobile-first CSS pass — large tap targets, single-column, no horizontal scroll

**Done when:** four phones can join one room and the leaderboard updates in real time as each player taps in scores.

---

## Phase 4 — Course management

**Goal:** users can add new courses without a developer touching the database.

### Manual entry (must-have)

- [ ] "Add new course" form: name, location, 9 or 18 holes
- [ ] Per-hole row: par (3/4/5) + stroke index (1–18, must be unique)
- [ ] Validation: stroke indexes form a complete set, pars are sane
- [ ] Saved courses are picked from a dropdown when creating a round

### Web fetch (open question — investigate before building)

There's no obviously clean free public API for course data with stroke indexes. Options to evaluate:

1. **USGA / R&A APIs** — gated, require partnership
2. **GolfNow / Golf Now / 18Birdies scrape** — terms-of-service risk
3. **OpenStreetMap** — has course names + locations but no par/stroke index data
4. **Wikipedia** — sometimes has course detail pages with hole-by-hole info, inconsistent format
5. **Crowd-sourced static dataset** — bundle a JSON list of common courses, accept PRs

**Recommendation:** ship Phase 4 with manual entry only. Add a "Search courses" tab in Phase 5 backed by a small bundled dataset (option 5) plus the ability to clone-and-edit a course as a starting point. Revisit a real API later if a clean source is found.

**Done when:** a user can add a brand new course on the fly during round setup and use it immediately.

---

## Phase 5 — Polish

- [ ] Empty states + loading states everywhere
- [ ] Score confirmation step (prevent fat-finger 8 → 18)
- [ ] Edit / undo a previously entered hole
- [ ] End-of-round summary screen (winner, points per player, best hole, worst hole)
- [ ] Round history (list of past rounds for a device, by local storage)
- [ ] Toast / sound when leaderboard position changes (optional, opt-in)
- [ ] PWA manifest so it can be added to home screen
- [ ] Bundled course dataset (Phase 4 follow-up)
- [ ] Accessibility pass (large text, contrast, keyboard nav for the desktop case)

---

## Phase 6 — Deploy

- [ ] Pick host (Fly.io vs Railway — both fine)
- [ ] Persistent volume for SQLite
- [ ] Custom domain (optional)
- [ ] HTTPS (handled by host)
- [ ] Basic monitoring: uptime ping + error log access
- [ ] Smoke test: create a round on a laptop, join from a phone over real internet

---

## Open questions

These don't block Phase 1–3 but need answers before Phase 4–6:

1. **Course data source.** See Phase 4. Manual entry is the safe path.
2. **Handicap range and format.** Whole numbers 0–54? Decimals (0.0–54.0, rounded for stroke allocation)? Default to whole numbers — simpler UI, fine for casual rounds.
3. **9-hole rounds.** Support them, or 18 only? Easier to start with 18; revisit if it's a real need.
4. **Persistence beyond a round.** Do we keep rounds forever, or auto-delete after N days? Default: keep forever, it's tiny data.
5. **Multi-device for one player.** Can a player score from two phones at once? Default: no, name-in-room is unique.
6. **Tie-breaking on the leaderboard.** Standard is "back nine total" then "back six, three, last hole." Implement the standard tie-break in Phase 5.

---

## Testing strategy

- **Unit tests:** Stableford module — exhaustive, this is the only logic that _must_ be perfect
- **Integration tests:** API endpoints (create round, add player, submit score, fetch leaderboard)
- **Manual testing:** real four-phone test on a real round before declaring Phase 3 done
- **No E2E browser tests** unless something specific keeps breaking — overkill for the size of this app
