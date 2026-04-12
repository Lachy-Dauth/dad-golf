import type { FastifyInstance } from "fastify";
import {
  clearAllGoogleEventIds,
  consumeOAuthNonce,
  createGoogleConnection,
  createOAuthNonce,
  deleteGoogleConnection,
  getGoogleConnection,
  getUser,
  updateGoogleCalendarId,
  updateGoogleTokens,
} from "../db/index.js";
import {
  exchangeAuthCode,
  listCalendars,
  refreshAccessToken,
  revokeToken,
} from "../googleCalendar.js";
import { requireUser } from "./validation.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function getRedirectUri(): string {
  const appUrl = process.env.APP_URL || "http://localhost:3001";
  return `${appUrl}/api/google-calendar/callback`;
}

function isConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function registerGoogleCalendarRoutes(app: FastifyInstance): Promise<void> {
  // Check if Google Calendar integration is available
  app.get("/api/google-calendar/available", async () => {
    return { available: isConfigured() };
  });

  // Get OAuth authorization URL
  app.get("/api/google-calendar/auth-url", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    if (!isConfigured()) {
      return reply.code(501).send({ error: "Google Calendar integration not configured" });
    }

    // Generate a one-time CSRF nonce bound to this user (not the session token)
    const state = await createOAuthNonce(user.id);

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: getRedirectUri(),
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return { url: `${GOOGLE_AUTH_URL}?${params.toString()}` };
  });

  // OAuth callback — Google redirects here
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/api/google-calendar/callback",
    async (req, reply) => {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        return reply.redirect("/profile?google=error");
      }
      if (!code || !state) {
        return reply.redirect("/profile?google=error");
      }

      // Validate the CSRF nonce and identify the user
      const userId = await consumeOAuthNonce(state);
      if (!userId) {
        return reply.redirect("/profile?google=error");
      }
      const user = await getUser(userId);
      if (!user) {
        return reply.redirect("/profile?google=error");
      }

      try {
        const tokens = await exchangeAuthCode(code, getRedirectUri());
        await createGoogleConnection(
          user.id,
          tokens.accessToken,
          tokens.refreshToken,
          tokens.tokenExpiry,
          tokens.email,
        );
        return reply.redirect("/profile?google=connected");
      } catch (err) {
        req.log.error(err, "Google Calendar OAuth callback failed");
        return reply.redirect("/profile?google=error");
      }
    },
  );

  // Get connection status
  app.get("/api/google-calendar/status", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const conn = await getGoogleConnection(user.id);
    return {
      connected: Boolean(conn),
      email: conn?.email ?? null,
      calendarId: conn?.calendarId ?? null,
    };
  });

  // List user's Google calendars
  app.get("/api/google-calendar/calendars", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const conn = await getGoogleConnection(user.id);
    if (!conn) {
      return reply.code(400).send({ error: "Google Calendar not connected" });
    }

    // Refresh token if needed
    let accessToken = conn.accessToken;
    if (new Date(conn.tokenExpiry) <= new Date()) {
      try {
        const refreshed = await refreshAccessToken(conn.refreshToken);
        accessToken = refreshed.accessToken;
        await updateGoogleTokens(user.id, refreshed.accessToken, refreshed.tokenExpiry);
      } catch (err) {
        req.log.warn(err, "Google token refresh failed");
        await clearAllGoogleEventIds(user.id);
        await deleteGoogleConnection(user.id);
        return reply
          .code(400)
          .send({ error: "Google Calendar connection expired, please reconnect" });
      }
    }

    try {
      const calendars = await listCalendars(accessToken);
      return { calendars };
    } catch (err) {
      req.log.error(err, "Failed to list Google calendars");
      return reply.code(502).send({ error: "Failed to fetch calendars from Google" });
    }
  });

  // Update calendar settings
  app.patch<{ Body: { calendarId?: string } }>(
    "/api/google-calendar/settings",
    async (req, reply) => {
      const user = await requireUser(req, reply);
      if (!user) return;

      const { calendarId } = req.body ?? {};
      if (!calendarId || typeof calendarId !== "string") {
        return reply.code(400).send({ error: "calendarId is required" });
      }

      const conn = await getGoogleConnection(user.id);
      if (!conn) {
        return reply.code(400).send({ error: "Google Calendar not connected" });
      }

      await updateGoogleCalendarId(user.id, calendarId);
      return { ok: true };
    },
  );

  // Disconnect Google Calendar
  app.delete("/api/google-calendar", async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;

    const conn = await getGoogleConnection(user.id);
    if (conn) {
      await revokeToken(conn.accessToken).catch(() => {});
      await clearAllGoogleEventIds(user.id);
      await deleteGoogleConnection(user.id);
    }

    return { ok: true };
  });
}
