import type { FastifyInstance } from "fastify";
import { requireUser } from "./validation.js";
import { getUserStats, getGroupStats } from "../db/stats.js";
import { getGroup, getUserRoleInGroup } from "../db/index.js";

export async function registerStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/stats", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const stats = await getUserStats(user.id);
    return { stats };
  });

  app.get<{ Params: { id: string } }>("/api/groups/:id/stats", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const group = await getGroup(req.params.id);
    if (!group) return reply.code(404).send({ error: "group not found" });
    const role = await getUserRoleInGroup(group.id, user.id);
    if (!role) return reply.code(403).send({ error: "you must be a member of this group" });
    const stats = await getGroupStats(group.id);
    return { stats };
  });
}
