import type { FastifyInstance } from "fastify";
import { getUserByUsername, rowToUser } from "../db/users.js";
import { listUserBadges } from "../db/badges.js";
import { listUserCompletedRounds } from "../db/rounds.js";
import { getViewerUser } from "./validation.js";

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { username: string } }>(
    "/api/users/:username/profile",
    async (req, reply) => {
      const viewer = await getViewerUser(req);
      const userRow = await getUserByUsername(req.params.username);
      if (!userRow) return reply.code(404).send({ error: "user not found" });
      const user = rowToUser(userRow);
      const badges = await listUserBadges(user.id);
      const { rounds, total } = await listUserCompletedRounds(
        user.id,
        viewer?.id ?? null,
        5,
        0,
      );
      return {
        profile: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          handicap: user.handicap,
          createdAt: user.createdAt,
          badges,
          recentRounds: rounds,
          totalRounds: total,
        },
      };
    },
  );

  app.get<{ Params: { username: string } }>(
    "/api/users/:username/badges",
    async (req, reply) => {
      const userRow = await getUserByUsername(req.params.username);
      if (!userRow) return reply.code(404).send({ error: "user not found" });
      const badges = await listUserBadges(userRow.id);
      return { badges };
    },
  );
}
