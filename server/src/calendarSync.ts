import type { FastifyBaseLogger } from "fastify";
import type { RsvpStatus, ScheduledRound } from "@dad-golf/shared";
import type { GoogleCalendarConnection } from "./db/index.js";
import {
  getGoogleConnection,
  updateGoogleTokens,
  deleteGoogleConnection,
  getGoogleEventId,
  setGoogleEventId,
  clearGoogleEventId,
  listRsvpsWithGoogleEvents,
  getScheduledRound,
  getCourse,
  getGroup,
  listRsvps,
} from "./db/index.js";
import { buildScheduledRoundEvent } from "./calendar.js";
import {
  refreshAccessToken,
  icsParamsToGoogleEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "./googleCalendar.js";

/**
 * Get a valid access token for a connection, refreshing if expired.
 * Returns null if the connection is invalid (deleted).
 */
async function getValidAccessToken(
  conn: GoogleCalendarConnection,
  log: FastifyBaseLogger,
): Promise<string | null> {
  if (new Date(conn.tokenExpiry) > new Date()) {
    return conn.accessToken;
  }
  try {
    const { accessToken, tokenExpiry } = await refreshAccessToken(conn.refreshToken);
    await updateGoogleTokens(conn.userId, accessToken, tokenExpiry);
    return accessToken;
  } catch (err) {
    log.warn({ userId: conn.userId, err }, "Google token refresh failed, removing connection");
    await deleteGoogleConnection(conn.userId);
    return null;
  }
}

/** Build the Google event payload for a scheduled round. */
async function buildGoogleEvent(sr: ScheduledRound) {
  const course = await getCourse(sr.courseId, null);
  const group = await getGroup(sr.groupId);
  const rsvps = await listRsvps(sr.id);
  const appUrl = process.env.APP_URL || "https://stableford.app";

  const icsParams = buildScheduledRoundEvent({
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

  return icsParamsToGoogleEvent(icsParams);
}

/**
 * Sync a user's RSVP to their Google Calendar.
 * Called after RSVP mutation. Fire-and-forget.
 */
export async function syncRsvpToGoogle(
  userId: string,
  sr: ScheduledRound,
  rsvpStatus: RsvpStatus,
  log: FastifyBaseLogger,
): Promise<void> {
  const conn = await getGoogleConnection(userId);
  if (!conn) return;

  const accessToken = await getValidAccessToken(conn, log);
  if (!accessToken) return;

  const existingEventId = await getGoogleEventId(sr.id, userId);

  if (rsvpStatus === "accepted" || rsvpStatus === "tentative") {
    const event = await buildGoogleEvent(sr);
    if (existingEventId) {
      await updateCalendarEvent(accessToken, conn.calendarId, existingEventId, event);
    } else {
      const eventId = await createCalendarEvent(accessToken, conn.calendarId, event);
      await setGoogleEventId(sr.id, userId, eventId);
    }
  } else {
    // declined — remove from calendar
    if (existingEventId) {
      await deleteCalendarEvent(accessToken, conn.calendarId, existingEventId);
      await clearGoogleEventId(sr.id, userId);
    }
  }
}

/**
 * Update Google Calendar events for all users when a scheduled round changes.
 * Called after scheduled round update (date/time/course). Fire-and-forget.
 */
export async function syncScheduledRoundUpdateToGoogle(
  scheduledRoundId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const sr = await getScheduledRound(scheduledRoundId);
  if (!sr) return;

  const rsvpsWithEvents = await listRsvpsWithGoogleEvents(scheduledRoundId);
  if (rsvpsWithEvents.length === 0) return;

  const event = await buildGoogleEvent(sr);

  for (const { userId, googleEventId } of rsvpsWithEvents) {
    try {
      const conn = await getGoogleConnection(userId);
      if (!conn) continue;
      const accessToken = await getValidAccessToken(conn, log);
      if (!accessToken) continue;
      await updateCalendarEvent(accessToken, conn.calendarId, googleEventId, event);
    } catch (err) {
      log.warn({ userId, scheduledRoundId, err }, "Failed to update Google Calendar event");
    }
  }
}

/**
 * Delete Google Calendar events for all users when a scheduled round is cancelled.
 * Called after scheduled round cancel. Fire-and-forget.
 */
export async function syncScheduledRoundCancelToGoogle(
  scheduledRoundId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const rsvpsWithEvents = await listRsvpsWithGoogleEvents(scheduledRoundId);
  if (rsvpsWithEvents.length === 0) return;

  for (const { userId, googleEventId } of rsvpsWithEvents) {
    try {
      const conn = await getGoogleConnection(userId);
      if (!conn) continue;
      const accessToken = await getValidAccessToken(conn, log);
      if (!accessToken) continue;
      await deleteCalendarEvent(accessToken, conn.calendarId, googleEventId);
      await clearGoogleEventId(scheduledRoundId, userId);
    } catch (err) {
      log.warn({ userId, scheduledRoundId, err }, "Failed to delete Google Calendar event");
    }
  }
}
