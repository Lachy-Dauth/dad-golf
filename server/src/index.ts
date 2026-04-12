import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { registerRoutes } from "./routes/index.js";
import { registerWebsocket } from "./ws.js";
import { initDb, closeDb } from "./db/index.js";
import { seedIfEmpty, bootstrapAdmin } from "./seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  await initDb();
  await seedIfEmpty(app.log);
  await bootstrapAdmin(app.log);

  app.addHook("onClose", async () => {
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
