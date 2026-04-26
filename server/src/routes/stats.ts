import type { FastifyInstance } from "fastify";
import { requireUser } from "./validation.js";
import {
  getUserStats,
  getGroupStats,
  getOpponents,
  getHeadToHead,
  getGroup,
  getUserRoleInGroup,
  getUserGroupIds,
} from "../db/index.js";
import { pool } from "../db/pool.js";

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

  // Head-to-head: list opponents
  app.get("/api/stats/h2h/opponents", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const opponents = await getOpponents(user.id);
    return { opponents };
  });

  // Head-to-head: compare with a specific opponent
  app.get<{ Params: { opponentId: string } }>("/api/stats/h2h/:opponentId", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { opponentId } = req.params;
    // Look up opponent display name
    const { rows } = await pool.query("SELECT id, display_name FROM users WHERE id = $1", [
      opponentId,
    ]);
    if (rows.length === 0) return reply.code(404).send({ error: "user not found" });
    const opponent = rows[0] as { id: string; display_name: string };
    // Verify the users share at least one group
    if (user.id !== opponent.id) {
      const userGroups = await getUserGroupIds(user.id);
      const opponentGroups = await getUserGroupIds(opponent.id);
      if (!userGroups.some((g) => opponentGroups.includes(g))) {
        return reply.code(403).send({ error: "you must share a group with this user" });
      }
    }
    const result = await getHeadToHead(
      user.id,
      user.displayName,
      opponent.id,
      opponent.display_name,
    );
    return { stats: result };
  });
}
