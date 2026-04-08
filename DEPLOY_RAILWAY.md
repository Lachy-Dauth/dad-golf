# Deploying Dad Golf on Railway

Dad Golf runs as a single Node service: one Fastify process that serves the
REST API, the WebSocket endpoint, and the built React client from the same
port. SQLite is stored in a single file on disk, so Railway deployment needs
exactly two things beyond a default Node service:

1. Node 20 or newer with a native build toolchain (for `better-sqlite3`).
2. A persistent volume mounted to hold the SQLite file so rounds survive
   restarts and redeploys.

Everything else is already wired up in this repo via `railway.json` and
`nixpacks.toml`.

---

## 1. Push the repo to GitHub

Railway deploys from GitHub. If you haven't already:

```bash
git remote add origin git@github.com:your-user/dad-golf.git
git push -u origin main
```

---

## 2. Create the Railway project

1. Go to [railway.com/new](https://railway.com/new) and pick
   **Deploy from GitHub repo**.
2. Select your `dad-golf` repo.
3. Railway will auto-detect a Node project and start the first build. The
   included `railway.json` tells Railway to:
   - build with `npm ci && npm run build`
   - start with `npm run start`
   - health-check on `GET /api/health`

The first build takes a couple of minutes because `better-sqlite3` has to
compile its native addon. Subsequent builds are cached.

---

## 3. Add a persistent volume for SQLite

SQLite lives in a single file. Without a volume, every redeploy wipes all
courses, groups, rounds and scores.

1. Open the service → **Settings** → **Volumes**.
2. Click **+ New Volume**.
3. Set the mount path to `/data`.
4. Pick any size — 1 GB is massively more than needed; the whole app
   including hundreds of rounds fits in a few MB.

---

## 4. Set environment variables

Open the service → **Variables** and add:

| Variable   | Value   | Why                                                 |
| ---------- | ------- | --------------------------------------------------- |
| `DATA_DIR` | `/data` | Tells the server to put `dad-golf.sqlite` here      |

You do **not** need to set `PORT` — Railway injects it automatically and the
server reads it from `process.env.PORT`.

> **Do not set `NODE_ENV=production` yourself.** Railway sets it for the
> run phase automatically, and the build command uses
> `npm ci --include=dev` so that `typescript` and `vite` are still
> installed during the build even when `NODE_ENV=production` is present.
> Setting it explicitly just adds footgun risk.

---

## 5. Expose it publicly

1. Open the service → **Settings** → **Networking**.
2. Click **Generate Domain** to get a `*.up.railway.app` URL.
3. (Optional) Add a custom domain and point its CNAME at the Railway target.

Railway handles TLS automatically. WebSockets work over the same domain — no
extra configuration needed, the client detects `https:` and upgrades to `wss:`
automatically.

---

## 6. Verify

Hit `https://your-app.up.railway.app/api/health` — you should get:

```json
{ "ok": true }
```

Then open the root URL in a browser. The first time the server boots it
seeds two sample courses so you can immediately create a round and test end
to end.

---

## How the build works

The repo is a single npm workspace with three packages:

```
shared/   Stableford logic and shared TypeScript types
server/   Fastify + better-sqlite3 + @fastify/websocket
client/   React + Vite + React Router
```

`npm run build` at the root runs, in order:

1. `shared` → `tsc` → `shared/dist/*.js`
2. `server` → `tsc` → `server/dist/*.js`
3. `client` → `tsc && vite build` → `client/dist/*`

At runtime, `npm run start` launches `server/dist/index.js`. If
`client/dist/` exists next to it (which it does in production), the server
registers `@fastify/static` to serve the React app and falls back to
`index.html` for any non-API, non-WS route so React Router's client-side
routing works.

The SQLite file path is:

```
${DATA_DIR ?? "./data"}/dad-golf.sqlite
```

WAL mode is enabled, so you get durable writes without blocking readers.

---

## Updating the app

Push to the branch Railway is tracking and it redeploys automatically. Your
volume persists across deploys, so no data is lost.

If you want zero-downtime deploys you can enable them in the service
settings; they work fine here because the server is stateless apart from
the SQLite file, and Railway hands the same volume to the new container
once the old one shuts down.

---

## Troubleshooting

**`Cannot find module 'better-sqlite3'` or native build errors**
The Nixpacks setup phase installs `python3`, `gcc` and `gnumake` so the
native addon can compile. If you swap builders or edit `nixpacks.toml`,
make sure those packages stay in the setup phase.

**Rounds disappear after a redeploy**
You didn't mount the volume, or `DATA_DIR` isn't pointing at it. Check
the service's **Variables** tab and the **Volumes** tab — the mount path
and `DATA_DIR` must match (default: `/data`).

**WebSocket keeps reconnecting**
Make sure the service is using HTTPS (Railway's generated domain is).
Browsers refuse to open a plain `ws://` connection from an `https://`
page. The client auto-picks `wss:` when the page is served over HTTPS,
so this mostly matters only when testing via custom domains without TLS.

**Port binding errors**
The server reads `process.env.PORT`. Don't set it manually — Railway
injects it. If you override it to something the platform isn't routing to,
the health check will fail and the deploy will roll back.
