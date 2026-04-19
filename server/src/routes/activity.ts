import type { FastifyInstance } from "fastify";
import {
  getActivityFeedForUser,
  likeActivityEvent,
  unlikeActivityEvent,
  getActivityComments,
  addActivityComment,
  canUserSeeEvent,
} from "../db/activity.js";
import { requireUser, parsePagination } from "./validation.js";

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/api/activity",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const { limit, offset } = parsePagination(req.query);
      return getActivityFeedForUser(user.id, limit, offset);
    },
  );

  app.post<{ Params: { id: string } }>("/api/activity/:id/like", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (!(await canUserSeeEvent(req.params.id, user.id))) {
      return reply.code(404).send({ error: "event not found" });
    }
    await likeActivityEvent(req.params.id, user.id);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/api/activity/:id/like", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (!(await canUserSeeEvent(req.params.id, user.id))) {
      return reply.code(404).send({ error: "event not found" });
    }
    await unlikeActivityEvent(req.params.id, user.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/activity/:id/comments", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (!(await canUserSeeEvent(req.params.id, user.id))) {
      return reply.code(404).send({ error: "event not found" });
    }
    const comments = await getActivityComments(req.params.id);
    return { comments };
  });

  app.post<{ Params: { id: string }; Body: { text?: string } }>(
    "/api/activity/:id/comments",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      if (!(await canUserSeeEvent(req.params.id, user.id))) {
        return reply.code(404).send({ error: "event not found" });
      }
      const text = String(req.body?.text ?? "").trim();
      if (!text || text.length > 500) {
        return reply.code(400).send({ error: "comment text must be 1-500 characters" });
      }
      const comment = await addActivityComment(req.params.id, user.id, text);
      return reply.code(201).send({ comment });
    },
  );
}
