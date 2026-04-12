import type { FastifyInstance } from "fastify";
import { normalizeRoomCode } from "@dad-golf/shared";
import { getCourse, getRoundByRoomCode, updateCourseCoords } from "../db/index.js";
import { fetchWeather, geocodeLocation } from "../weather.js";
import { getViewerUser } from "./validation.js";

export async function registerWeatherRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { code: string } }>(
    "/api/rounds/:code/weather",
    async (req, reply) => {
      const viewer = await getViewerUser(req);
      const code = normalizeRoomCode(req.params.code);
      const round = await getRoundByRoomCode(code);
      if (!round) return reply.code(404).send({ error: "round not found" });

      const course = await getCourse(round.courseId, viewer?.id ?? null);
      if (!course) return reply.code(404).send({ error: "course not found" });

      let lat = course.latitude;
      let lng = course.longitude;

      // If no coordinates stored, try geocoding the location text
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
        // Persist the resolved coordinates for future requests
        await updateCourseCoords(course.id, lat, lng);
      }

      const weather = await fetchWeather(lat, lng);
      if (!weather) {
        return reply.code(502).send({ error: "weather service unavailable" });
      }

      return { weather };
    },
  );
}
