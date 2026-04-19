import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { registerRoutes } from "./routes/index.js";
import { registerWebsocket } from "./ws.js";
import { initDb, closeDb, deleteExpiredSessions } from "./db/index.js";
import { seedIfEmpty, bootstrapAdmin } from "./seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  // trustProxy: honor X-Forwarded-* headers so req.protocol / req.host / req.ip
  // reflect the external scheme, host, and client IP when behind a TLS-
  // terminating reverse proxy (e.g. Railway). Required for correct absolute
  // URL generation in calendar feed / ICS links when APP_URL is not set.
  const app = Fastify({ logger: true, bodyLimit: 1_048_576, trustProxy: true });

  await app.register(helmet, {
    contentSecurityPolicy: false, // needs nonce/hash for inline theme script
  });

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : [];
  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(websocket);

  await initDb();
  await seedIfEmpty(app.log);
  await bootstrapAdmin(app.log);

  // Clean up expired sessions every 24 hours
  const cleanupTimer = setInterval(
    async () => {
      try {
        const count = await deleteExpiredSessions();
        if (count > 0) app.log.info(`Cleaned up ${count} expired sessions`);
      } catch (err) {
        app.log.error({ err }, "Failed to clean up expired sessions");
      }
    },
    24 * 60 * 60 * 1000,
  );
  cleanupTimer.unref();

  app.addHook("onClose", async () => {
    clearInterval(cleanupTimer);
    await closeDb();
  });

  await registerRoutes(app);
  await registerWebsocket(app);

  // Serve built client if available (production build)
  const clientDist = resolve(__dirname, "../../client/dist");
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: "/",
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws")) {
        return reply.code(404).send({ error: "not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen({ port, host });
  app.log.info(`Server listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
