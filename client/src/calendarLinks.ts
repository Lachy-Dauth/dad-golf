import { getAuthToken } from "./authStore.js";

export interface CalendarLinkParams {
  courseName: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string | null; // HH:MM
  durationMinutes: number | null;
  courseLocation: string | null;
  notes: string | null;
  groupName: string;
  groupId: string;
  scheduledRoundId: string;
}

const DEFAULT_DURATION = 240; // 4 hours

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Download an .ics file using the Authorization header (avoids leaking tokens in URLs). */
export async function downloadIcsFile(groupId: string, scheduledRoundId: string): Promise<void> {
  const url = `/api/groups/${groupId}/scheduled-rounds/${scheduledRoundId}/ics`;
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download calendar file (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `golf-round-${scheduledRoundId}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Build a Google Calendar event creation URL.
 * @see https://github.com/nicholasgasior/calendar-link
 */
export function googleCalendarUrl(params: CalendarLinkParams): string {
  const duration = params.durationMinutes ?? DEFAULT_DURATION;
  const title = `Golf @ ${params.courseName}`;
  const datePart = params.scheduledDate.replace(/-/g, "");

  let dates: string;
  if (!params.scheduledTime) {
    // All-day event: YYYYMMDD/YYYYMMDD (end is exclusive)
    const d = new Date(params.scheduledDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const endDate = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    dates = `${datePart}/${endDate}`;
  } else {
    const [h, m] = params.scheduledTime.split(":").map(Number);
    const start = `${datePart}T${pad(h)}${pad(m)}00`;
    const totalMin = h * 60 + m + duration;
    const daysOver = Math.floor(totalMin / 1440);
    const endH = Math.floor((totalMin % 1440) / 60);
    const endM = totalMin % 60;
    let endDatePart = datePart;
    if (daysOver > 0) {
      const d = new Date(params.scheduledDate + "T00:00:00");
      d.setDate(d.getDate() + daysOver);
      endDatePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    }
    const end = `${endDatePart}T${pad(endH)}${pad(endM)}00`;
    dates = `${start}/${end}`;
  }

  const details = buildDescription(params);

  const url = new URL("https://calendar.google.com/calendar/r/eventedit");
  url.searchParams.set("text", title);
  url.searchParams.set("dates", dates);
  if (params.courseLocation) url.searchParams.set("location", params.courseLocation);
  url.searchParams.set("details", details);

  return url.toString();
}

/**
 * Build an Outlook Web calendar event creation URL.
 */
export function outlookCalendarUrl(params: CalendarLinkParams): string {
  const duration = params.durationMinutes ?? DEFAULT_DURATION;
  const title = `Golf @ ${params.courseName}`;

  let startdt: string;
  let enddt: string;

  if (!params.scheduledTime) {
    startdt = params.scheduledDate;
    const d = new Date(params.scheduledDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    enddt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } else {
    startdt = `${params.scheduledDate}T${params.scheduledTime}:00`;
    const [h, m] = params.scheduledTime.split(":").map(Number);
    const totalMin = h * 60 + m + duration;
    const daysOver = Math.floor(totalMin / 1440);
    const endH = Math.floor((totalMin % 1440) / 60);
    const endM = totalMin % 60;
    let endDateStr = params.scheduledDate;
    if (daysOver > 0) {
      const d = new Date(params.scheduledDate + "T00:00:00");
      d.setDate(d.getDate() + daysOver);
      endDateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    enddt = `${endDateStr}T${pad(endH)}:${pad(endM)}:00`;
  }

  const body = buildDescription(params);

  const url = new URL("https://outlook.live.com/calendar/0/action/compose");
  url.searchParams.set("subject", title);
  url.searchParams.set("startdt", startdt);
  url.searchParams.set("enddt", enddt);
  if (params.courseLocation) url.searchParams.set("location", params.courseLocation);
  url.searchParams.set("body", body);
  if (!params.scheduledTime) url.searchParams.set("allday", "true");

  return url.toString();
}

function buildDescription(params: CalendarLinkParams): string {
  const parts: string[] = [];
  parts.push(`Group: ${params.groupName}`);
  if (params.notes) parts.push(`Notes: ${params.notes}`);

  const appUrl = window.location.origin;
  parts.push(`View in Stableford:`);
  parts.push(`${appUrl}/groups/${params.groupId}/schedule/${params.scheduledRoundId}`);

  return parts.join("\n");
}
