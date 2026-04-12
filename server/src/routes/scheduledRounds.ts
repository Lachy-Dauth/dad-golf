import type { FastifyInstance } from "fastify";
import type { RsvpStatus } from "@dad-golf/shared";
import { generateRoomCode } from "@dad-golf/shared";
import { buildScheduledRoundEvent, generateIcsEvent } from "../calendar.js";
import {
  syncRsvpToGoogle,
  syncScheduledRoundUpdateToGoogle,
  syncScheduledRoundCancelToGoogle,
} from "../calendarSync.js";
import {
  addPlayer,
  claimScheduledRound,
  createRound,
  createScheduledRound,
  getCourse,
  getGroup,
  getRoundByRoomCode,
  getScheduledRound,
  getUserRoleInGroup,
  listAcceptedRsvpUserIds,
  listGroupMembers,
  listRsvps,
  listScheduledRoundsForGroup,
  listScheduledRoundsForUser,
  updateScheduledRound,
  updateScheduledRoundStatus,
  upsertRsvp,
  findPlayerByName,
} from "../db/index.js";
import { buildRoundState } from "../roundState.js";
import {
  MAX_PLAYERS_PER_ROUND,
  requireUser,
  validateDurationMinutes,
  validateScheduledDate,
  validateScheduledTime,
} from "./validation.js";

const VALID_RSVP: RsvpStatus[] = ["accepted", "declined", "tentative"];

