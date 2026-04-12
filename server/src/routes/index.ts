import type { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth.js";
import { registerCourseRoutes } from "./courses.js";
import { registerGroupRoutes } from "./groups.js";
import { registerRoundRoutes } from "./rounds.js";
import { registerAdminRoutes } from "./admin.js";
import { registerScheduledRoundRoutes } from "./scheduledRounds.js";
import { registerWeatherRoutes } from "./weather.js";
import { registerHandicapRoutes } from "./handicap.js";
import { registerGoogleCalendarRoutes } from "./googleCalendar.js";
import { registerCalendarFeedRoutes } from "./calendarFeed.js";
import { registerActivityRoutes } from "./activity.js";
import { registerUserRoutes } from "./users.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerCourseRoutes(app);
  await registerGroupRoutes(app);
  await registerRoundRoutes(app);
  await registerAdminRoutes(app);
  await registerScheduledRoundRoutes(app);
  await registerWeatherRoutes(app);
  await registerHandicapRoutes(app);
  await registerGoogleCalendarRoutes(app);
  await registerCalendarFeedRoutes(app);
  await registerActivityRoutes(app);
  await registerUserRoutes(app);
}
