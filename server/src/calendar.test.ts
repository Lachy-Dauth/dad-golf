import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeText,
  escapeHtml,
  foldLine,
  generateIcsEvent,
  generateIcsFeed,
  buildScheduledRoundEvent,
} from "./calendar.js";
import type { IcsEventParams } from "./calendar.js";

// --- escapeText ---

test("escapeText escapes backslashes", () => {
  assert.equal(escapeText("a\\b"), "a\\\\b");
});

test("escapeText escapes semicolons", () => {
  assert.equal(escapeText("a;b"), "a\\;b");
});

test("escapeText escapes commas", () => {
  assert.equal(escapeText("a,b"), "a\\,b");
});

test("escapeText escapes newlines", () => {
  assert.equal(escapeText("a\nb"), "a\\nb");
});

test("escapeText handles multiple special chars", () => {
  assert.equal(escapeText("a\\b;c,d\ne"), "a\\\\b\\;c\\,d\\ne");
});

// --- escapeHtml ---

test("escapeHtml escapes ampersands", () => {
  assert.equal(escapeHtml("a&b"), "a&amp;b");
});

test("escapeHtml escapes angle brackets", () => {
  assert.equal(escapeHtml("<div>"), "&lt;div&gt;");
});

test("escapeHtml escapes double quotes", () => {
  assert.equal(escapeHtml('a"b'), "a&quot;b");
});

// --- foldLine ---

test("foldLine passes through short lines", () => {
  const short = "A".repeat(75);
  assert.equal(foldLine(short), short);
});

test("foldLine folds lines longer than 75 chars", () => {
  const long = "A".repeat(150);
  const folded = foldLine(long);
  assert.ok(folded.includes("\r\n "), "expected CRLF+space continuation");
  // Reconstructing the original by removing fold markers
  const unfolded = folded.replace(/\r\n /g, "");
  assert.equal(unfolded, long);
});

// --- generateIcsEvent ---

function makeEventParams(overrides: Partial<IcsEventParams> = {}): IcsEventParams {
  return {
    uid: "test-123@stableford.app",
    summary: "Test Event",
    description: "A test event",
    htmlDescription: "<b>A test event</b>",
    location: null,
    latitude: null,
    longitude: null,
    dtstart: "20250315T090000",
    dtend: "20250315T130000",
    allDay: false,
    url: null,
    status: "CONFIRMED",
    ...overrides,
  };
}

test("generateIcsEvent produces valid VCALENDAR structure", () => {
  const ics = generateIcsEvent(makeEventParams());
  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("END:VCALENDAR"));
  assert.ok(ics.includes("VERSION:2.0"));
  assert.ok(ics.includes("PRODID:"));
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("END:VEVENT"));
});

test("generateIcsEvent includes UID and summary", () => {
  const ics = generateIcsEvent(makeEventParams());
  assert.ok(ics.includes("UID:test-123@stableford.app"));
  assert.ok(ics.includes("SUMMARY:Test Event"));
});

test("generateIcsEvent uses timed format for non-all-day", () => {
  const ics = generateIcsEvent(makeEventParams());
  assert.ok(ics.includes("DTSTART:20250315T090000"));
  assert.ok(ics.includes("DTEND:20250315T130000"));
});

test("generateIcsEvent uses date-only format for all-day", () => {
  const ics = generateIcsEvent(
    makeEventParams({ allDay: true, dtstart: "20250315", dtend: "20250316" }),
  );
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20250315"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20250316"));
});

test("generateIcsEvent includes location when provided", () => {
  const ics = generateIcsEvent(makeEventParams({ location: "Royal Melbourne" }));
  assert.ok(ics.includes("LOCATION:Royal Melbourne"));
});

test("generateIcsEvent omits location when null", () => {
  const ics = generateIcsEvent(makeEventParams({ location: null }));
  assert.ok(!ics.includes("LOCATION:"));
});

test("generateIcsEvent includes GEO when coordinates provided", () => {
  const ics = generateIcsEvent(makeEventParams({ latitude: -37.84, longitude: 144.98 }));
  assert.ok(ics.includes("GEO:-37.84;144.98"));
});

test("generateIcsEvent includes URL when provided", () => {
  const ics = generateIcsEvent(makeEventParams({ url: "https://example.com" }));
  assert.ok(ics.includes("URL:https://example.com"));
});

test("generateIcsEvent escapes special chars in summary", () => {
  const ics = generateIcsEvent(makeEventParams({ summary: "Golf, Fun; Day" }));
  assert.ok(ics.includes("SUMMARY:Golf\\, Fun\\; Day"));
});

// --- generateIcsFeed ---

test("generateIcsFeed includes calendar name and scale", () => {
  const feed = generateIcsFeed([], "My Golf Calendar");
  assert.ok(feed.includes("CALSCALE:GREGORIAN"));
  assert.ok(feed.includes("X-WR-CALNAME:My Golf Calendar"));
});

