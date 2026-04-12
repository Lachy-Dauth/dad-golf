import type { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth.js";
import { registerCourseRoutes } from "./courses.js";
import { registerGroupRoutes } from "./groups.js";
import { registerRoundRoutes } from "./rounds.js";
import { registerAdminRoutes } from "./admin.js";
import { registerWeatherRoutes } from "./weather.js";
import { registerHandicapRoutes } from "./handicap.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerCourseRoutes(app);
  await registerGroupRoutes(app);
  await registerRoundRoutes(app);
  await registerAdminRoutes(app);
  await registerWeatherRoutes(app);
  await registerHandicapRoutes(app);
}
