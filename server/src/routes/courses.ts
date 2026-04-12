import type { FastifyInstance } from "fastify";
import {
  createCourse,
  deleteCourse,
  favoriteCourse,
  getCourse,
  getCourseFavoriteCount,
  listCourses,
  unfavoriteCourse,
  updateCourse,
} from "../db/index.js";
import {
  getViewerUser,
  requireUser,
  validateCourseRating,
  validateCourseSlope,
  validateHoles,
  validateName,
} from "./validation.js";

export async function registerCourseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/courses", async (req) => {
    const viewer = await getViewerUser(req);
    return { courses: await listCourses(viewer?.id ?? null) };
  });

  app.get<{ Params: { id: string } }>("/api/courses/:id", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const c = await getCourse(req.params.id, viewer?.id ?? null);
    if (!c) return reply.code(404).send({ error: "course not found" });
    return { course: c };
  });

  app.post<{
    Body: {
      name?: string;
      location?: string;
      rating?: number;
      slope?: number;
      holes?: unknown;
    };
  }>("/api/courses", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const name = validateName(req.body?.name, "course name");
      const location =
        typeof req.body?.location === "string" ? req.body.location.trim() || null : null;
      const rating = validateCourseRating(req.body?.rating);
      const slope = validateCourseSlope(req.body?.slope);
      const holes = validateHoles(req.body?.holes);
      const course = await createCourse(name, location, rating, slope, holes, user.id);
      return reply.code(201).send({ course });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      location?: string;
      rating?: number;
      slope?: number;
      holes?: unknown;
    };
  }>("/api/courses/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const course = await getCourse(req.params.id, user.id);
    if (!course) return reply.code(404).send({ error: "course not found" });
    if (course.createdByUserId !== user.id) {
      return reply.code(403).send({ error: "only the course creator can edit this course" });
    }
    try {
      const name = validateName(req.body?.name, "course name");
      const location =
        typeof req.body?.location === "string" ? req.body.location.trim() || null : null;
      const rating = validateCourseRating(req.body?.rating);
      const slope = validateCourseSlope(req.body?.slope);
      const holes = validateHoles(req.body?.holes);
      await updateCourse(course.id, name, location, rating, slope, holes);
      const updated = await getCourse(course.id, user.id);
      return { course: updated };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/courses/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const course = await getCourse(req.params.id, user.id);
    if (!course) return reply.code(404).send({ error: "course not found" });
    if (course.createdByUserId !== user.id) {
      return reply.code(403).send({ error: "only the course creator can delete this course" });
    }
    const favCount = await getCourseFavoriteCount(course.id);
    if (favCount > 0) {
      return reply.code(400).send({
        error: `course has ${favCount} favorite${favCount === 1 ? "" : "s"} and cannot be deleted`,
      });
    }
    await deleteCourse(course.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/courses/:id/favorite", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const course = await getCourse(req.params.id, user.id);
    if (!course) return reply.code(404).send({ error: "course not found" });
    await favoriteCourse(user.id, course.id);
    return { course: await getCourse(course.id, user.id) };
  });

  app.delete<{ Params: { id: string } }>("/api/courses/:id/favorite", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    await unfavoriteCourse(user.id, req.params.id);
    return { course: await getCourse(req.params.id, user.id) };
  });
}
