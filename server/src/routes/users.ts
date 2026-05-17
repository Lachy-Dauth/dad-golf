import type { FastifyInstance } from "fastify";
import { getUserByUsername, getUserGroupIds, rowToUser } from "../db/users.js";
import { listUserBadges } from "../db/badges.js";
import { listUserCompletedRounds } from "../db/rounds.js";
import { requireUser } from "./validation.js";

/** Check if viewer shares at least one group with the target user. */
async function sharesGroup(viewerId: string, targetId: string): Promise<boolean> {
  if (viewerId === targetId) return true;
  const viewerGroups = await getUserGroupIds(viewerId);
  if (viewerGroups.length === 0) return false;
  const targetGroups = await getUserGroupIds(targetId);
  return viewerGroups.some((g) => targetGroups.includes(g));
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { username: string } }>("/api/users/:username/profile", async (req, reply) => {
    const viewer = await requireUser(req, reply);
    if (!viewer) return;
    const userRow = await getUserByUsername(req.params.username);
    if (!userRow) return reply.code(404).send({ error: "user not found" });
    const user = rowToUser(userRow);
    if (!(await sharesGroup(viewer.id, user.id))) {
      return reply.code(403).send({ error: "You must share a group with this user" });
    }
    const badges = await listUserBadges(user.id);
    const { rounds, total } = await listUserCompletedRounds(user.id, viewer.id, 5, 0);
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
  });

  app.get<{ Params: { username: string } }>("/api/users/:username/badges", async (req, reply) => {
    const viewer = await requireUser(req, reply);
    if (!viewer) return;
    const userRow = await getUserByUsername(req.params.username);
    if (!userRow) return reply.code(404).send({ error: "user not found" });
    const user = rowToUser(userRow);
    if (!(await sharesGroup(viewer.id, user.id))) {
      return reply.code(403).send({ error: "You must share a group with this user" });
    }
    const badges = await listUserBadges(user.id);
    return { badges };
  });
}
