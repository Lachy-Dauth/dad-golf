import type { FastifyInstance } from "fastify";
import { requireUser } from "./validation.js";
import { getUserStats } from "../db/stats.js";

export async function registerStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/stats", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const stats = await getUserStats(user.id);
    return { stats };
  });
}