export async function registerScheduledRoundRoutes(app: FastifyInstance): Promise<void> {
  // List scheduled rounds for a group
  app.get<{ Params: { groupId: string } }>(
    "/api/groups/:groupId/scheduled-rounds",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const group = await getGroup(req.params.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (!role) return reply.code(403).send({ error: "you are not a member of this group" });

      const scheduledRounds = await listScheduledRoundsForGroup(group.id);
      const rsvpEntries = await Promise.all(
        scheduledRounds.map(async (sr) => [sr.id, await listRsvps(sr.id)] as const),
      );
      const rsvps: Record<string, Awaited<ReturnType<typeof listRsvps>>> = Object.fromEntries(
        rsvpEntries,
      );
      return { scheduledRounds, rsvps };
    },
  );

  // Get a single scheduled round
  app.get<{ Params: { groupId: string; id: string } }>(
    "/api/groups/:groupId/scheduled-rounds/:id",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const group = await getGroup(req.params.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (!role) return reply.code(403).send({ error: "you are not a member of this group" });

      const scheduledRound = await getScheduledRound(req.params.id);
      if (!scheduledRound || scheduledRound.groupId !== group.id) {
        return reply.code(404).send({ error: "scheduled round not found" });
      }
      const rsvps = await listRsvps(scheduledRound.id);
      return { scheduledRound, rsvps };
    },
  );

  // Download .ics calendar file for a scheduled round
  app.get<{ Params: { groupId: string; id: string } }>(
    "/api/groups/:groupId/scheduled-rounds/:id/ics",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const group = await getGroup(req.params.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (!role) return reply.code(403).send({ error: "you are not a member of this group" });

      const sr = await getScheduledRound(req.params.id);
      if (!sr || sr.groupId !== group.id) {
        return reply.code(404).send({ error: "scheduled round not found" });
      }

      const course = await getCourse(sr.courseId, null);
      const rsvps = await listRsvps(sr.id);

      const appUrl = process.env.APP_URL || `${req.protocol}://${req.hostname}`;
      const eventParams = buildScheduledRoundEvent({
        scheduledRoundId: sr.id,
        groupId: sr.groupId,
        courseName: sr.courseName,
        courseLocation: course?.location ?? null,
        latitude: course?.latitude ?? null,
        longitude: course?.longitude ?? null,
        scheduledDate: sr.scheduledDate,
        scheduledTime: sr.scheduledTime,
        durationMinutes: sr.durationMinutes,
        groupName: group.name,
        createdByName: sr.createdByName,
        notes: sr.notes,
        rsvps,
        status: sr.status,
        appUrl,
      });
      const ics = generateIcsEvent(eventParams);

      const filename = `golf-${sr.scheduledDate}.ics`;
      return reply
        .header("Content-Type", "text/calendar; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(ics);
    },
  );

  // Create a scheduled round
  app.post<{
    Params: { groupId: string };
    Body: {
      courseId?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      durationMinutes?: number;
      notes?: string;
    };
  }>("/api/groups/:groupId/scheduled-rounds", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const group = await getGroup(req.params.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (role !== "admin") {
        return reply.code(403).send({ error: "only group admins can schedule rounds" });
      }

      const {
        courseId,
        scheduledDate: rawDate,
        scheduledTime: rawTime,
        durationMinutes: rawDuration,
        notes,
      } = req.body ?? {};
      if (!courseId) throw new Error("courseId is required");
      const course = await getCourse(courseId, user.id);
      if (!course) throw new Error("course not found");

      const scheduledDate = validateScheduledDate(rawDate);
      const scheduledTime = rawTime ? validateScheduledTime(rawTime) : null;
      const durationMinutes = validateDurationMinutes(rawDuration);
      const trimmedNotes = typeof notes === "string" ? notes.trim() || null : null;

      const scheduledRound = await createScheduledRound(
        group.id,
        course.id,
        scheduledDate,
        scheduledTime,
        durationMinutes,
        trimmedNotes,
        user.id,
      );
      return reply.code(201).send({ scheduledRound });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Update a scheduled round
  app.patch<{
    Params: { groupId: string; id: string };
    Body: {
      courseId?: string;
      scheduledDate?: string;
      scheduledTime?: string | null;
      durationMinutes?: number | null;
      notes?: string | null;
    };
  }>("/api/groups/:groupId/scheduled-rounds/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const group = await getGroup(req.params.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (role !== "admin") {
        return reply.code(403).send({ error: "only group admins can update scheduled rounds" });
      }

      const sr = await getScheduledRound(req.params.id);
      if (!sr || sr.groupId !== group.id) {
        return reply.code(404).send({ error: "scheduled round not found" });
      }
      if (sr.status !== "scheduled") {
        return reply.code(400).send({ error: "can only edit rounds in scheduled status" });
      }

      const fields: Parameters<typeof updateScheduledRound>[1] = {};
      const { courseId, scheduledDate, scheduledTime, durationMinutes, notes } = req.body ?? {};

      if (courseId !== undefined) {
        const course = await getCourse(courseId, user.id);
        if (!course) throw new Error("course not found");
        fields.courseId = course.id;
      }
      if (scheduledDate !== undefined) {
        fields.scheduledDate = validateScheduledDate(scheduledDate);
      }
      if (scheduledTime !== undefined) {
        fields.scheduledTime = scheduledTime ? validateScheduledTime(scheduledTime) : null;
      }
      if (durationMinutes !== undefined) {
        fields.durationMinutes = validateDurationMinutes(durationMinutes);
      }
      if (notes !== undefined) {
        fields.notes = typeof notes === "string" ? notes.trim() || null : null;
      }

      await updateScheduledRound(sr.id, fields);
      syncScheduledRoundUpdateToGoogle(sr.id, req.log).catch((err) => {
        req.log.error({ err, scheduledRoundId: sr.id }, "Failed to sync round update to Google");
      });
      const updated = await getScheduledRound(sr.id);
      return { scheduledRound: updated };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Cancel a scheduled round
  app.delete<{ Params: { groupId: string; id: string } }>(
    "/api/groups/:groupId/scheduled-rounds/:id",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      const group = await getGroup(req.params.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (role !== "admin") {
        return reply.code(403).send({ error: "only group admins can cancel scheduled rounds" });
      }

      const sr = await getScheduledRound(req.params.id);
      if (!sr || sr.groupId !== group.id) {
        return reply.code(404).send({ error: "scheduled round not found" });
      }
      if (sr.status !== "scheduled") {
        return reply.code(400).send({ error: "can only cancel rounds in scheduled status" });
      }

      await updateScheduledRoundStatus(sr.id, "cancelled");
      syncScheduledRoundCancelToGoogle(sr.id, req.log).catch((err) => {
        req.log.error({ err, scheduledRoundId: sr.id }, "Failed to sync round cancel to Google");
      });
      return { ok: true };
    },
  );

  // RSVP to a scheduled round
  app.post<{
    Params: { groupId: string; id: string };
    Body: { status?: string };
  }>("/api/groups/:groupId/scheduled-rounds/:id/rsvp", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    try {
      const group = await getGroup(req.params.groupId);
      if (!group) return reply.code(404).send({ error: "group not found" });
      const role = await getUserRoleInGroup(group.id, user.id);
      if (!role) return reply.code(403).send({ error: "you are not a member of this group" });

      const sr = await getScheduledRound(req.params.id);
      if (!sr || sr.groupId !== group.id) {
        return reply.code(404).send({ error: "scheduled round not found" });
      }
      if (sr.status !== "scheduled") {
        return reply.code(400).send({ error: "can only RSVP to rounds in scheduled status" });
      }

      const status = req.body?.status as RsvpStatus;
      if (!VALID_RSVP.includes(status)) {
        throw new Error("status must be one of: accepted, declined, tentative");
      }

      const rsvp = await upsertRsvp(sr.id, user.id, status);
      syncRsvpToGoogle(user.id, sr, status, req.log).catch((err) => {
        req.log.error(
          { err, userId: user.id, scheduledRoundId: sr.id, status },
          "Failed to sync RSVP to Google Calendar",
        );
      });
      return { rsvp };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  // Convert scheduled round to a live round
  app.post<{ Params: { groupId: string; id: string } }>(
    "/api/groups/:groupId/scheduled-rounds/:id/start",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;
      try {
        const group = await getGroup(req.params.groupId);
        if (!group) return reply.code(404).send({ error: "group not found" });
        const role = await getUserRoleInGroup(group.id, user.id);
        if (role !== "admin") {
          return reply.code(403).send({ error: "only group admins can start scheduled rounds" });
        }

        const sr = await getScheduledRound(req.params.id);
        if (!sr || sr.groupId !== group.id) {
          return reply.code(404).send({ error: "scheduled round not found" });
        }
        if (sr.status !== "scheduled") {
          return reply
            .code(400)
            .send({ error: "this scheduled round has already been started or cancelled" });
        }

        // Atomically claim the scheduled round to prevent races
        const claimed = await claimScheduledRound(sr.id);
        if (!claimed) {
          return reply
            .code(400)
            .send({ error: "this scheduled round has already been started or cancelled" });
        }

        const course = await getCourse(sr.courseId, user.id);
        if (!course) {
          return reply
            .code(400)
            .send({ error: "the course for this scheduled round no longer exists" });
        }

        // Generate room code
        let code = "";
        for (let attempt = 0; attempt < 10; attempt++) {
          code = generateRoomCode();
          if (!(await getRoundByRoomCode(code))) break;
          if (attempt === 9) {
            return reply
              .code(500)
              .send({ error: "failed to generate a unique room code, please try again" });
          }
        }

        // Create the live round
        const round = await createRound(code, course.id, group.id, user.id);

        // Add the admin as leader/player
        await addPlayer(round.id, user.displayName, user.handicap, user.id);

        // Add accepted RSVP members as players
        const acceptedUserIds = new Set(await listAcceptedRsvpUserIds(sr.id));
        const members = await listGroupMembers(group.id);
        let added = 1; // leader already added
        for (const member of members) {
          if (!member.userId) continue;
          if (member.userId === user.id) continue; // leader already added
          if (!acceptedUserIds.has(member.userId)) continue;
          if (added >= MAX_PLAYERS_PER_ROUND) break;
          if (await findPlayerByName(round.id, member.name)) continue;
          await addPlayer(round.id, member.name, member.handicap, member.userId);
          added++;
        }

        // Link scheduled round to live round
        await updateScheduledRoundStatus(sr.id, "started", round.id);

        const state = await buildRoundState(round.roomCode, user.id);
        return reply.code(201).send({ state });
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    },
  );

  // List all upcoming scheduled rounds the user has RSVP'd to (across all groups)
  app.get("/api/my/scheduled-rounds", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const scheduledRounds = await listScheduledRoundsForUser(user.id);
    return { scheduledRounds };
  });
}
