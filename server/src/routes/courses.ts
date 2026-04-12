import type { FastifyInstance } from "fastify";
import type { CourseReview } from "@dad-golf/shared";
import {
  createCourse,
  createCourseReport,
  deleteCourse,
  deleteCourseReview,
  favoriteCourse,
  getCourse,
  getCourseRoundCount,
  getUserCourseReview,
  listCourseReviews,
  listCourses,
  unfavoriteCourse,
  updateCourse,
  updateCourseCoords,
  upsertCourseReview,
} from "../db/index.js";
import {
  getViewerUser,
  requireUser,
  validateCourseRating,
  validateCourseSlope,
  validateHoles,
  validateName,
  validateReportReason,
  validateReviewText,
  validateStarRating,
} from "./validation.js";
import { fetchWeather, geocodeLocation, searchLocations } from "../weather.js";

export async function registerCourseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/courses", async (req) => {
    const viewer = await getViewerUser(req);
    return { courses: await listCourses(viewer?.id ?? null) };
  });

  app.get<{ Params: { id: string } }>("/api/courses/:id", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const c = await getCourse(req.params.id, viewer?.id ?? null);
    if (!c) return reply.code(404).send({ error: "course not found" });
    let viewerReview: CourseReview | null = null;
    if (viewer) {
      viewerReview = await getUserCourseReview(c.id, viewer.id);
    }
    return { course: c, viewerReview };
  });

  app.get<{ Querystring: { q?: string } }>("/api/locations/search", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const query = req.query.q?.trim();
    if (!query || query.length < 2) {
      return reply.code(400).send({ error: "q parameter must be at least 2 characters" });
    }
    try {
      const locations = await searchLocations(query);
      return { locations };
    } catch {
      return reply.code(502).send({ error: "geocoding service unavailable" });
    }
  });

  app.post<{
    Body: {
      name?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
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
      let latitude: number | null = null;
      let longitude: number | null = null;
      const bodyLat = req.body?.latitude;
      const bodyLng = req.body?.longitude;
      if (
        typeof bodyLat === "number" &&
        typeof bodyLng === "number" &&
        Number.isFinite(bodyLat) &&
        Number.isFinite(bodyLng)
      ) {
        if (bodyLat < -90 || bodyLat > 90 || bodyLng < -180 || bodyLng > 180) {
          return reply.code(400).send({ error: "invalid coordinates" });
        }
        latitude = bodyLat;
        longitude = bodyLng;
      } else if (location) {
        let geo: Awaited<ReturnType<typeof geocodeLocation>>;
        try {
          geo = await geocodeLocation(location);
        } catch {
          return reply
            .code(503)
            .send({ error: "could not verify location at this time — please try again later" });
        }
        if (!geo) {
          return reply.code(400).send({
            error: "could not verify location — please enter a valid place name or address",
          });
        }
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
      const course = await createCourse(
        name,
        location,
        rating,
        slope,
        holes,
        user.id,
        latitude,
        longitude,
      );
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
      latitude?: number;
      longitude?: number;
      rating?: number;
      slope?: number;
      holes?: unknown;
    };
  }>("/api/courses/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const course = await getCourse(req.params.id, user.id);
    if (!course) return reply.code(404).send({ error: "course not found" });
    if (course.createdByUserId !== user.id && !user.isAdmin) {
      return reply.code(403).send({ error: "only the course creator can edit this course" });
    }
    try {
      const name = validateName(req.body?.name, "course name");
      const location =
        typeof req.body?.location === "string" ? req.body.location.trim() || null : null;
      const rating = validateCourseRating(req.body?.rating);
      const slope = validateCourseSlope(req.body?.slope);
      const holes = validateHoles(req.body?.holes);
      let latitude: number | null = null;
      let longitude: number | null = null;
      const bodyLat = req.body?.latitude;
      const bodyLng = req.body?.longitude;
      if (
        typeof bodyLat === "number" &&
        typeof bodyLng === "number" &&
        Number.isFinite(bodyLat) &&
        Number.isFinite(bodyLng)
      ) {
        if (bodyLat < -90 || bodyLat > 90 || bodyLng < -180 || bodyLng > 180) {
          return reply.code(400).send({ error: "invalid coordinates" });
        }
        latitude = bodyLat;
        longitude = bodyLng;
      } else if (location) {
        let geo: Awaited<ReturnType<typeof geocodeLocation>>;
        try {
          geo = await geocodeLocation(location);
        } catch {
          return reply
            .code(503)
            .send({ error: "could not verify location at this time — please try again later" });
        }
        if (!geo) {
          return reply.code(400).send({
            error: "could not verify location — please enter a valid place name or address",
          });
        }
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
      await updateCourse(course.id, name, location, rating, slope, holes, latitude, longitude);
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
    if (course.createdByUserId !== user.id && !user.isAdmin) {
      return reply.code(403).send({ error: "only the course creator can delete this course" });
    }
    if (!user.isAdmin && course.favoriteCount > 0) {
      return reply.code(400).send({
        error: `course has ${course.favoriteCount} favorite${course.favoriteCount === 1 ? "" : "s"} and cannot be deleted`,
      });
    }
    const roundCount = await getCourseRoundCount(course.id);
    if (roundCount > 0) {
      return reply.code(400).send({
        error: `course has ${roundCount} associated round${roundCount === 1 ? "" : "s"} and cannot be deleted`,
      });
    }
    await deleteCourse(course.id);
    return { ok: true };
  });

  // --- Favorites ---

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

  // --- Reviews ---

  app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    "/api/courses/:id/reviews",
    async (req, reply) => {
      const course = await getCourse(req.params.id);
      if (!course) return reply.code(404).send({ error: "course not found" });
      const parsedLimit = Number(req.query.limit);
      const parsedOffset = Number(req.query.offset);
      const limit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(Math.floor(parsedLimit), 50))
        : 20;
      const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0;
      return await listCourseReviews(course.id, limit, offset);
    },
  );

  app.post<{ Params: { id: string }; Body: { rating?: unknown; reviewText?: unknown } }>(
    "/api/courses/:id/reviews",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const course = await getCourse(req.params.id, user.id);
      if (!course) return reply.code(404).send({ error: "course not found" });
      try {
        const rating = validateStarRating(req.body?.rating);
        const reviewText = validateReviewText(req.body?.reviewText);
        const review = await upsertCourseReview(course.id, user.id, rating, reviewText);
        return { review };
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    },
  );

  app.delete<{ Params: { id: string } }>("/api/courses/:id/reviews", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    await deleteCourseReview(req.params.id, user.id);
    return { ok: true };
  });

  // --- Reports ---

  app.post<{ Params: { id: string }; Body: { reason?: unknown } }>(
    "/api/courses/:id/report",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const course = await getCourse(req.params.id, user.id);
      if (!course) return reply.code(404).send({ error: "course not found" });
      try {
        const reason = validateReportReason(req.body?.reason);
        await createCourseReport(course.id, user.id, reason);
        return { ok: true };
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    },
  );

  // --- Weather (for course detail page) ---

  app.get<{ Params: { id: string } }>("/api/courses/:id/weather", async (req, reply) => {
    const viewer = await getViewerUser(req);
    const course = await getCourse(req.params.id, viewer?.id ?? null);
    if (!course) return reply.code(404).send({ error: "course not found" });

    let lat = course.latitude;
    let lng = course.longitude;

    if (lat == null || lng == null) {
      if (!course.location) {
        return reply.code(422).send({ error: "course has no location set" });
      }
      let geo: Awaited<ReturnType<typeof geocodeLocation>>;
      try {
        geo = await geocodeLocation(course.location);
      } catch {
        return reply.code(502).send({ error: "geocoding service unavailable" });
      }
      if (!geo) {
        return reply.code(502).send({ error: "could not geocode course location" });
      }
      lat = geo.latitude;
      lng = geo.longitude;
      await updateCourseCoords(course.id, lat, lng);
    }

    const weather = await fetchWeather(lat, lng);
    if (!weather) {
      return reply.code(502).send({ error: "weather service unavailable" });
    }

    return { weather };
  });
}
