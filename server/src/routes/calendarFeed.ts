import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildScheduledRoundEvent, generateIcsFeed } from "../calendar.js";
import {
  createCalendarFeedToken,
  deleteCalendarFeedToken,
  getCalendarFeedToken,
  getUserByFeedToken,
  getCourse,
  getGroup,
  listRsvps,
  listScheduledRoundsForFeed,
} from "../db/index.js";
import { requireUser } from "./validation.js";

function buildFeedUrl(token: string, req: Pick<FastifyRequest, "protocol" | "host">): string {
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.host}`;
  return `${appUrl}/api/calendar-feed/${token}.ics`;
}

export async function registerCalendarFeedRoutes(app: FastifyInstance): Promise<void> {
  // Get feed status (authenticated)
  app.get("/api/calendar-feed/status", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const token = await getCalendarFeedToken(user.id);
    if (!token) {
      return { enabled: false, url: null };
    }
    return { enabled: true, url: buildFeedUrl(token, req) };
  });

  // Enable feed (authenticated)
  app.post("/api/calendar-feed/enable", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const token = await createCalendarFeedToken(user.id);
    return { url: buildFeedUrl(token, req) };
  });

  // Disable feed (authenticated)
  app.delete("/api/calendar-feed", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    await deleteCalendarFeedToken(user.id);
    return { ok: true };
  });

  // Serve the iCal feed (unauthenticated — token in path)
  app.get<{ Params: { token: string } }>("/api/calendar-feed/:token.ics", async (req, reply) => {
    const user = await getUserByFeedToken(req.params.token);
    if (!user) {
      return reply.code(404).send({ error: "feed not found" });
    }

    const rounds = await listScheduledRoundsForFeed(user.id);
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.host}`;

    const events = await Promise.all(
      rounds.map(async (sr) => {
        const course = await getCourse(sr.courseId, null);
        const group = await getGroup(sr.groupId);
        const rsvps = await listRsvps(sr.id);

        return buildScheduledRoundEvent({
          scheduledRoundId: sr.id,
          groupId: sr.groupId,
          courseName: sr.courseName,
          courseLocation: course?.location ?? null,
          latitude: course?.latitude ?? null,
          longitude: course?.longitude ?? null,
          scheduledDate: sr.scheduledDate,
          scheduledTime: sr.scheduledTime,
          durationMinutes: sr.durationMinutes,
          groupName: group?.name ?? "Unknown",
          createdByName: sr.createdByName,
          notes: sr.notes,
          rsvps,
          status: sr.status,
          appUrl,
        });
      }),
    );

    const ics = generateIcsFeed(events, "Stableford");

    return reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Cache-Control", "no-cache")
      .header("Content-Disposition", "inline")
      .send(ics);
  });
}
