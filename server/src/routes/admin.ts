import type { FastifyInstance } from "fastify";
import {
  deleteUserAsAdmin,
  getActivityFeed,
  getAdminStats,
  getUser,
  listAllCourses,
  listAllGroups,
  listAllRounds,
  listAllUsers,
} from "../db/index.js";
import { requireAdmin } from "./validation.js";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/admin/stats", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return await getAdminStats();
  });

  app.get("/api/admin/users", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return { users: await listAllUsers() };
  });

  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    if (req.params.id === user.id) {
      return reply.code(400).send({ error: "cannot delete yourself" });
    }
    const target = await getUser(req.params.id);
    if (!target) {
      return reply.code(404).send({ error: "user not found" });
    }
    await deleteUserAsAdmin(req.params.id);
    return { ok: true };
  });

  app.get<{
    Querystring: { limit?: string; offset?: string };
  }>("/api/admin/rounds", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    const parsedLimit = Number(req.query.limit);
    const parsedOffset = Number(req.query.offset);
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(0, Math.min(Math.floor(parsedLimit), 200))
      : 50;
    const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0;
    return await listAllRounds(limit, offset);
  });

  app.get("/api/admin/courses", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return { courses: await listAllCourses() };
  });

  app.get("/api/admin/groups", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    return { groups: await listAllGroups() };
  });

  app.get<{
    Querystring: { limit?: string };
  }>("/api/admin/activity", async (req, reply) => {
    const user = await requireAdmin(req, reply);
    if (!user) return;
    const parsed = Number(req.query.limit);
    const limit = Number.isFinite(parsed) ? Math.max(0, Math.min(Math.floor(parsed), 200)) : 50;
    return { events: await getActivityFeed(limit) };
  });
}
