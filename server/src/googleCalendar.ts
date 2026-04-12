import type { IcsEventParams } from "./calendar.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

function getClientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

function getClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
}

export async function exchangeAuthCode(
  code: string,
  redirectUri: string,
): Promise<GoogleTokens & { email: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokenExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Fetch user email
  const infoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const info = (await infoRes.json()) as { email?: string };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry,
    email: info.email ?? "",
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; tokenExpiry: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  // Best-effort — ignore failures
}

export interface GoogleCalendarEvent {
  summary: string;
  location?: string;
  description: string;
  start: { date: string } | { dateTime: string };
  end: { date: string } | { dateTime: string };
  source?: { title: string; url: string };
}

/** Convert IcsEventParams to Google Calendar API event format. */
export function icsParamsToGoogleEvent(params: IcsEventParams): GoogleCalendarEvent {
  const event: GoogleCalendarEvent = {
    summary: params.summary,
    description: params.description,
    start: params.allDay
      ? { date: formatIcsDate(params.dtstart) }
      : { dateTime: formatIcsDateTime(params.dtstart) },
    end: params.allDay
      ? { date: formatIcsDate(params.dtend) }
      : { dateTime: formatIcsDateTime(params.dtend) },
  };
  if (params.location) event.location = params.location;
  if (params.url) event.source = { title: "Stableford", url: params.url };
  return event;
}

/** Convert YYYYMMDD to YYYY-MM-DD */
function formatIcsDate(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/** Convert YYYYMMDDTHHmmss to YYYY-MM-DDTHH:mm:ss */
function formatIcsDateTime(dt: string): string {
  return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}T${dt.slice(9, 11)}:${dt.slice(11, 13)}:${dt.slice(13, 15)}`;
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEvent,
): Promise<string> {
  const res = await fetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar create failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEvent,
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar update failed: ${res.status} ${text}`);
  }
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  // 404/410 means already deleted — that's fine
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Google Calendar delete failed: ${res.status} ${text}`);
  }
}

export interface GoogleCalendarListEntry {
  id: string;
  name: string;
  primary: boolean;
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const res = await fetch(`${CALENDAR_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar list failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    items: Array<{ id: string; summary: string; primary?: boolean; accessRole: string }>;
  };
  return data.items
    .filter((c) => c.accessRole === "owner" || c.accessRole === "writer")
    .map((c) => ({
      id: c.id,
      name: c.summary,
      primary: c.primary === true,
    }));
}
