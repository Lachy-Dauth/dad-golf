import type { ScheduledRoundRsvp } from "@dad-golf/shared";

export interface IcsEventParams {
  uid: string;
  summary: string;
  description: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  dtstart: string; // YYYYMMDD or YYYYMMDDTHHmmss
  dtend: string; // YYYYMMDD or YYYYMMDDTHHmmss
  allDay: boolean;
  url: string | null;
  status: "CONFIRMED" | "CANCELLED";
}

/** Escape special characters for iCalendar TEXT fields (RFC 5545 §3.3.11). */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Fold lines longer than 75 octets per RFC 5545 §3.1.
 * Continuation lines start with a single space.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  parts.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    parts.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join("\r\n");
}

function formatUtcTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Generate a single-event VCALENDAR string (RFC 5545). */
export function generateIcsEvent(params: IcsEventParams): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stableford//Calendar//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${formatUtcTimestamp()}`,
  ];

  if (params.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${params.dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${params.dtend}`);
  } else {
    lines.push(`DTSTART:${params.dtstart}`);
    lines.push(`DTEND:${params.dtend}`);
  }

  lines.push(`SUMMARY:${escapeText(params.summary)}`);

  if (params.location) {
    lines.push(`LOCATION:${escapeText(params.location)}`);
  }
  if (params.latitude != null && params.longitude != null) {
    lines.push(`GEO:${params.latitude};${params.longitude}`);
  }

  lines.push(`DESCRIPTION:${escapeText(params.description)}`);

  if (params.url) {
    lines.push(`URL:${params.url}`);
  }

  lines.push(`STATUS:${params.status}`);
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Build IcsEventParams from scheduled round data.
 *
 * Dates use "floating time" (no TZID) — the event appears at the specified
 * local time in whatever timezone the user's calendar is set to. This is
 * correct for local golf events.
 */
export function buildScheduledRoundEvent(params: {
  scheduledRoundId: string;
  groupId: string;
  courseName: string;
  courseLocation: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string | null; // HH:MM
  durationMinutes: number | null;
  groupName: string;
  createdByName: string;
  notes: string | null;
  rsvps: ScheduledRoundRsvp[];
  status: "scheduled" | "started" | "cancelled";
  appUrl: string;
}): IcsEventParams {
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = params.scheduledDate.replace(/-/g, "");
  const allDay = !params.scheduledTime;
  const duration = params.durationMinutes ?? 240; // default 4 hours

  let dtstart: string;
  let dtend: string;

  if (allDay) {
    dtstart = datePart;
    // All-day DTEND is exclusive, so next day
    const d = new Date(params.scheduledDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    dtend = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  } else {
    const [h, m] = params.scheduledTime!.split(":").map(Number);
    dtstart = `${datePart}T${pad(h)}${pad(m)}00`;

    const startMinutes = h * 60 + m + duration;
    const endH = Math.floor(startMinutes / 60) % 24;
    const endM = startMinutes % 60;
    // If duration pushes past midnight, advance the date
    const daysOver = Math.floor((h * 60 + m + duration) / 1440);
    if (daysOver > 0) {
      const d = new Date(params.scheduledDate + "T00:00:00");
      d.setDate(d.getDate() + daysOver);
      const endDate = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      dtend = `${endDate}T${pad(endH)}${pad(endM)}00`;
    } else {
      dtend = `${datePart}T${pad(endH)}${pad(endM)}00`;
    }
  }

  // Build description
  const descParts: string[] = [];
  descParts.push(`Group: ${params.groupName}`);
  descParts.push(`Scheduled by: ${params.createdByName}`);
  if (params.notes) {
    descParts.push(`Notes: ${params.notes}`);
  }

  const accepted = params.rsvps.filter((r) => r.status === "accepted");
  const tentative = params.rsvps.filter((r) => r.status === "tentative");
  if (accepted.length > 0) {
    const names = accepted.map((r) => r.userName);
    descParts.push(`Going: ${names.join(", ")}`);
  }
  if (tentative.length > 0) {
    const names = tentative.map((r) => r.userName);
    descParts.push(`Maybe: ${names.join(", ")}`);
  }

  const roundUrl = `${params.appUrl}/groups/${params.groupId}/schedule/${params.scheduledRoundId}`;
  descParts.push(`View in Stableford:`);
  descParts.push(roundUrl);

  return {
    uid: `${params.scheduledRoundId}@stableford.app`,
    summary: `Golf @ ${params.courseName}`,
    description: descParts.join("\n"),
    location: params.courseLocation,
    latitude: params.latitude,
    longitude: params.longitude,
    dtstart,
    dtend,
    allDay,
    url: roundUrl,
    status: params.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
  };
}