test("generateIcsFeed with no events has no VEVENT", () => {
  const feed = generateIcsFeed([], "Empty");
  assert.ok(!feed.includes("BEGIN:VEVENT"));
});

test("generateIcsFeed includes multiple events", () => {
  const events = [makeEventParams({ uid: "e1" }), makeEventParams({ uid: "e2" })];
  const feed = generateIcsFeed(events, "Calendar");
  const veventCount = (feed.match(/BEGIN:VEVENT/g) || []).length;
  assert.equal(veventCount, 2);
});

// --- buildScheduledRoundEvent ---

test("buildScheduledRoundEvent uid format", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-123",
    groupId: "g-1",
    courseName: "Royal Melbourne",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: null,
    durationMinutes: null,
    groupName: "Weekend Group",
    createdByName: "Alice",
    notes: null,
    rsvps: [],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.equal(result.uid, "sr-123@stableford.app");
});

test("buildScheduledRoundEvent summary format", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Pine Valley",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: null,
    durationMinutes: null,
    groupName: "Group",
    createdByName: "Bob",
    notes: null,
    rsvps: [],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.equal(result.summary, "Golf @ Pine Valley");
});

test("buildScheduledRoundEvent all-day event when no time", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Course",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: null,
    durationMinutes: null,
    groupName: "Group",
    createdByName: "Alice",
    notes: null,
    rsvps: [],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.equal(result.allDay, true);
  assert.equal(result.dtstart, "20250315");
  assert.equal(result.dtend, "20250316"); // next day, exclusive
});

test("buildScheduledRoundEvent timed event with duration", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Course",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: "09:00",
    durationMinutes: 240,
    groupName: "Group",
    createdByName: "Alice",
    notes: null,
    rsvps: [],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.equal(result.allDay, false);
  assert.equal(result.dtstart, "20250315T090000");
  assert.equal(result.dtend, "20250315T130000");
});

test("buildScheduledRoundEvent defaults duration to 240 min", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Course",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: "10:00",
    durationMinutes: null,
    groupName: "Group",
    createdByName: "Alice",
    notes: null,
    rsvps: [],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.equal(result.dtend, "20250315T140000"); // 10:00 + 4h = 14:00
});

test("buildScheduledRoundEvent cancelled status", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Course",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: null,
    durationMinutes: null,
    groupName: "Group",
    createdByName: "Alice",
    notes: null,
    rsvps: [],
    status: "cancelled",
    appUrl: "https://app.example.com",
  });
  assert.equal(result.status, "CANCELLED");
});

test("buildScheduledRoundEvent scheduled/started maps to CONFIRMED", () => {
  for (const status of ["scheduled", "started"] as const) {
    const result = buildScheduledRoundEvent({
      scheduledRoundId: "sr-1",
      groupId: "g-1",
      courseName: "Course",
      courseLocation: null,
      latitude: null,
      longitude: null,
      scheduledDate: "2025-03-15",
      scheduledTime: null,
      durationMinutes: null,
      groupName: "Group",
      createdByName: "Alice",
      notes: null,
      rsvps: [],
      status,
      appUrl: "https://app.example.com",
    });
    assert.equal(result.status, "CONFIRMED");
  }
});

test("buildScheduledRoundEvent includes RSVPs in description", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Course",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: null,
    durationMinutes: null,
    groupName: "Group",
    createdByName: "Alice",
    notes: null,
    rsvps: [
      { userId: "u1", userName: "Alice", status: "accepted", respondedAt: "" },
      { userId: "u2", userName: "Bob", status: "tentative", respondedAt: "" },
    ],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.ok(result.description.includes("Going: Alice"));
  assert.ok(result.description.includes("Maybe: Bob"));
  assert.ok(result.htmlDescription.includes("Going:"));
  assert.ok(result.htmlDescription.includes("Maybe:"));
});

test("buildScheduledRoundEvent includes notes in description", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Course",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: null,
    durationMinutes: null,
    groupName: "Group",
    createdByName: "Alice",
    notes: "Bring extra balls",
    rsvps: [],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.ok(result.description.includes("Notes: Bring extra balls"));
});

test("buildScheduledRoundEvent URL format", () => {
  const result = buildScheduledRoundEvent({
    scheduledRoundId: "sr-1",
    groupId: "g-1",
    courseName: "Course",
    courseLocation: null,
    latitude: null,
    longitude: null,
    scheduledDate: "2025-03-15",
    scheduledTime: null,
    durationMinutes: null,
    groupName: "Group",
    createdByName: "Alice",
    notes: null,
    rsvps: [],
    status: "scheduled",
    appUrl: "https://app.example.com",
  });
  assert.equal(result.url, "https://app.example.com/groups/g-1/schedule/sr-1");
});
